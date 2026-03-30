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
import { ChatService } from './chat.service';
import { NotificationService } from '../notifications/notification.service';

@WebSocketGateway({
  cors: {
    origin: '*', // Allow all origins explicitly for Capacitor mobile webview
  },
  transports: ['websocket', 'polling'],
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private connectedUsers = new Map<string, string>(); // userId -> socketId
  private typingTimers = new Map<string, NodeJS.Timeout>(); // key -> timer

  constructor(
    private chatService: ChatService,
    private notificationService: NotificationService,
  ) {}

  handleConnection(client: Socket) {
    console.log(`🔌 Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    for (const [userId, socketId] of this.connectedUsers.entries()) {
      if (socketId === client.id) {
        this.connectedUsers.delete(userId);
        this.server.emit('user-offline', { userId });
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
    // Join user's personal notification room
    client.join(`user_${data.userId}`);
    this.server.emit('user-online', { userId: data.userId });
    console.log(`✅ User registered: ${data.userId}`);
  }

  @SubscribeMessage('join-room')
  async handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string },
  ) {
    if (!data?.roomId) return;
    client.join(data.roomId);
    console.log(`📌 Socket ${client.id} joined room: ${data.roomId}`);
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

      // Broadcast to everyone in the room (including sender)
      this.server.to(data.roomId).emit('new-message', message);
      console.log(`📡 Broadcast new-message to room: ${data.roomId}`);

      // Also notify receiver in their personal room (for room list updates)
      const receiverSocketId = this.connectedUsers.get(data.receiverId);
      if (receiverSocketId) {
        this.server.to(receiverSocketId).emit('message-notification', {
          roomId: data.roomId,
          senderId: data.senderId,
          preview: data.content.slice(0, 100),
        });
      }

      // Emit delivery confirmation back to sender
      client.emit('message-sent', { messageId: message._id, roomId: data.roomId });

      // Create a real notification in DB
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

    // Auto-stop typing after 3 seconds
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
        // Both users agreed, broadcast reveal to room
        this.server.to(data.roomId).emit('identity-revealed', {
          roomId: data.roomId,
          participants: room.participants,
        });
      } else {
        // Only one user requested, notify the other
        this.server.to(data.roomId).emit('reveal-requested', {
          roomId: data.roomId,
          requestedBy: data.userId,
        });
      }
    } catch (error) {
      client.emit('message-error', { error: error.message });
    }
  }
}
