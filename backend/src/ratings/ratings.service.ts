import { Injectable, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Review, ReviewDocument } from './rating.schema';
import { UsersService } from '../users/users.service';
import { BookingService } from '../booking/booking.service';

@Injectable()
export class RatingsService {
  constructor(
    @InjectModel(Review.name) private reviewModel: Model<ReviewDocument>,
    private usersService: UsersService,
    private bookingService: BookingService,
  ) {}

  async createReview(
    reviewerId: string,
    targetUserId: string,
    sessionId: string,
    rating: number,
    comment: string,
  ): Promise<ReviewDocument> {
    // Validate the session exists and is completed
    const session = await this.bookingService.findSessionById(sessionId);
    if (session.status !== 'completed') {
      throw new BadRequestException('Can only review completed sessions');
    }

    // Validate reviewer was a participant in this session
    const isBuyer = session.buyerId.toString() === reviewerId;
    const isRenter = session.renterId.toString() === reviewerId;
    if (!isBuyer && !isRenter) {
      throw new ForbiddenException('You were not a participant in this session');
    }

    // Validate target was the other participant
    const expectedTarget = isBuyer
      ? session.renterId.toString()
      : session.buyerId.toString();
    if (targetUserId !== expectedTarget) {
      throw new BadRequestException('Invalid target user for this session');
    }

    // Check if already reviewed (unique index will also catch this, but better UX message)
    const existing = await this.reviewModel.findOne({
      reviewerId: new Types.ObjectId(reviewerId),
      sessionId: new Types.ObjectId(sessionId),
    });
    if (existing) {
      throw new BadRequestException('You have already reviewed this session');
    }

    // Create review
    const review = await this.reviewModel.create({
      reviewerId: new Types.ObjectId(reviewerId),
      targetUserId: new Types.ObjectId(targetUserId),
      sessionId: new Types.ObjectId(sessionId),
      rating,
      comment: comment || '',
    });

    // Update target user's average rating
    await this.usersService.updateRating(targetUserId, rating);

    // Mark session as reviewed by this party
    const role = isBuyer ? 'buyer' : 'renter';
    await this.bookingService.markReviewed(sessionId, role);

    return review;
  }

  async getUserReviews(userId: string): Promise<ReviewDocument[]> {
    return this.reviewModel
      .find({ targetUserId: new Types.ObjectId(userId), isHidden: false })
      .sort({ createdAt: -1 })
      .populate('reviewerId', 'name profilePhoto')
      .exec();
  }

  async getSessionReviews(sessionId: string): Promise<ReviewDocument[]> {
    return this.reviewModel
      .find({ sessionId: new Types.ObjectId(sessionId), isHidden: false })
      .populate('reviewerId', 'name profilePhoto')
      .exec();
  }

  // Admin: hide abusive review
  async hideReview(reviewId: string): Promise<ReviewDocument> {
    const review = await this.reviewModel.findByIdAndUpdate(
      reviewId,
      { isHidden: true },
      { new: true },
    );
    if (!review) throw new NotFoundException('Review not found');
    return review;
  }
}
