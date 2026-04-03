import { Controller, Get, Put, Post, Delete, Body, Param, Req, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { UpdateProfileDto, SetPriceDto, SetAvailabilityDto, ToggleRentModeDto, BlockUserDto } from '../common/dto';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // ───── Authenticated profile routes ─────

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getMyProfile(@Req() req) {
    return this.usersService.findById(req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Put('me')
  async updateMyProfile(@Req() req, @Body() dto: UpdateProfileDto) {
    return this.usersService.updateProfile(req.user.userId, dto as any);
  }

  @UseGuards(JwtAuthGuard)
  @Put('me/rent-mode')
  async toggleRentMode(@Req() req, @Body() dto: ToggleRentModeDto) {
    return this.usersService.toggleRentMode(req.user.userId, dto.rentMode);
  }

  @UseGuards(JwtAuthGuard)
  @Put('me/price')
  async setPrice(@Req() req, @Body() dto: SetPriceDto) {
    return this.usersService.setPrice(req.user.userId, dto.pricePerMinute);
  }

  @UseGuards(JwtAuthGuard)
  @Put('me/availability')
  async setAvailability(@Req() req, @Body() dto: SetAvailabilityDto) {
    return this.usersService.setAvailability(req.user.userId, dto.availability);
  }

  @UseGuards(JwtAuthGuard)
  @Put('me/verify-request')
  async requestVerification(@Req() req, @Body() dto: { idPhotoUrl: string }) {
    return this.usersService.requestVerification(req.user.userId, dto.idPhotoUrl);
  }

  // ───── User-level block (personal blocklist) ─────

  @UseGuards(JwtAuthGuard)
  @Post('me/block')
  async blockUser(@Req() req, @Body() dto: BlockUserDto) {
    return this.usersService.blockUserByUser(req.user.userId, dto.userId, dto.reason || '');
  }

  @UseGuards(JwtAuthGuard)
  @Post('me/unblock')
  async unblockUser(@Req() req, @Body() dto: { userId: string }) {
    return this.usersService.unblockUserByUser(req.user.userId, dto.userId);
  }

  // ───── Wallet ─────

  @UseGuards(JwtAuthGuard)
  @Get('me/wallet')
  async getWallet(@Req() req) {
    const user = await this.usersService.findById(req.user.userId);
    return {
      balance: user.balance,
      transactions: user.transactions,
      totalEarnings: user.totalEarnings,
      totalSpent: user.totalSpent,
    };
  }

  @UseGuards(JwtAuthGuard)
  @Post('me/wallet/add')
  async addFunds(@Req() req, @Body() dto: { amount: number }) {
    return this.usersService.addFunds(req.user.userId, dto.amount);
  }

  @UseGuards(JwtAuthGuard)
  @Post('me/wallet/withdraw')
  async withdrawFunds(@Req() req, @Body() dto: { amount: number }) {
    return this.usersService.withdrawFunds(req.user.userId, dto.amount);
  }

  // ───── Public profile — photo visibility depends on viewer verification ─────

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  async getUserById(@Param('id') id: string, @Req() req) {
    const user = await this.usersService.findById(id);

    // Check if the viewer has blocked or been blocked by this user
    const viewerBlocked = await this.usersService.isBlockedByUser(req.user.userId, id);
    const targetBlocked = await this.usersService.isBlockedByUser(id, req.user.userId);
    if (viewerBlocked || targetBlocked) {
      return { error: 'User not available', _id: id };
    }

    const viewerIsVerified = req.user.isVerified || false;
    return this.usersService.getPublicProfile(user, viewerIsVerified);
  }

  // ───── Account Pause / Delete ─────

  @UseGuards(JwtAuthGuard)
  @Put('me/pause')
  async pauseAccount(@Req() req) {
    return this.usersService.pauseAccount(req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Put('me/resume')
  async resumeAccount(@Req() req) {
    return this.usersService.resumeAccount(req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('me')
  async deleteAccount(@Req() req) {
    return this.usersService.deleteAccount(req.user.userId);
  }
}
