import { Controller, Get, Put, Delete, Param, Req, UseGuards } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { JwtAuthGuard } from '../common/jwt-auth.guard';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationController {
  constructor(private readonly notifService: NotificationService) {}

  @Get()
  async getAll(@Req() req) {
    return this.notifService.getUserNotifications(req.user.userId);
  }

  @Get('unread-count')
  async getUnreadCount(@Req() req) {
    const count = await this.notifService.getUnreadCount(req.user.userId);
    return { unreadCount: count };
  }

  @Put('read-all')
  async markAllRead(@Req() req) {
    await this.notifService.markAllRead(req.user.userId);
    return { success: true };
  }

  @Put(':id/read')
  async markOneRead(@Param('id') id: string) {
    await this.notifService.markOneRead(id);
    return { success: true };
  }

  @Delete(':id')
  async deleteOne(@Param('id') id: string) {
    await this.notifService.deleteOne(id);
    return { success: true };
  }
}
