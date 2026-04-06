import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type UserDocument = User & Document;

/** Represents a single availability time slot */
@Schema({ _id: false })
export class TimeSlot {
  @Prop({ required: true, enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] })
  day: string;

  @Prop({ required: true })
  startTime: string; // "09:00"

  @Prop({ required: true })
  endTime: string; // "17:00"
}

export const TimeSlotSchema = SchemaFactory.createForClass(TimeSlot);

/** Tracks blocked users for safety */
@Schema({ _id: false })
export class BlockedEntry {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ default: '' })
  reason: string;

  @Prop({ type: Date, default: Date.now })
  blockedAt: Date;
}

export const BlockedEntrySchema = SchemaFactory.createForClass(BlockedEntry);

/** Represents a wallet transaction */
@Schema({ _id: false })
export class Transaction {
  @Prop({ required: true, enum: ['credit', 'debit'] })
  type: string;

  @Prop({ required: true })
  amount: number;

  @Prop({ required: true })
  description: string;

  @Prop({ type: Date, default: Date.now })
  createdAt: Date;
}

export const TransactionSchema = SchemaFactory.createForClass(Transaction);

@Schema({ timestamps: true })
export class User {
  // ───── Identity ─────
  @Prop({ required: true, unique: true, index: true })
  phoneNumber: string;

  @Prop({ required: true, minlength: 2, maxlength: 50 })
  name: string;

  @Prop({ default: '', maxlength: 500 })
  bio: string;

  @Prop({ type: [String], default: [], validate: { validator: (v: string[]) => v.length <= 10, message: 'Max 10 interests allowed' } })
  interests: string[];

  @Prop({ type: [String], default: [], validate: { validator: (v: string[]) => v.length <= 10, message: 'Max 10 find interests allowed' } })
  findInterests: string[];

  @Prop({ type: [String], default: [], validate: { validator: (v: string[]) => v.length <= 10, message: 'Max 10 professional interests allowed' } })
  professionalInterests: string[];

  @Prop({ default: '' })
  location: string;

  // ───── Profile Photo (locked/unlocked) ─────
  @Prop({ default: '' })
  profilePhoto: string;

  @Prop({ default: false })
  isPhotoLocked: boolean; // false = everyone can see

  // ───── Verification ─────
  @Prop({ default: false })
  isVerified: boolean;

  @Prop({ default: 'none', enum: ['none', 'pending', 'verified', 'rejected'] })
  verificationStatus: string;

  @Prop({ default: '' })
  idPhotoUrl: string; // for KYC/Identity check

  @Prop({ default: false })
  isAdmin: boolean;

  @Prop({ default: false })
  isBlocked: boolean;

  @Prop({ default: '' })
  blockReason: string;

  // ───── Account Status ─────
  @Prop({ default: 'active', enum: ['active', 'paused', 'deleted'] })
  accountStatus: string;

  @Prop({ type: Date })
  pausedAt: Date;

  @Prop({ type: Date })
  deletedAt: Date;

  // ───── Rent Mode ─────
  @Prop({ default: false })
  rentMode: boolean;

  @Prop({ default: 0, min: 0 })
  pricePerMinute: number;

  // ───── Availability (structured time slots) ─────
  @Prop({ type: [TimeSlotSchema], default: [] })
  availability: TimeSlot[];

  @Prop({ default: 'offline', enum: ['online', 'busy', 'offline'] })
  currentStatus: string;

  // ───── Statistics ─────
  @Prop({ default: 0, min: 0, max: 5 })
  rating: number;

  @Prop({ default: 0 })
  totalRatingsCount: number;

  @Prop({ default: 0 })
  totalSessions: number;

  @Prop({ default: 0 })
  totalEarnings: number;

  @Prop({ default: 0 })
  totalSpent: number;

  @Prop({ default: 0 })
  balance: number;

  @Prop({ type: [TransactionSchema], default: [] })
  transactions: Transaction[];

  // ───── Safety ─────
  @Prop({ type: [BlockedEntrySchema], default: [] })
  blockedUsers: BlockedEntry[];

  @Prop({ default: 0 })
  reportCount: number; // how many times this user has been reported

  @Prop({ type: Date })
  lastActiveAt: Date;

  @Prop({ default: '' })
  fcmToken: string;
}

export const UserSchema = SchemaFactory.createForClass(User);

// Indexes for performance
UserSchema.index({ rentMode: 1, isBlocked: 1, currentStatus: 1, accountStatus: 1 });
UserSchema.index({ interests: 1 });
UserSchema.index({ pricePerMinute: 1 });
UserSchema.index({ rating: -1 });
UserSchema.index({ accountStatus: 1 });
