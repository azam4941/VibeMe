import { Controller, Get, Post, Put, Param, Body, Req, Query, UseGuards } from '@nestjs/common';
import { BookingService } from './booking.service';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { CreateSessionDto } from '../common/dto';

@Controller('sessions')
@UseGuards(JwtAuthGuard)
export class BookingController {
  constructor(private readonly bookingService: BookingService) {}

  @Post()
  async createSession(@Req() req, @Body() dto: CreateSessionDto) {
    return this.bookingService.createSession(req.user.userId, dto.renterId, dto.notes);
  }

  @Put(':id/accept')
  async accept(@Param('id') id: string, @Req() req) {
    return this.bookingService.acceptSession(id, req.user.userId);
  }

  @Put(':id/start')
  async start(@Param('id') id: string, @Req() req) {
    return this.bookingService.startSession(id, req.user.userId);
  }

  @Put(':id/end')
  async end(@Param('id') id: string, @Req() req) {
    return this.bookingService.endSession(id, req.user.userId);
  }

  @Put(':id/cancel')
  async cancel(@Param('id') id: string, @Req() req, @Body() body: { reason?: string }) {
    return this.bookingService.cancelSession(id, req.user.userId, body?.reason);
  }

  @Get('my')
  async mySessions(@Req() req, @Query('role') role: 'buyer' | 'renter') {
    return this.bookingService.getUserSessions(req.user.userId, role || 'buyer');
  }

  @Get(':id')
  async getSession(@Param('id') id: string) {
    return this.bookingService.findSessionById(id);
  }
}
