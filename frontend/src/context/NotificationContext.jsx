import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './AuthContext';
import socketService from '../services/socket';
import api from '../services/api';

const NotificationContext = createContext();

// ─── Notification Sound Generator (uses Web Audio API — no file needed) ───
class NotificationSoundPlayer {
  constructor() {
    this.audioCtx = null;
  }

  _getCtx() {
    if (!this.audioCtx) {
      this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    // Resume if suspended (autoplay policies)
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
    return this.audioCtx;
  }

  /**
   * Play a pleasant "ding" chime for messages
   */
  playMessageSound() {
    try {
      const ctx = this._getCtx();
      const now = ctx.currentTime;

      // Two-tone chime: G5 → C6
      const freqs = [784, 1047];
      freqs.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0, now + i * 0.12);
        gain.gain.linearRampToValueAtTime(0.3, now + i * 0.12 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.12 + 0.35);
        osc.start(now + i * 0.12);
        osc.stop(now + i * 0.12 + 0.4);
      });
    } catch (e) {
      console.warn('Could not play message sound:', e);
    }
  }

  /**
   * Play a ringtone pattern for incoming calls
   */
  playCallSound() {
    try {
      const ctx = this._getCtx();
      const now = ctx.currentTime;

      // Triple pulse ringtone
      for (let pulse = 0; pulse < 3; pulse++) {
        const t = now + pulse * 0.25;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.value = 880; // A5
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.35, t + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
        osc.start(t);
        osc.stop(t + 0.2);
      }
    } catch (e) {
      console.warn('Could not play call sound:', e);
    }
  }

  /**
   * Generic notification ding
   */
  playGenericSound() {
    try {
      const ctx = this._getCtx();
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.25, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
      osc.start(now);
      osc.stop(now + 0.35);
    } catch (e) {
      console.warn('Could not play generic sound:', e);
    }
  }
}

const soundPlayer = new NotificationSoundPlayer();

// ─── Browser Notification Permission ───
function requestNotificationPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }
}

function showBrowserNotification(title, body, tag) {
  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      const n = new Notification(title, {
        body,
        tag: tag || 'vibeme-notification',
        icon: '/favicon.svg',
        badge: '/favicon.svg',
        vibrate: [200, 100, 200],
        silent: false,
      });
      // Auto close after 5s
      setTimeout(() => n.close(), 5000);
    } catch (e) {
      // May fail on mobile — that's fine
      console.warn('Browser notification failed:', e);
    }
  }
}

// ─── In-App Toast Queue ───
let toastIdCounter = 0;

