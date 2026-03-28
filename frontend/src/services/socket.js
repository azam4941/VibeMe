import { io } from 'socket.io-client';
import { getServerBase } from './api';

const SOCKET_URL = getServerBase();

class SocketService {
  socket = null;

  connect() {
    if (this.socket?.connected) return this.socket;

    console.log('🔌 Connecting to socket at:', SOCKET_URL);
    
    this.socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 10000,
    });

    this.socket.on('connect', () => {
      console.log('🔌 Socket connected:', this.socket.id);
      const user = JSON.parse(localStorage.getItem('ct_user'));
      if (user?._id) this.register(user._id);
    });

    this.socket.on('disconnect', (reason) => {
      console.log('🔌 Socket disconnected:', reason);
    });

    this.socket.on('connect_error', (err) => {
      console.warn('🔌 Socket connection error:', err.message);
    });

    this.socket.on('reconnect', (attempt) => {
      console.log('🔌 Socket reconnected after', attempt, 'attempts');
      const user = JSON.parse(localStorage.getItem('ct_user'));
      if (user?._id) this.register(user._id);
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

  offNewMessage() {
    this.socket?.off('new-message');
  }

  onMessageSent(callback) {
    this.socket?.on('message-sent', callback);
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

  // Identity reveal
  requestReveal(roomId, userId) {
    this.socket?.emit('request-reveal', { roomId, userId });
  }

  onRevealRequested(callback) {
    this.socket?.on('reveal-requested', callback);
  }

  onIdentityRevealed(callback) {
    this.socket?.on('identity-revealed', callback);
  }

  disconnect() {
    this.socket?.disconnect();
    this.socket = null;
  }

  removeAllListeners() {
    this.socket?.removeAllListeners();
  }

  isConnected() {
    return this.socket?.connected || false;
  }
}

export const socketService = new SocketService();
export default socketService;
