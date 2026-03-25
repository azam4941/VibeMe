import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type MessageDocument = Message & Document;

@Schema({ timestamps: true })
export class Message {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  senderId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  receiverId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'ChatRoom', required: true, index: true })
  roomId: Types.ObjectId;

  @Prop({ required: true, maxlength: 2000 })
  message: string;

  @Prop({ default: false })
  isAnonymous: boolean;

  @Prop({ default: false })
  isRead: boolean;

  @Prop({ default: 'text', enum: ['text', 'image', 'system'] })
  messageType: string;

  @Prop({ type: Date, default: Date.now, index: true })
  timestamp: Date;
}

export const MessageSchema = SchemaFactory.createForClass(Message);

MessageSchema.index({ roomId: 1, timestamp: -1 });

// ────────────────────────────────────────

export type ChatRoomDocument = ChatRoom & Document;

@Schema({ timestamps: true })
export class ChatRoom {
  @Prop({ type: [Types.ObjectId], ref: 'User', required: true })
  participants: Types.ObjectId[];

  @Prop({ default: true })
  isAnonymous: boolean;

  @Prop({ default: false })
  identityRevealed: boolean;

  @Prop({ type: [Types.ObjectId], default: [] })
  revealRequests: Types.ObjectId[];

  @Prop({ default: '' })
  lastMessage: string;

  @Prop({ type: Date })
  lastMessageAt: Date;

  @Prop({ default: 0 })
  messageCount: number;

  @Prop({ default: false })
  isBlocked: boolean; // either party blocked the other

  @Prop({ type: Types.ObjectId, ref: 'User' })
  blockedBy: Types.ObjectId;
}

export const ChatRoomSchema = SchemaFactory.createForClass(ChatRoom);

ChatRoomSchema.index({ participants: 1 });
ChatRoomSchema.index({ lastMessageAt: -1 });
