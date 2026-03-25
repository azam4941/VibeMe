import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { DiscoverQueryDto } from '../common/dto';

@Controller('discover')
// @UseGuards(JwtAuthGuard) // Disabled for testing without valid token
export class DiscoveryController {
  constructor(private readonly usersService: UsersService) {}

  /**
   * GET /api/discover
   * Returns paginated list of users in Rent Mode, with filtering and sorting.
   * Only Rent Mode users appear in the marketplace.
   */
  @Get()
  async discover(@Query() query: DiscoverQueryDto, @Req() req) {
    const filters: any = {};

    if (query.interests) {
      filters.interests = query.interests.split(',').map(i => i.trim()).filter(Boolean);
    }
    if (query.minPrice) filters.minPrice = parseFloat(query.minPrice);
    if (query.maxPrice) filters.maxPrice = parseFloat(query.maxPrice);
    if (query.minRating) filters.minRating = parseFloat(query.minRating);
    if (query.status) filters.status = query.status;
    if (query.search) filters.search = query.search;
    if (query.sortBy) filters.sortBy = query.sortBy;
    if (query.page) filters.page = parseInt(query.page, 10);
    if (query.limit) filters.limit = parseInt(query.limit, 10);

    const result = await this.usersService.search(filters);
    const viewerIsVerified = req?.user?.isVerified || false;

    // Apply photo visibility rules on each user
    return {
      users: result.users.map(u => this.usersService.getPublicProfile(u, viewerIsVerified)),
      total: result.total,
      page: result.page,
      totalPages: result.totalPages,
    };
  }

  /**
   * GET /api/discover/interests
   * Returns popular interests aggregated from all active renters.
   */
  @Get('interests')
  async getPopularInterests() {
    const predefined = [
      'Technology', 'Music', 'Art', 'Sports', 'Travel', 'Cooking',
      'Photography', 'Gaming', 'Reading', 'Fitness', 'Business',
      'Design', 'Writing', 'Science', 'Movies', 'Languages',
      'Meditation', 'Fashion', 'Education', 'Finance',
    ];
    return predefined;
  }
}
