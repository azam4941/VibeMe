import { io } from 'socket.io-client';
import { getServerBase } from './api';

const SOCKET_URL = getServerBase();

class SocketService {
  socket = null;

  connect() {
    if (this.socket?.connected) return this.socket;

    this.socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      autoConnect: true,
    });

    this.socket.on('connect', () => {
      const user = JSON.parse(localStorage.getItem('ct_user'));
      if (user?._id) this.register(user._id);
      console.log('🔌 Connected to server');
    });

    this.socket.on('disconnect', () => {
      console.log('🔌 Disconnected from server');
    });

    return this.socket;
  }

  register(userId) {
    this.socket?.emit('register', { userId });
  }

  joinRoom(roomId) {
    this.socket?.emit('join-room', { roomId });
  }

  leaveRoom(roomId) {
    this.socket?.emit('leave-room', { roomId });
  }

  sendMessage(data) {
    this.socket?.emit('send-message', data);
  }

  onNewMessage(callback) {
    this.socket?.on('new-message', callback);
  }

  onMessageNotification(callback) {
    this.socket?.on('message-notification', callback);
  }

  onUserTyping(callback) {
    this.socket?.on('user-typing', callback);
  }

  onUserStopTyping(callback) {
    this.socket?.on('user-stop-typing', callback);
  }

  emitTyping(roomId, userId) {
    this.socket?.emit('typing', { roomId, userId });
  }

  emitStopTyping(roomId, userId) {
    this.socket?.emit('stop-typing', { roomId, userId });
  }

  onUserOnline(callback) {
    this.socket?.on('user-online', callback);
  }

  onUserOffline(callback) {
    this.socket?.on('user-offline', callback);
  }

  markRead(roomId, userId) {
    this.socket?.emit('mark-read', { roomId, userId });
  }

  onMessagesRead(callback) {
    this.socket?.on('messages-read', callback);
  }

  onMessageError(callback) {
    this.socket?.on('message-error', callback);
  }

  disconnect() {
    this.socket?.disconnect();
    this.socket = null;
  }

  removeAllListeners() {
    this.socket?.removeAllListeners();
  }
}

export const socketService = new SocketService();
export default socketService;
