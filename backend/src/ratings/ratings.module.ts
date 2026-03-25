import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { RatingsService } from './ratings.service';
import { RatingsController } from './ratings.controller';
import { Review, ReviewSchema } from './rating.schema';
import { UsersModule } from '../users/users.module';
import { BookingModule } from '../booking/booking.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Review.name, schema: ReviewSchema }]),
    UsersModule,
    BookingModule,
  ],
  controllers: [RatingsController],
  providers: [RatingsService],
})
export class RatingsModule {}
