import { Controller, Get, Put, Post, Param, Body, Query, Req, UseGuards } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminGuard } from '../common/admin.guard';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { ReportUserDto, AdminUpdateReportDto } from '../common/dto';

// ═══════ Admin-only routes ═══════

@Controller('admin')
@UseGuards(AdminGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('dashboard')
  async getDashboard() {
    return this.adminService.getDashboardStats();
  }

  @Get('users')
  async getUsers() {
    return this.adminService.getAllUsers();
  }

  @Put('users/:id/block')
  async blockUser(@Param('id') id: string, @Body() body: { reason?: string }) {
    return this.adminService.blockUser(id, body?.reason);
  }

  @Put('users/:id/unblock')
  async unblockUser(@Param('id') id: string) {
    return this.adminService.unblockUser(id);
  }

  @Put('users/:id/verify')
  async verifyUser(@Param('id') id: string, @Body() body: { status: 'verified' | 'rejected' }) {
    return this.adminService.adminVerifyUser(id, body.status || 'verified');
  }

  @Get('reports')
  async getReports(@Query('status') status?: string) {
    return this.adminService.getReports(status);
  }

  @Put('reports/:id')
  async updateReport(
    @Param('id') id: string,
    @Body() dto: AdminUpdateReportDto,
    @Req() req,
  ) {
    return this.adminService.updateReport(id, dto.status, dto.adminNote || '', req.user.userId);
  }

  @Get('sessions')
  async getSessions() {
    return this.adminService.getAllSessions();
  }
}

// ═══════ Report endpoint (accessible by all authenticated users) ═══════

@Controller('reports')
@UseGuards(JwtAuthGuard)
export class ReportController {
  constructor(private readonly adminService: AdminService) {}

  @Post()
  async createReport(@Req() req, @Body() dto: ReportUserDto) {
    return this.adminService.createReport(
      req.user.userId,
      dto.reportedUserId,
      dto.reason,
      dto.details || '',
    );
  }
}
