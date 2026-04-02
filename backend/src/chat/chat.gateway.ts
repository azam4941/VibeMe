import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ChatService } from './chat.service';
import { NotificationService } from '../notifications/notification.service';
import { Message, MessageDocument } from './chat.schema';

@WebSocketGateway({
  cors: {
    origin: '*',
    credentials: false,
  },
  transports: ['websocket', 'polling'],
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private connectedUsers = new Map<string, string>(); // userId -> socketId
  private typingTimers = new Map<string, NodeJS.Timeout>();

  constructor(
    private chatService: ChatService,
    private notificationService: NotificationService,
    @InjectModel(Message.name) private messageModel: Model<MessageDocument>,
  ) {}

  handleConnection(client: Socket) {
    console.log(`🔌 Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    for (const [userId, socketId] of this.connectedUsers.entries()) {
      if (socketId === client.id) {
        this.connectedUsers.delete(userId);
        this.server.emit('user-offline', { userId });
        console.log(`👤 User ${userId} went offline (socket ${client.id} disconnected)`);
        break;
      }
    }
    console.log(`🔌 Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('register')
  handleRegister(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { userId: string },
  ) {
    if (!data?.userId) return;
    this.connectedUsers.set(data.userId, client.id);
    client.join(`user_${data.userId}`);
    this.server.emit('user-online', { userId: data.userId });
    console.log(`✅ User registered: ${data.userId} -> socket ${client.id} (total online: ${this.connectedUsers.size})`);
  }

  @SubscribeMessage('join-room')
  async handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string },
  ) {
    if (!data?.roomId) return;
    await client.join(data.roomId);
    console.log(`📌 Socket ${client.id} joined room: ${data.roomId}`);
    // Confirm join back to client
    client.emit('room-joined', { roomId: data.roomId });
  }

  @SubscribeMessage('leave-room')
  async handleLeaveRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string },
  ) {
    if (!data?.roomId) return;
    client.leave(data.roomId);
  }

  @SubscribeMessage('send-message')
  async handleMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: {
      roomId: string;
      senderId: string;
      receiverId: string;
      content: string;
    },
  ) {
    console.log(`📨 send-message from ${client.id}:`, JSON.stringify(data).slice(0, 300));
    try {
      if (!data?.roomId || !data?.senderId || !data?.receiverId || !data?.content) {
        console.error('❌ Missing required fields:', data);
        client.emit('message-error', { error: 'Missing required fields' });
        return;
      }

      console.log(`💾 Saving message to DB: room=${data.roomId}`);
      const message = await this.chatService.sendMessage(
        data.roomId,
        data.senderId,
        data.receiverId,
        data.content,
      );
      console.log(`✅ Message saved: ${message._id}`);

      // Populate sender info before broadcasting
      const populated = await this.messageModel
        .findById(message._id)
        .populate('senderId', 'name profilePhoto')
        .lean()
        .exec();

      const msgToSend = populated || message;

      // Broadcast to everyone in the room (including sender)
      this.server.to(data.roomId).emit('new-message', msgToSend);
      console.log(`📡 Broadcast new-message to room: ${data.roomId}`);

      // Notify receiver personally (for room list updates)
      const receiverSocketId = this.connectedUsers.get(data.receiverId);
      if (receiverSocketId) {
        this.server.to(receiverSocketId).emit('message-notification', {
          roomId: data.roomId,
          senderId: data.senderId,
          preview: data.content.slice(0, 100),
        });
      }

      // Delivery confirmation to sender
      client.emit('message-sent', { messageId: message._id, roomId: data.roomId });

      // Create notification in DB
      try {
        await this.notificationService.notifyNewMessage(data.receiverId, 'Someone');
      } catch (e) {
        console.error('Failed to create notification:', e.message);
      }
    } catch (error) {
      console.error(`❌ send-message FAILED:`, error.message, error.stack?.slice(0, 200));
      client.emit('message-error', { error: error.message || 'Failed to send message' });
    }
  }

  @SubscribeMessage('typing')
  handleTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; userId: string },
  ) {
    if (!data?.roomId || !data?.userId) return;
    client.to(data.roomId).emit('user-typing', { userId: data.userId });

    const timerKey = `${data.roomId}_${data.userId}`;
    const existingTimer = this.typingTimers.get(timerKey);
    if (existingTimer) clearTimeout(existingTimer);

    this.typingTimers.set(timerKey, setTimeout(() => {
      client.to(data.roomId).emit('user-stop-typing', { userId: data.userId });
      this.typingTimers.delete(timerKey);
    }, 3000));
  }

  @SubscribeMessage('stop-typing')
  handleStopTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; userId: string },
  ) {
    if (!data?.roomId || !data?.userId) return;
    client.to(data.roomId).emit('user-stop-typing', { userId: data.userId });

    const timerKey = `${data.roomId}_${data.userId}`;
    const existingTimer = this.typingTimers.get(timerKey);
    if (existingTimer) {
      clearTimeout(existingTimer);
      this.typingTimers.delete(timerKey);
    }
  }

  @SubscribeMessage('mark-read')
  async handleMarkRead(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; userId: string },
  ) {
    if (!data?.roomId || !data?.userId) return;
    await this.chatService.markAsRead(data.roomId, data.userId);
    this.server.to(data.roomId).emit('messages-read', { roomId: data.roomId, userId: data.userId });
  }

  @SubscribeMessage('request-reveal')
  async handleRequestReveal(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; userId: string },
  ) {
    try {
      if (!data?.roomId || !data?.userId) return;
      const room = await this.chatService.requestReveal(data.roomId, data.userId);

      if (room.identityRevealed) {
        this.server.to(data.roomId).emit('identity-revealed', {
          roomId: data.roomId,
          participants: room.participants,
        });
      } else {
        this.server.to(data.roomId).emit('reveal-requested', {
          roomId: data.roomId,
          requestedBy: data.userId,
        });
      }
    } catch (error) {
      client.emit('message-error', { error: error.message });
    }
  }

  // ─── WebRTC Signaling ───

  @SubscribeMessage('call-user')
  handleCallUser(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: {
      to: string;
      from: string;
      offer: any;
      type: 'video' | 'voice';
      callerName: string;
    },
  ) {
    if (!data?.to || !data?.from || !data?.offer) {
      console.log('📞 call-user: missing data fields', { to: !!data?.to, from: !!data?.from, offer: !!data?.offer });
      return;
    }

    console.log(`📞 call-user: ${data.from} -> ${data.to} (type: ${data.type}, caller: ${data.callerName})`);
    console.log(`📞 Connected users:`, Array.from(this.connectedUsers.keys()).join(', '));

    const targetSocketId = this.connectedUsers.get(data.to);
    if (targetSocketId) {
      console.log(`📞 Forwarding incoming-call to socket ${targetSocketId}`);
      this.server.to(targetSocketId).emit('incoming-call', {
        from: data.from,
        offer: data.offer,
        type: data.type,
        callerName: data.callerName,
      });
    } else {
      console.log(`📞 Target user ${data.to} is NOT connected — sending call-unavailable`);
      client.emit('call-unavailable', { to: data.to });
    }
  }

  @SubscribeMessage('call-accepted')
  handleCallAccepted(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { to: string; from: string; answer: any },
  ) {
    if (!data?.to || !data?.answer) {
      console.log('📞 call-accepted: missing data fields', { to: !!data?.to, answer: !!data?.answer });
      return;
    }

    console.log(`📞 call-accepted: ${data.from} accepted call from ${data.to}`);

    const targetSocketId = this.connectedUsers.get(data.to);
    if (targetSocketId) {
      console.log(`📞 Forwarding call-answered to socket ${targetSocketId}`);
      this.server.to(targetSocketId).emit('call-answered', {
        from: data.from,
        answer: data.answer,
      });
    } else {
      console.log(`📞 ❌ Caller ${data.to} is no longer connected!`);
      // Notify the callee that the caller disconnected
      client.emit('call-ended', { from: data.to });
    }
  }

  @SubscribeMessage('call-rejected')
  handleCallRejected(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { to: string; from: string },
  ) {
    if (!data?.to) return;
    console.log(`📞 call-rejected: ${data.from} rejected call from ${data.to}`);
    const targetSocketId = this.connectedUsers.get(data.to);
    if (targetSocketId) {
      this.server.to(targetSocketId).emit('call-rejected', { from: data.from });
    }
  }

  @SubscribeMessage('ice-candidate')
  handleIceCandidate(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { to: string; from: string; candidate: any },
  ) {
    if (!data?.to || !data?.candidate) return;
    const targetSocketId = this.connectedUsers.get(data.to);
    if (targetSocketId) {
      this.server.to(targetSocketId).emit('ice-candidate', {
        from: data.from,
        candidate: data.candidate,
      });
    } else {
      console.log(`🧊 ICE candidate target ${data.to} not connected, dropping`);
    }
  }

  @SubscribeMessage('end-call')
  handleEndCall(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { to: string; from: string },
  ) {
    if (!data?.to) return;
    console.log(`📞 end-call: ${data.from} ending call with ${data.to}`);
    const targetSocketId = this.connectedUsers.get(data.to);
    if (targetSocketId) {
      this.server.to(targetSocketId).emit('call-ended', { from: data.from });
    }
  }
}
