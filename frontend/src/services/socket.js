import { io } from 'socket.io-client';
import { getServerBase } from './api';

class SocketService {
  socket = null;
  _listeners = new Map(); // event -> Set of callbacks (persisted across reconnects)

  _getUrl() {
    // Compute at call time, not module load time
    return getServerBase();
  }

  connect() {
    if (this.socket?.connected) {
      console.log('🔌 Socket already connected:', this.socket.id);
      return this.socket;
    }
    
    // Destroy any stale socket
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }

    const url = this._getUrl();
    console.log('🔌 Connecting to socket at:', url);
    
    this.socket = io(url, {
      transports: ['polling', 'websocket'],
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
      
      // Auto-register user
      const user = JSON.parse(localStorage.getItem('ct_user') || 'null');
      if (user?._id) {
        console.log('📡 Auto-registering user:', user._id);
        this.socket.emit('register', { userId: user._id });
      }
      
      // Re-attach ALL persisted listeners on every connect/reconnect
      this._reattachListeners();
    });

    this.socket.on('disconnect', (reason) => {
      console.log('🔌 Socket disconnected:', reason);
    });

    this.socket.on('connect_error', (err) => {
      console.warn('🔌 Socket connection error:', err.message);
    });

    this.socket.io.on('reconnect', (attempt) => {
      console.log('🔌 Socket reconnected after', attempt, 'attempts');
    });

    // Attach any listeners that were registered before connect() was called
    this._reattachListeners();

    return this.socket;
  }

  // Re-attach all persisted listeners to the raw socket
  _reattachListeners() {
    if (!this.socket) return;
    for (const [event, callbacks] of this._listeners.entries()) {
      for (const cb of callbacks) {
        // Remove first to prevent duplicates, then add
        this.socket.off(event, cb);
        this.socket.on(event, cb);
      }
    }
  }

  // Persistent event listener — survives reconnects
  _on(event, callback) {
    // Track it in our persistent map
    if (!this._listeners.has(event)) {
      this._listeners.set(event, new Set());
    }
    this._listeners.get(event).add(callback);

    // Also attach to socket right now if it exists
    if (this.socket) {
      this.socket.off(event, callback); // prevent duplicates
      this.socket.on(event, callback);
    }
  }

  _off(event, callback) {
    // Remove from persistent map
    if (callback && this._listeners.has(event)) {
      this._listeners.get(event).delete(callback);
      if (this._listeners.get(event).size === 0) {
        this._listeners.delete(event);
      }
    } else if (!callback) {
      this._listeners.delete(event);
    }

    // Remove from raw socket
    if (this.socket) {
      if (callback) {
        this.socket.off(event, callback);
      } else {
        this.socket.off(event);
      }
    }
  }

  register(userId) {
    if (this.socket?.connected) {
      console.log('📡 Registering user:', userId);
      this.socket.emit('register', { userId });
    } else {
      console.log('📡 Socket not connected yet, register will happen on connect');
      // Will be handled by auto-register in the connect handler
    }
  }

  joinRoom(roomId) {
    const doJoin = () => {
      console.log('📌 Joining room:', roomId);
      this.socket.emit('join-room', { roomId });
    };

    if (this.socket?.connected) {
      doJoin();
    } else if (this.socket) {
      // Wait for connection then join
      const handler = () => {
        doJoin();
        this.socket.off('connect', handler);
      };
      this.socket.on('connect', handler);
    }
  }

  leaveRoom(roomId) {
    this.socket?.emit('leave-room', { roomId });
  }

  sendMessage(data) {
    if (!this.socket?.connected) {
      console.error('❌ Cannot send message — socket not connected');
      return;
    }
    console.log('📤 Sending message:', JSON.stringify(data).slice(0, 200));
    this.socket.emit('send-message', data);
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
    this._listeners.clear();
  }

  removeAllListeners() {
    this.socket?.removeAllListeners();
    this._listeners.clear();
  }

  isConnected() {
    return this.socket?.connected || false;
  }
}

export const socketService = new SocketService();
export default socketService;
