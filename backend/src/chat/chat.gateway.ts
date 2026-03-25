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

@WebSocketGateway({
  cors: {
    origin: ['http://localhost:5173', 'http://localhost:3000'],
    credentials: true,
  },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private connectedUsers = new Map<string, string>(); // userId -> socketId

  constructor(private chatService: ChatService) {}

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
    this.connectedUsers.set(data.userId, client.id);
    this.server.emit('user-online', { userId: data.userId });
  }

  @SubscribeMessage('join-room')
  async handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string },
  ) {
    client.join(data.roomId);
  }

  @SubscribeMessage('leave-room')
  async handleLeaveRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string },
  ) {
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
    try {
      const message = await this.chatService.sendMessage(
        data.roomId,
        data.senderId,
        data.receiverId,
        data.content,
      );

      // Broadcast to room
      this.server.to(data.roomId).emit('new-message', message);

      // Push notification to receiver if they're connected but not in the room
      const receiverSocketId = this.connectedUsers.get(data.receiverId);
      if (receiverSocketId) {
        this.server.to(receiverSocketId).emit('message-notification', {
          roomId: data.roomId,
          senderId: data.senderId,
          preview: data.content.slice(0, 100),
        });
      }
    } catch (error) {
      // Send error back to sender
      client.emit('message-error', { error: error.message || 'Failed to send message' });
    }
  }

  @SubscribeMessage('typing')
  handleTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; userId: string },
  ) {
    client.to(data.roomId).emit('user-typing', { userId: data.userId });
  }

  @SubscribeMessage('stop-typing')
  handleStopTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; userId: string },
  ) {
    client.to(data.roomId).emit('user-stop-typing', { userId: data.userId });
  }

  @SubscribeMessage('mark-read')
  async handleMarkRead(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; userId: string },
  ) {
    await this.chatService.markAsRead(data.roomId, data.userId);
    this.server.to(data.roomId).emit('messages-read', { roomId: data.roomId, userId: data.userId });
  }
}
