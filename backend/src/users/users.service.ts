import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User, UserDocument } from './user.schema';

@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private userModel: Model<UserDocument>) {}

  // ───── Core CRUD ─────

  async findByPhone(phoneNumber: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ phoneNumber });
  }

  async findById(id: string): Promise<UserDocument> {
    if (!Types.ObjectId.isValid(id)) throw new BadRequestException('Invalid user ID');
    const user = await this.userModel.findById(id);
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async create(data: Partial<User>): Promise<UserDocument> {
    return this.userModel.create(data);
  }

  async update(id: string, data: Partial<User>): Promise<UserDocument> {
    if (!Types.ObjectId.isValid(id)) throw new BadRequestException('Invalid user ID');
    const user = await this.userModel.findByIdAndUpdate(id, data, { new: true, runValidators: true });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async updateLastActive(id: string): Promise<void> {
    await this.userModel.findByIdAndUpdate(id, { lastActiveAt: new Date() });
  }

  // ───── Profile ─────

  async updateProfile(id: string, updates: Partial<User>): Promise<UserDocument> {
    // Only allow safe fields
    const allowed: Record<string, any> = {};
    const safeFields = ['name', 'bio', 'interests', 'findInterests', 'professionalInterests', 'location', 'profilePhoto', 'isPhotoLocked', 'currentStatus', 'rentMode', 'pricePerMinute'];
    for (const key of safeFields) {
      if (updates[key] !== undefined) allowed[key] = updates[key];
    }
    return this.update(id, allowed);
  }

  /**
   * Returns a public-safe version of the user profile.
   * If the viewer is NOT verified, profile photo is hidden when locked.
   */
  getPublicProfile(user: UserDocument, viewerIsVerified: boolean): Record<string, any> {
    const showPhoto = !user.isPhotoLocked || viewerIsVerified;
    return {
      _id: user._id,
      name: user.name,
      bio: user.bio,
      interests: user.interests,
      findInterests: user.findInterests,
      professionalInterests: user.professionalInterests,
      location: user.location,
      profilePhoto: showPhoto ? user.profilePhoto : '',
      isPhotoLocked: user.isPhotoLocked,
      isVerified: user.isVerified,
      rentMode: user.rentMode,
      pricePerMinute: user.pricePerMinute,
      availability: user.availability,
      currentStatus: user.currentStatus,
      rating: user.rating,
      totalRatingsCount: user.totalRatingsCount,
      totalSessions: user.totalSessions,
    };
  }

  // ───── Rent Mode ─────

  async toggleRentMode(id: string, rentMode: boolean): Promise<UserDocument> {
    const user = await this.findById(id);
    if (rentMode && user.pricePerMinute < 0) {
      throw new BadRequestException('Price cannot be negative');
    }
    user.rentMode = rentMode;
    if (rentMode) {
      user.currentStatus = 'online';
    }
    return user.save();
  }

  async setPrice(id: string, pricePerMinute: number): Promise<UserDocument> {
    if (pricePerMinute < 0) throw new BadRequestException('Price cannot be negative');
    return this.update(id, { pricePerMinute } as any);
  }

  async setAvailability(id: string, availability: any[]): Promise<UserDocument> {
    // Validate time slots: start < end
    for (const slot of availability) {
      if (slot.startTime >= slot.endTime) {
        throw new BadRequestException(`Invalid time slot: ${slot.day} ${slot.startTime}-${slot.endTime}`);
      }
    }
    return this.update(id, { availability } as any);
  }

  // ───── Discovery / Search ─────

  async search(filters: {
    interests?: string[];
    minPrice?: number;
    maxPrice?: number;
    minRating?: number;
    status?: string;
    search?: string;
    sortBy?: string;
    page?: number;
    limit?: number;
  }): Promise<{ users: UserDocument[]; total: number; page: number; totalPages: number }> {
    const query: any = { isBlocked: { $ne: true } };

    if (filters.interests && filters.interests.length > 0) {
      query.interests = { $in: filters.interests };
    }

    if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
      query.pricePerMinute = {};
      if (filters.minPrice !== undefined) query.pricePerMinute.$gte = filters.minPrice;
      if (filters.maxPrice !== undefined) query.pricePerMinute.$lte = filters.maxPrice;
    }

    if (filters.status) {
      query.currentStatus = filters.status;
    }

    if (filters.minRating !== undefined) {
      query.rating = { $gte: filters.minRating };
    }

    if (filters.search) {
      query.$or = [
        { name: { $regex: filters.search, $options: 'i' } },
        { bio: { $regex: filters.search, $options: 'i' } },
      ];
    }

    // Sort
    let sort: any = { rating: -1 }; // default: best rated
    if (filters.sortBy === 'price_asc') sort = { pricePerMinute: 1 };
    else if (filters.sortBy === 'price_desc') sort = { pricePerMinute: -1 };
    else if (filters.sortBy === 'sessions') sort = { totalSessions: -1 };

    // Pagination
    const page = Math.max(1, filters.page || 1);
    const limit = Math.min(50, Math.max(1, filters.limit || 20));
    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      this.userModel.find(query).sort(sort).skip(skip).limit(limit).exec(),
      this.userModel.countDocuments(query),
    ]);

    return {
      users,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  // ───── Ratings ─────

  async updateRating(userId: string, newRating: number): Promise<void> {
    const user = await this.findById(userId);
    const count = user.totalRatingsCount + 1;
    const avg = ((user.rating * user.totalRatingsCount) + newRating) / count;
    user.rating = Math.round(avg * 10) / 10;
    user.totalRatingsCount = count;
    await user.save();
  }

  async incrementSessions(userId: string): Promise<void> {
    await this.userModel.findByIdAndUpdate(userId, { $inc: { totalSessions: 1 } });
  }

  async addEarnings(userId: string, amount: number, description: string = 'Session earnings'): Promise<void> {
    await this.userModel.findByIdAndUpdate(userId, { 
      $inc: { totalEarnings: amount, balance: amount },
      $push: { transactions: { type: 'credit', amount, description, createdAt: new Date() } }
    });
  }

  async addSpending(userId: string, amount: number, description: string = 'Session payment'): Promise<void> {
    const user = await this.findById(userId);
    if (user.balance < amount) throw new BadRequestException('Insufficient balance');
    
    await this.userModel.findByIdAndUpdate(userId, { 
      $inc: { totalSpent: amount, balance: -amount },
      $push: { transactions: { type: 'debit', amount, description, createdAt: new Date() } }
    });
  }

  async addFunds(userId: string, amount: number): Promise<UserDocument> {
    if (amount <= 0) throw new BadRequestException('Amount must be positive');
    return this.userModel.findByIdAndUpdate(userId, {
      $inc: { balance: amount },
      $push: { transactions: { type: 'credit', amount, description: 'Added funds to wallet', createdAt: new Date() } }
    }, { new: true });
  }

  async withdrawFunds(userId: string, amount: number): Promise<UserDocument> {
    const user = await this.findById(userId);
    if (amount <= 0) throw new BadRequestException('Amount must be positive');
    if (user.balance < amount) throw new BadRequestException('Insufficient balance');
    
    await this.userModel.findByIdAndUpdate(userId, {
      $inc: { balance: -amount },
      $push: { transactions: { type: 'debit', amount, description: 'Withdrawal from wallet', createdAt: new Date() } }
    });
    return this.findById(userId);
  }

  // ───── Safety: Block/Report ─────

  async blockUserByUser(blockerId: string, targetId: string, reason: string): Promise<UserDocument> {
    if (blockerId === targetId) throw new BadRequestException('Cannot block yourself');
    const blocker = await this.findById(blockerId);

    const alreadyBlocked = blocker.blockedUsers.some(
      b => b.userId.toString() === targetId,
    );
    if (alreadyBlocked) throw new BadRequestException('User already blocked');

    blocker.blockedUsers.push({
      userId: new Types.ObjectId(targetId),
      reason,
      blockedAt: new Date(),
    });
    return blocker.save();
  }

  async unblockUserByUser(blockerId: string, targetId: string): Promise<UserDocument> {
    const blocker = await this.findById(blockerId);
    blocker.blockedUsers = blocker.blockedUsers.filter(
      b => b.userId.toString() !== targetId,
    );
    return blocker.save();
  }

  async isBlockedByUser(userId: string, targetId: string): Promise<boolean> {
    const user = await this.findById(userId);
    return user.blockedUsers.some(b => b.userId.toString() === targetId);
  }

  async incrementReportCount(userId: string): Promise<void> {
    const user = await this.userModel.findByIdAndUpdate(
      userId,
      { $inc: { reportCount: 1 } },
      { new: true },
    );
    // Auto-block if reported ≥ 5 times
    if (user && user.reportCount >= 5 && !user.isBlocked) {
      user.isBlocked = true;
      user.blockReason = 'Auto-blocked: received 5+ reports';
      await user.save();
    }
  }

  // ───── Admin ─────

  async adminBlockUser(id: string, reason: string): Promise<UserDocument> {
    return this.update(id, { isBlocked: true, blockReason: reason } as any);
  }

  async adminUnblockUser(id: string): Promise<UserDocument> {
    return this.update(id, { isBlocked: false, blockReason: '', reportCount: 0 } as any);
  }

  async verifyUser(id: string): Promise<UserDocument> {
    return this.update(id, { isVerified: true, verificationStatus: 'verified' } as any);
  }

  async requestVerification(id: string, idPhotoUrl: string): Promise<UserDocument> {
    return this.update(id, { verificationStatus: 'pending', idPhotoUrl } as any);
  }

  async adminVerify(id: string, status: 'verified' | 'rejected'): Promise<UserDocument> {
    const isVerified = status === 'verified';
    return this.update(id, { isVerified, verificationStatus: status } as any);
  }

  async findAll(query: any = {}): Promise<UserDocument[]> {
    return this.userModel.find(query).sort({ createdAt: -1 }).exec();
  }

  async getStats(): Promise<any> {
    const [total, verified, renters, blocked, online] = await Promise.all([
      this.userModel.countDocuments(),
      this.userModel.countDocuments({ isVerified: true }),
      this.userModel.countDocuments({ rentMode: true }),
      this.userModel.countDocuments({ isBlocked: true }),
      this.userModel.countDocuments({ currentStatus: 'online' }),
    ]);
    return { total, verified, renters, blocked, online };
  }
}
