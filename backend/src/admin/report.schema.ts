import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ReportDocument = Report & Document;

@Schema({ timestamps: true })
export class Report {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  reportedBy: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  reportedUser: Types.ObjectId;

  @Prop({
    required: true,
    enum: ['harassment', 'spam', 'fake_profile', 'inappropriate_content', 'scam', 'other'],
  })
  reason: string;

  @Prop({ default: '', maxlength: 1000 })
  details: string;

  @Prop({
    default: 'pending',
    enum: ['pending', 'reviewed', 'resolved', 'dismissed'],
    index: true,
  })
  status: string;

  @Prop({ default: '', maxlength: 500 })
  adminNote: string;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  resolvedBy: Types.ObjectId;

  @Prop({ type: Date })
  resolvedAt: Date;
}

export const ReportSchema = SchemaFactory.createForClass(Report);

ReportSchema.index({ status: 1, createdAt: -1 });
