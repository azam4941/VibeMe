import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AdminService } from './admin.service';
import { AdminController, ReportController } from './admin.controller';
import { Report, ReportSchema } from './report.schema';
import { UsersModule } from '../users/users.module';
import { BookingModule } from '../booking/booking.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Report.name, schema: ReportSchema }]),
    UsersModule,
    BookingModule,
  ],
  controllers: [AdminController, ReportController],
  providers: [AdminService],
})
export class AdminModule {}
