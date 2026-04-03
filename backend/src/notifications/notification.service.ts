import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Model, Types } from 'mongoose';
import { Notification, NotificationDocument } from './notification.schema';

@Injectable()
export class NotificationService {
  constructor(
    @InjectModel(Notification.name) private notifModel: Model<NotificationDocument>,
    private eventEmitter: EventEmitter2,
  ) {}

  async create(
    userId: string,
    type: string,
    title: string,
    body: string,
    data: Record<string, any> = {},
  ): Promise<NotificationDocument> {
    const notif = await this.notifModel.create({
      userId: new Types.ObjectId(userId),
      type,
      title,
      body,
      data,
      isRead: false,
    });
    this.eventEmitter.emit('notification.created', notif);
    return notif;
  }

  async getUserNotifications(userId: string, limit = 50) {
    return this.notifModel
      .find({ userId: new Types.ObjectId(userId) })
      .sort({ createdAt: -1 })
      .limit(limit)
      .exec();
  }

  async getUnreadCount(userId: string): Promise<number> {
    return this.notifModel.countDocuments({
      userId: new Types.ObjectId(userId),
      isRead: false,
    });
  }

  async markAllRead(userId: string): Promise<void> {
    await this.notifModel.updateMany(
      { userId: new Types.ObjectId(userId), isRead: false },
      { isRead: true },
    );
  }

  async markOneRead(notifId: string): Promise<void> {
    await this.notifModel.findByIdAndUpdate(notifId, { isRead: true });
  }

  async deleteOne(notifId: string): Promise<void> {
    await this.notifModel.findByIdAndDelete(notifId);
  }

  // ─── Convenience methods for triggering notifications ───

  async notifyNewMessage(receiverId: string, senderName: string) {
    return this.create(
      receiverId,
      'new_message',
      'New Message',
      `${senderName} sent you a message`,
      { screen: 'Chat' },
    );
  }

  async notifySessionBooked(renterId: string, duration: number) {
    return this.create(
      renterId,
      'session_booked',
      'New Booking Request!',
      `Someone wants a ${duration} min session`,
      { screen: 'Session' },
    );
  }

  async notifyPaymentReceived(userId: string, amount: number) {
    return this.create(
      userId,
      'payment',
      'Payment Received',
      `₹${amount} added to your wallet`,
      { screen: 'Wallet' },
    );
  }

  async notifyRevealRequest(receiverId: string) {
    return this.create(
      receiverId,
      'reveal_request',
      'Identity Reveal Request',
      'Someone wants to reveal identity. Do you agree?',
      { screen: 'Chat' },
    );
  }

  async notifyNewReview(userId: string, rating: number) {
    return this.create(
      userId,
      'review',
      `New ${rating}★ Review!`,
      'Someone left you a review',
      { screen: 'Profile' },
    );
  }
}
