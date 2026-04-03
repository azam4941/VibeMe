import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Session, SessionDocument } from './booking.schema';
import { UsersService } from '../users/users.service';

@Injectable()
export class BookingService {
  constructor(
    @InjectModel(Session.name) private sessionModel: Model<SessionDocument>,
    private usersService: UsersService,
  ) {}

  // ───── Create Session ─────

  async createSession(buyerId: string, renterId: string, notes?: string): Promise<SessionDocument> {
    if (buyerId === renterId) {
      throw new BadRequestException('Cannot book a session with yourself');
    }

    const renter = await this.usersService.findById(renterId);

    // Business rule: only Rent Mode users can be booked
    if (!renter.rentMode) {
      throw new BadRequestException('This user is not offering their time right now');
    }

    if (renter.isBlocked) {
      throw new BadRequestException('This user is not available');
    }

    if (renter.pricePerMinute < 0) {
      throw new BadRequestException('Renter has not set a valid price');
    }

    // Prevent duplicate pending sessions
    const existingPending = await this.sessionModel.findOne({
      buyerId: new Types.ObjectId(buyerId),
      renterId: new Types.ObjectId(renterId),
      status: { $in: ['pending', 'accepted', 'active'] },
    });
    if (existingPending) {
      throw new BadRequestException('You already have an ongoing session with this user');
    }

    // Check if buyer is blocked by renter
    const isBlocked = await this.usersService.isBlockedByUser(renterId, buyerId);
    if (isBlocked) {
      throw new ForbiddenException('You cannot book this user');
    }

    return this.sessionModel.create({
      buyerId: new Types.ObjectId(buyerId),
      renterId: new Types.ObjectId(renterId),
      pricePerMinute: renter.pricePerMinute,
      notes: notes || '',
    });
  }

  // ───── Accept ─────

  async acceptSession(sessionId: string, renterId: string): Promise<SessionDocument> {
    const session = await this.findSessionById(sessionId);
    if ((session.renterId as any)._id.toString() !== renterId) {
      throw new ForbiddenException('Only the renter can accept this session');
    }
    if (session.status !== 'pending') {
      throw new BadRequestException(`Cannot accept a session with status: ${session.status}`);
    }
    session.status = 'accepted';
    return session.save();
  }

  // ───── Start Session (begin timer) ─────

  async startSession(sessionId: string, userId: string): Promise<SessionDocument> {
    const session = await this.findSessionById(sessionId);

    // Either party can start the session
    const isParticipant =
      (session.buyerId as any)._id.toString() === userId || (session.renterId as any)._id.toString() === userId;
    if (!isParticipant) {
      throw new ForbiddenException('You are not a participant in this session');
    }

    if (session.status !== 'accepted') {
      throw new BadRequestException('Session must be accepted before starting');
    }

    session.status = 'active';
    session.startTime = new Date();
    return session.save();
  }

  // ───── End Session (calculate cost) ─────

  async endSession(sessionId: string, userId: string): Promise<SessionDocument> {
    const session = await this.findSessionById(sessionId);

    const isParticipant =
      (session.buyerId as any)._id.toString() === userId || (session.renterId as any)._id.toString() === userId;
    if (!isParticipant) {
      throw new ForbiddenException('You are not a participant in this session');
    }

    if (session.status !== 'active') {
      throw new BadRequestException('No active session to end');
    }

    session.endTime = new Date();
    session.status = 'completed';

    // Business logic: cost = duration × price
    const durationMs = session.endTime.getTime() - session.startTime.getTime();
    const durationMinutes = Math.max(1, Math.ceil(durationMs / (1000 * 60))); // minimum 1 minute charge
    session.totalDuration = durationMinutes;
    session.totalCost = durationMinutes * session.pricePerMinute;

    await session.save();

    // Update user stats atomically
    const buyerId = (session.buyerId as any)._id.toString();
    const renterId = (session.renterId as any)._id.toString();

    await Promise.all([
      this.usersService.incrementSessions(buyerId),
      this.usersService.incrementSessions(renterId),
      this.usersService.addEarnings(renterId, session.totalCost),
      this.usersService.addSpending(buyerId, session.totalCost),
    ]);

    return session;
  }

  // ───── Cancel ─────

  async cancelSession(sessionId: string, userId: string, reason?: string): Promise<SessionDocument> {
    const session = await this.findSessionById(sessionId);

    const isParticipant =
      (session.buyerId as any)._id.toString() === userId || (session.renterId as any)._id.toString() === userId;
    if (!isParticipant) {
      throw new ForbiddenException('You are not a participant in this session');
    }

    if (['completed', 'cancelled'].includes(session.status)) {
      throw new BadRequestException(`Cannot cancel a ${session.status} session`);
    }

    session.status = 'cancelled';
    session.cancelledBy = new Types.ObjectId(userId);
    session.cancellationReason = reason || '';
    return session.save();
  }

  // ───── Queries ─────

  async getUserSessions(userId: string, role: 'buyer' | 'renter'): Promise<SessionDocument[]> {
    const query = role === 'buyer'
      ? { buyerId: new Types.ObjectId(userId) }
      : { renterId: new Types.ObjectId(userId) };

    return this.sessionModel
      .find(query)
      .sort({ createdAt: -1 })
      .populate('buyerId', 'name profilePhoto isVerified')
      .populate('renterId', 'name profilePhoto pricePerMinute isVerified')
      .exec();
  }

  async findSessionById(sessionId: string): Promise<SessionDocument> {
    if (!Types.ObjectId.isValid(sessionId)) throw new BadRequestException('Invalid session ID');
    const session = await this.sessionModel
      .findById(sessionId)
      .populate('buyerId', 'name profilePhoto')
      .populate('renterId', 'name profilePhoto pricePerMinute');
    if (!session) throw new NotFoundException('Session not found');
    return session;
  }

  async markReviewed(sessionId: string, reviewerRole: 'buyer' | 'renter'): Promise<void> {
    const update = reviewerRole === 'buyer' ? { buyerReviewed: true } : { renterReviewed: true };
    await this.sessionModel.findByIdAndUpdate(sessionId, update);
  }

  async getAllSessions(): Promise<SessionDocument[]> {
    return this.sessionModel
      .find()
      .sort({ createdAt: -1 })
      .populate('buyerId', 'name phoneNumber')
      .populate('renterId', 'name phoneNumber')
      .exec();
  }
}
