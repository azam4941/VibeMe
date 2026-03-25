import { Controller, Get, Post, Param, Body, Req, UseGuards, Query, Put } from '@nestjs/common';
import { ChatService } from './chat.service';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { CreateRoomDto } from '../common/dto';

@Controller('chat')
@UseGuards(JwtAuthGuard)
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get('rooms')
  async getRooms(@Req() req) {
    return this.chatService.getUserRooms(req.user.userId);
  }

  @Post('rooms')
  async createRoom(@Req() req, @Body() dto: CreateRoomDto) {
    return this.chatService.getOrCreateRoom(req.user.userId, dto.userId);
  }

  @Get('rooms/:roomId/messages')
  async getMessages(
    @Param('roomId') roomId: string,
    @Query('limit') limit?: string,
    @Query('skip') skip?: string,
  ) {
    return this.chatService.getMessages(
      roomId,
      limit ? Number(limit) : 50,
      skip ? Number(skip) : 0,
    );
  }

  @Post('rooms/:roomId/reveal')
  async requestReveal(@Param('roomId') roomId: string, @Req() req) {
    return this.chatService.requestReveal(roomId, req.user.userId);
  }

  @Post('rooms/:roomId/read')
  async markAsRead(@Param('roomId') roomId: string, @Req() req) {
    await this.chatService.markAsRead(roomId, req.user.userId);
    return { success: true };
  }

  @Get('unread')
  async getUnreadCount(@Req() req) {
    const count = await this.chatService.getUnreadCount(req.user.userId);
    return { unreadCount: count };
  }

  @Put('rooms/:roomId/block')
  async blockRoom(@Param('roomId') roomId: string, @Req() req) {
    return this.chatService.blockRoom(roomId, req.user.userId);
  }
}