export const NotificationProvider = ({ children }) => {
  const { user, isAuthenticated } = useAuth();
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);
  const [activeRoomId, setActiveRoomId] = useState(null);
  const [toasts, setToasts] = useState([]);
  const toastsRef = useRef([]);

  // Keep ref in sync
  useEffect(() => { toastsRef.current = toasts; }, [toasts]);

  // Request browser notification permission on mount
  useEffect(() => {
    if (isAuthenticated) {
      requestNotificationPermission();
    }
  }, [isAuthenticated]);

  const addToast = useCallback((message, type = 'info', icon = null, title = null) => {
    const id = ++toastIdCounter;
    const toast = { id, message, type, icon, title, visible: true };
    setToasts(prev => [...prev.slice(-4), toast]); // Keep max 5 toasts

    // Auto-remove after 4s
    setTimeout(() => {
      setToasts(prev => prev.map(t => t.id === id ? { ...t, visible: false } : t));
      // Clean up after animation
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id));
      }, 400);
    }, 4000);
  }, []);

  const dismissToast = useCallback((id) => {
    setToasts(prev => prev.map(t => t.id === id ? { ...t, visible: false } : t));
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 400);
  }, []);

  const fetchUnreadCounts = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const [chatRes, notifRes] = await Promise.all([
        api.getUnreadCount(),
        api.getUnreadNotifCount()
      ]);
      setUnreadChatCount(chatRes.count || 0);
      setUnreadNotifCount(notifRes.count || 0);
    } catch (err) {
      console.error('Failed to fetch unread counts:', err);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchUnreadCounts();
      const interval = setInterval(fetchUnreadCounts, 60000);
      return () => clearInterval(interval);
    } else {
      setUnreadChatCount(0);
      setUnreadNotifCount(0);
    }
  }, [isAuthenticated, fetchUnreadCounts]);

  useEffect(() => {
    if (!isAuthenticated || !user?._id) return;

    const sock = socketService.connect();
    if (!sock) return;

    // ─── Message Notification ───
    const handleMessageNotification = (data) => {
      if (activeRoomId === data.roomId) return;

      setUnreadChatCount(prev => prev + 1);

      // Sound
      soundPlayer.playMessageSound();

      // In-app toast
      addToast(
        data.preview ? `${data.preview.slice(0, 80)}` : 'You have a new message',
        'message',
        '💬',
        'New Message'
      );

      // Browser notification (for when app is in background)
      showBrowserNotification('New Message', data.preview || 'You have a new message', `msg-${data.roomId}`);
    };

    const handleMessagesRead = () => {
      fetchUnreadCounts();
    };

    // ─── Generic Notification ───
    const handleNewNotification = (notif) => {
      setUnreadNotifCount(prev => prev + 1);

      // Don't double-toast if it's a message and we're in that room
      if (notif.type === 'new_message' && activeRoomId === notif.data?.roomId) return;

      // Pick correct sound
      if (notif.type === 'video_call' || notif.type === 'incoming_call') {
        soundPlayer.playCallSound();
      } else if (notif.type === 'new_message') {
        soundPlayer.playMessageSound();
      } else {
        soundPlayer.playGenericSound();
      }

      // In-app toast
      const iconMap = {
        new_message: '💬',
        session_booked: '📅',
        payment: '💰',
        reveal_request: '👁️',
        review: '⭐',
        video_call: '📹',
        incoming_call: '📞',
        system: '🔔',
      };
      addToast(
        notif.body,
        notif.type === 'video_call' || notif.type === 'incoming_call' ? 'call' : 'info',
        iconMap[notif.type] || '🔔',
        notif.title
      );

      // Browser notification
      showBrowserNotification(notif.title, notif.body, `notif-${notif._id}`);
    };

    // ─── Incoming Call Notification ───
    const handleIncomingCallNotify = (data) => {
      soundPlayer.playCallSound();
      addToast(
        `${data.callerName || 'Someone'} is calling you`,
        'call',
        data.type === 'video' ? '📹' : '📞',
        `Incoming ${data.type === 'video' ? 'Video' : 'Voice'} Call`
      );
      showBrowserNotification(
        'Incoming Call',
        `${data.callerName || 'Someone'} is calling you`,
        'incoming-call'
      );
    };

    // ─── Call Unavailable Notification ───
    const handleCallUnavailable = (data) => {
      addToast(
        'User is currently unavailable. Try again later.',
        'warning',
        '📵',
        'Call Unavailable'
      );
    };

    socketService.onMessageNotification(handleMessageNotification);
    socketService.onMessagesRead(handleMessagesRead);
    socketService._on('new-notification', handleNewNotification);
    socketService._on('incoming-call', handleIncomingCallNotify);
    socketService._on('call-unavailable', handleCallUnavailable);

    return () => {
      socketService._off('message-notification', handleMessageNotification);
      socketService._off('messages-read', handleMessagesRead);
      socketService._off('new-notification', handleNewNotification);
      socketService._off('incoming-call', handleIncomingCallNotify);
      socketService._off('call-unavailable', handleCallUnavailable);
    };
  }, [isAuthenticated, user?._id, activeRoomId, addToast, fetchUnreadCounts]);

  return (
    <NotificationContext.Provider value={{ 
      unreadChatCount, 
      unreadNotifCount, 
      refreshCounts: fetchUnreadCounts,
      setActiveRoomId,
      toasts,
      dismissToast,
      addToast,
    }}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) throw new Error('useNotifications must be used within a NotificationProvider');
  return context;
};
