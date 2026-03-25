import { Controller, Post, Get, Param, Body, Req, UseGuards } from '@nestjs/common';
import { RatingsService } from './ratings.service';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { CreateReviewDto } from '../common/dto';

@Controller('reviews')
@UseGuards(JwtAuthGuard)
export class RatingsController {
  constructor(private readonly ratingsService: RatingsService) {}

  @Post()
  async createReview(@Req() req, @Body() dto: CreateReviewDto) {
    return this.ratingsService.createReview(
      req.user.userId,
      dto.targetUserId,
      dto.sessionId,
      dto.rating,
      dto.comment || '',
    );
  }

  @Get('user/:userId')
  async getUserReviews(@Param('userId') userId: string) {
    return this.ratingsService.getUserReviews(userId);
  }

  @Get('session/:sessionId')
  async getSessionReviews(@Param('sessionId') sessionId: string) {
    return this.ratingsService.getSessionReviews(sessionId);
  }
}
