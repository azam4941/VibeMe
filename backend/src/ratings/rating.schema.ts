import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ReviewDocument = Review & Document;

@Schema({ timestamps: true })
export class Review {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  reviewerId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  targetUserId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Session', required: true })
  sessionId: Types.ObjectId;

  @Prop({ required: true, min: 1, max: 5 })
  rating: number;

  @Prop({ default: '', maxlength: 1000 })
  comment: string;

  @Prop({ default: false })
  isHidden: boolean; // admin can hide abusive reviews
}

export const ReviewSchema = SchemaFactory.createForClass(Review);

// Prevent duplicate reviews: one review per user per session
ReviewSchema.index({ reviewerId: 1, sessionId: 1 }, { unique: true });
ReviewSchema.index({ targetUserId: 1, createdAt: -1 });
