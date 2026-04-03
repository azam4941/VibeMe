import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Message, MessageDocument, ChatRoom, ChatRoomDocument } from './chat.schema';
import { UsersService } from '../users/users.service';
import { ModerationService } from '../common/moderation.service';

@Injectable()
export class ChatService {
  constructor(
    @InjectModel(Message.name) private messageModel: Model<MessageDocument>,
    @InjectModel(ChatRoom.name) private chatRoomModel: Model<ChatRoomDocument>,
    private usersService: UsersService,
    private moderationService: ModerationService,
  ) {}

  // ───── Rooms ─────

  async getOrCreateRoom(userId1: string, userId2: string): Promise<ChatRoomDocument> {
    if (userId1 === userId2) {
      throw new BadRequestException('Cannot create a chat room with yourself');
    }

    // Check if either user has blocked the other
    const blocked1 = await this.usersService.isBlockedByUser(userId1, userId2);
    const blocked2 = await this.usersService.isBlockedByUser(userId2, userId1);
    if (blocked1 || blocked2) {
      throw new ForbiddenException('Cannot initiate chat with this user');
    }

    const existing = await this.chatRoomModel.findOne({
      participants: {
        $all: [new Types.ObjectId(userId1), new Types.ObjectId(userId2)],
      },
    }).populate('participants', 'name profilePhoto isVerified');

    if (existing) {
      if (existing.isBlocked) {
        throw new ForbiddenException('This conversation has been blocked');
      }
      return existing;
    }

    const room = await this.chatRoomModel.create({
      participants: [new Types.ObjectId(userId1), new Types.ObjectId(userId2)],
      isAnonymous: true,
    });

    return this.chatRoomModel
      .findById(room._id)
      .populate('participants', 'name profilePhoto isVerified')
      .exec();
  }

  async getUserRooms(userId: string): Promise<any[]> {
    const rooms = await this.chatRoomModel
      .find({
        participants: new Types.ObjectId(userId),
        isBlocked: false,
      })
      .sort({ lastMessageAt: -1 })
      .populate('participants', 'name profilePhoto isVerified currentStatus')
      .lean()
      .exec();

    // Add unread count to each room
    return Promise.all(rooms.map(async (room) => {
      const unreadCount = await this.messageModel.countDocuments({
        roomId: room._id,
        receiverId: new Types.ObjectId(userId),
        isRead: false,
      });
      return { ...room, unreadCount };
    }));
  }

  async getRoomById(roomId: string, userId: string): Promise<ChatRoomDocument> {
    const room = await this.chatRoomModel
      .findById(roomId)
      .populate('participants', 'name profilePhoto isVerified currentStatus')
      .exec();
    
    if (!room) throw new NotFoundException('Room not found');
    
    const isParticipant = room.participants.some(p => p._id.toString() === userId);
    if (!isParticipant) throw new ForbiddenException('You are not in this chat room');
    
    return room;
  }

  // ───── Messages ─────

  async sendMessage(
    roomId: string,
    senderId: string,
    receiverId: string,
    messageText: string,
  ): Promise<MessageDocument> {
    if (!messageText || messageText.trim().length === 0) {
      throw new BadRequestException('Message cannot be empty');
    }
    if (messageText.length > 2000) {
      throw new BadRequestException('Message too long (max 2000 characters)');
    }

    const room = await this.chatRoomModel.findById(roomId);
    if (!room) throw new NotFoundException('Chat room not found');
    if (room.isBlocked) throw new ForbiddenException('This conversation has been blocked');

    // Verify sender is a participant
    const isParticipant = room.participants.some(p => p.toString() === senderId);
    if (!isParticipant) throw new ForbiddenException('You are not in this chat room');

    // AI-based Message Moderation
    const moderationResult = await this.moderationService.moderateMessage(messageText);
    if (moderationResult.isFlagged) {
      throw new BadRequestException(
        `Message blocked for safety: ${moderationResult.reason}. Please maintain a safe environment.`,
      );
    }

    const msg = await this.messageModel.create({
      senderId: new Types.ObjectId(senderId),
      receiverId: new Types.ObjectId(receiverId),
      roomId: new Types.ObjectId(roomId),
      message: messageText.trim(),
      isAnonymous: room.isAnonymous,
      timestamp: new Date(),
    });

    // Update room metadata
    await this.chatRoomModel.findByIdAndUpdate(roomId, {
      lastMessage: messageText.trim().slice(0, 100),
      lastMessageAt: new Date(),
      $inc: { messageCount: 1 },
    });

    return msg;
  }

  async getMessages(roomId: string, limit = 50, skip = 0): Promise<MessageDocument[]> {
    if (!Types.ObjectId.isValid(roomId)) throw new BadRequestException('Invalid room ID');

    const safeLimit = Math.min(100, Math.max(1, limit));

    return this.messageModel
      .find({ roomId: new Types.ObjectId(roomId) })
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(safeLimit)
      .populate('senderId', 'name profilePhoto')
      .exec();
  }

  // ───── Identity Reveal ─────

  async requestReveal(roomId: string, userId: string): Promise<ChatRoomDocument> {
    const room = await this.chatRoomModel.findById(roomId);
    if (!room) throw new NotFoundException('Room not found');

    if (room.identityRevealed) {
      throw new BadRequestException('Identities are already revealed');
    }

    const isParticipant = room.participants.some(p => p.toString() === userId);
    if (!isParticipant) throw new ForbiddenException('You are not in this chat room');

    const userObjId = new Types.ObjectId(userId);

    if (!room.revealRequests.some(id => id.equals(userObjId))) {
      room.revealRequests.push(userObjId);
    }

    // Both participants requested → reveal identities
    if (room.revealRequests.length >= 2) {
      room.isAnonymous = false;
      room.identityRevealed = true;
    }

    return room.save();
  }

  // ───── Read Receipts ─────

  async markAsRead(roomId: string, userId: string): Promise<void> {
    await this.messageModel.updateMany(
      {
        roomId: new Types.ObjectId(roomId),
        receiverId: new Types.ObjectId(userId),
        isRead: false,
      },
      { isRead: true },
    );
  }

  async getUnreadCount(userId: string): Promise<number> {
    return this.messageModel.countDocuments({
      receiverId: new Types.ObjectId(userId),
      isRead: false,
    });
  }

  // ───── Room-level Blocking ─────

  async blockRoom(roomId: string, userId: string): Promise<ChatRoomDocument> {
    const room = await this.chatRoomModel.findById(roomId);
    if (!room) throw new NotFoundException('Room not found');

    const isParticipant = room.participants.some(p => p.toString() === userId);
    if (!isParticipant) throw new ForbiddenException('You are not in this chat room');

    room.isBlocked = true;
    room.blockedBy = new Types.ObjectId(userId);
    return room.save();
  }
}
