import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type SessionDocument = Session & Document;

@Schema({ timestamps: true })
export class Session {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  buyerId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  renterId: Types.ObjectId;

  @Prop({
    default: 'pending',
    enum: ['pending', 'accepted', 'active', 'completed', 'cancelled', 'disputed'],
    index: true,
  })
  status: string;

  @Prop({ type: Date })
  startTime: Date;

  @Prop({ type: Date })
  endTime: Date;

  @Prop({ default: 0 })
  totalDuration: number; // minutes

  @Prop({ default: 0, min: 0 })
  pricePerMinute: number; // snapshot of rate at booking time

  @Prop({ default: 0 })
  totalCost: number; // totalDuration × pricePerMinute

  @Prop({ default: false })
  isPaid: boolean;

  @Prop({ default: '' })
  paymentId: string;

  @Prop({ default: '', maxlength: 500 })
  notes: string;

  @Prop({ default: '' })
  cancellationReason: string;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  cancelledBy: Types.ObjectId;

  // Track if both parties have reviewed this session
  @Prop({ default: false })
  buyerReviewed: boolean;

  @Prop({ default: false })
  renterReviewed: boolean;
}

export const SessionSchema = SchemaFactory.createForClass(Session);

SessionSchema.index({ buyerId: 1, status: 1 });
SessionSchema.index({ renterId: 1, status: 1 });
SessionSchema.index({ createdAt: -1 });
