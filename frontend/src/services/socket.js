import { io } from 'socket.io-client';
import { getServerBase } from './api';

const SOCKET_URL = getServerBase();

class SocketService {
  socket = null;
  _pendingListeners = []; // Queue listeners if socket not ready yet

  connect() {
    if (this.socket?.connected) return this.socket;
    
    // Destroy any stale socket
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }

    console.log('🔌 Connecting to socket at:', SOCKET_URL);
    
    this.socket = io(SOCKET_URL, {
      transports: ['polling', 'websocket'], // Start with polling for reliability
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
      forceNew: true,
    });

    this.socket.on('connect', () => {
      console.log('✅ Socket connected:', this.socket.id);
      const user = JSON.parse(localStorage.getItem('ct_user') || 'null');
      if (user?._id) this.register(user._id);
      
      // Replay any pending listeners
      this._pendingListeners.forEach(({ event, cb }) => {
        this.socket.on(event, cb);
      });
      this._pendingListeners = [];
    });

    this.socket.on('disconnect', (reason) => {
      console.log('🔌 Socket disconnected:', reason);
    });

    this.socket.on('connect_error', (err) => {
      console.warn('🔌 Socket connection error:', err.message);
    });

    this.socket.io.on('reconnect', (attempt) => {
      console.log('🔌 Socket reconnected after', attempt, 'attempts');
      const user = JSON.parse(localStorage.getItem('ct_user') || 'null');
      if (user?._id) this.register(user._id);
    });

    return this.socket;
  }

  // Safe event listener — handles case where socket isn't ready yet
  _on(event, callback) {
    if (this.socket) {
      this.socket.on(event, callback);
    } else {
      this._pendingListeners.push({ event, cb: callback });
    }
  }

  _off(event, callback) {
    if (this.socket) {
      if (callback) {
        this.socket.off(event, callback);
      } else {
        this.socket.off(event);
      }
    }
    this._pendingListeners = this._pendingListeners.filter(l => l.event !== event);
  }

  register(userId) {
    this.socket?.emit('register', { userId });
  }

  joinRoom(roomId) {
    if (this.socket?.connected) {
      this.socket.emit('join-room', { roomId });
    } else {
      // Queue it for after connection
      const handler = () => {
        this.socket.emit('join-room', { roomId });
        this.socket.off('connect', handler);
      };
      this.socket?.on('connect', handler);
    }
  }

  leaveRoom(roomId) {
    this.socket?.emit('leave-room', { roomId });
  }

  sendMessage(data) {
    console.log('📤 Sending message:', data);
    this.socket?.emit('send-message', data);
  }

  onNewMessage(callback) { this._on('new-message', callback); }
  offNewMessage(callback) { this._off('new-message', callback); }

  onMessageSent(callback) { this._on('message-sent', callback); }
  onMessageNotification(callback) { this._on('message-notification', callback); }

  onUserTyping(callback) { this._on('user-typing', callback); }
  onUserStopTyping(callback) { this._on('user-stop-typing', callback); }

  emitTyping(roomId, userId) {
    this.socket?.emit('typing', { roomId, userId });
  }

  emitStopTyping(roomId, userId) {
    this.socket?.emit('stop-typing', { roomId, userId });
  }

  onUserOnline(callback) { this._on('user-online', callback); }
  onUserOffline(callback) { this._on('user-offline', callback); }

  markRead(roomId, userId) {
    this.socket?.emit('mark-read', { roomId, userId });
  }

  onMessagesRead(callback) { this._on('messages-read', callback); }
  onMessageError(callback) { this._on('message-error', callback); }

  // Identity reveal
  requestReveal(roomId, userId) {
    this.socket?.emit('request-reveal', { roomId, userId });
  }
  onRevealRequested(callback) { this._on('reveal-requested', callback); }
  onIdentityRevealed(callback) { this._on('identity-revealed', callback); }

  disconnect() {
    this.socket?.removeAllListeners();
    this.socket?.disconnect();
    this.socket = null;
    this._pendingListeners = [];
  }

  removeAllListeners() {
    this.socket?.removeAllListeners();
    this._pendingListeners = [];
  }

  isConnected() {
    return this.socket?.connected || false;
  }
}

export const socketService = new SocketService();
export default socketService;
