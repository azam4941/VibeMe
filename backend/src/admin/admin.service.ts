import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Report, ReportDocument } from './report.schema';
import { UsersService } from '../users/users.service';
import { BookingService } from '../booking/booking.service';

@Injectable()
export class AdminService {
  constructor(
    @InjectModel(Report.name) private reportModel: Model<ReportDocument>,
    private usersService: UsersService,
    private bookingService: BookingService,
  ) {}

  // ───── Dashboard ─────

  async getDashboardStats() {
    const [userStats, pendingReports, totalReports, totalSessions] = await Promise.all([
      this.usersService.getStats(),
      this.reportModel.countDocuments({ status: 'pending' }),
      this.reportModel.countDocuments(),
      this.bookingService.getAllSessions().then(s => s.length),
    ]);

    return {
      ...userStats,
      pendingReports,
      totalReports,
      totalSessions,
    };
  }

  // ───── User Management ─────

  async getAllUsers() {
    return this.usersService.findAll();
  }

  async blockUser(userId: string, reason: string = 'Blocked by admin') {
    return this.usersService.adminBlockUser(userId, reason);
  }

  async unblockUser(userId: string) {
    return this.usersService.adminUnblockUser(userId);
  }

  async verifyUser(userId: string) {
    return this.usersService.verifyUser(userId);
  }

  async adminVerifyUser(userId: string, status: 'verified' | 'rejected') {
    return this.usersService.adminVerify(userId, status);
  }

  // ───── Reports ─────

  async createReport(
    reportedBy: string,
    reportedUserId: string,
    reason: string,
    details: string,
  ) {
    const report = await this.reportModel.create({
      reportedBy: new Types.ObjectId(reportedBy),
      reportedUser: new Types.ObjectId(reportedUserId),
      reason,
      details: details || '',
    });

    // Increment report count on reported user (may trigger auto-block at 5+)
    await this.usersService.incrementReportCount(reportedUserId);

    return report;
  }

  async getReports(status?: string) {
    const query: any = {};
    if (status) query.status = status;

    return this.reportModel
      .find(query)
      .sort({ createdAt: -1 })
      .populate('reportedBy', 'name phoneNumber')
      .populate('reportedUser', 'name phoneNumber isBlocked reportCount')
      .populate('resolvedBy', 'name')
      .exec();
  }

  async updateReport(
    reportId: string,
    status: string,
    adminNote: string,
    adminId: string,
  ) {
    const update: any = { status, adminNote };
    if (['resolved', 'dismissed'].includes(status)) {
      update.resolvedBy = new Types.ObjectId(adminId);
      update.resolvedAt = new Date();
    }

    const report = await this.reportModel.findByIdAndUpdate(reportId, update, { new: true });
    if (!report) throw new NotFoundException('Report not found');
    return report;
  }

  // ───── Sessions (admin view) ─────

  async getAllSessions() {
    return this.bookingService.getAllSessions();
  }
}
