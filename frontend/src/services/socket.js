import { io } from 'socket.io-client';
import { getServerBase } from './api';

class SocketService {
  socket = null;
  _listeners = new Map();
  _activeRooms = new Set();

  _getUrl() {
    return getServerBase();
  }

  connect() {
    // If socket already exists, let socket.io handle reconnection internally
    if (this.socket) {
      if (!this.socket.connected) {
        this.socket.connect();
      }
      return this.socket;
    }

    const url = this._getUrl();
    console.log('[socket] Connecting to:', url);

    this.socket = io(url, {
      transports: ['polling', 'websocket'],
      upgrade: true,
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
    });

    this.socket.on('connect', () => {
      console.log('[socket] Connected:', this.socket.id);

      const user = JSON.parse(localStorage.getItem('ct_user') || 'null');
      if (user?._id) {
        this.socket.emit('register', { userId: user._id });
      }

      for (const roomId of this._activeRooms) {
        this.socket.emit('join-room', { roomId });
      }

      this._reattachListeners();
    });

    this.socket.on('disconnect', (reason) => {
      console.log('[socket] Disconnected:', reason);
    });

    this.socket.on('connect_error', (err) => {
      console.warn('[socket] Connection error:', err.message);
    });

    this.socket.io.on('reconnect', (attempt) => {
      console.log('[socket] Reconnected after', attempt, 'attempts');
    });

    this._reattachListeners();

    return this.socket;
  }

  _reattachListeners() {
    if (!this.socket) return;
    for (const [event, callbacks] of this._listeners.entries()) {
      for (const cb of callbacks) {
        this.socket.off(event, cb);
        this.socket.on(event, cb);
      }
    }
  }

  _on(event, callback) {
    if (!this._listeners.has(event)) {
      this._listeners.set(event, new Set());
    }
    this._listeners.get(event).add(callback);

    if (this.socket) {
      this.socket.off(event, callback);
      this.socket.on(event, callback);
    }
  }

  _off(event, callback) {
    if (callback && this._listeners.has(event)) {
      this._listeners.get(event).delete(callback);
      if (this._listeners.get(event).size === 0) {
        this._listeners.delete(event);
      }
    } else if (!callback) {
      this._listeners.delete(event);
    }

    if (this.socket) {
      if (callback) {
        this.socket.off(event, callback);
      } else {
        this.socket.off(event);
      }
    }
  }

  register(userId) {
    if (!userId) return;
    if (this.socket?.connected) {
      this.socket.emit('register', { userId });
    }
  }

  joinRoom(roomId) {
    if (!roomId) return;
    this._activeRooms.add(roomId);

    if (this.socket?.connected) {
      this.socket.emit('join-room', { roomId });
    } else if (this.socket) {
      const handler = () => {
        this.socket.emit('join-room', { roomId });
        this.socket.off('connect', handler);
      };
      this.socket.on('connect', handler);
    }
  }

  leaveRoom(roomId) {
    if (!roomId) return;
    this._activeRooms.delete(roomId);
    this.socket?.emit('leave-room', { roomId });
  }

  sendMessage(data) {
    if (!this.socket?.connected) {
      return false;
    }
    this.socket.emit('send-message', data);
    return true;
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

  requestReveal(roomId, userId) {
    this.socket?.emit('request-reveal', { roomId, userId });
  }
  onRevealRequested(callback) { this._on('reveal-requested', callback); }
  onIdentityRevealed(callback) { this._on('identity-revealed', callback); }

  // ─── WebRTC Call Signaling ───

  callUser(data) {
    this.socket?.emit('call-user', data);
  }

  acceptCall(data) {
    this.socket?.emit('call-accepted', data);
  }

  rejectCall(data) {
    this.socket?.emit('call-rejected', data);
  }

  sendIceCandidate(data) {
    this.socket?.emit('ice-candidate', data);
  }

  endCall(data) {
    this.socket?.emit('end-call', data);
  }

  onIncomingCall(callback) { this._on('incoming-call', callback); }
  offIncomingCall(callback) { this._off('incoming-call', callback); }
  onCallAnswered(callback) { this._on('call-answered', callback); }
  offCallAnswered(callback) { this._off('call-answered', callback); }
  onCallRejected(callback) { this._on('call-rejected', callback); }
  offCallRejected(callback) { this._off('call-rejected', callback); }
  onIceCandidate(callback) { this._on('ice-candidate', callback); }
  offIceCandidate(callback) { this._off('ice-candidate', callback); }
  onCallEnded(callback) { this._on('call-ended', callback); }
  offCallEnded(callback) { this._off('call-ended', callback); }
  onCallUnavailable(callback) { this._on('call-unavailable', callback); }
  offCallUnavailable(callback) { this._off('call-unavailable', callback); }

  disconnect() {
    this._activeRooms.clear();
    this.socket?.removeAllListeners();
    this.socket?.disconnect();
    this.socket = null;
    this._listeners.clear();
  }

  isConnected() {
    return this.socket?.connected || false;
  }
}

export const socketService = new SocketService();
export default socketService;
