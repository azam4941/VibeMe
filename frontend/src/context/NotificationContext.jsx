import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './AuthContext';
import { useAlert } from './AlertContext';
import socketService from '../services/socket';
import api from '../services/api';

const NotificationContext = createContext();

export const NotificationProvider = ({ children }) => {
  const { user, isAuthenticated } = useAuth();
  const { showAlert } = useAlert();
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);
  const [activeRoomId, setActiveRoomId] = useState(null);
  const initializedRef = useRef(false);

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
      // Poll every 60s as a fallback
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

    const handleMessageNotification = (data) => {
      // If we are already in this room, don't show a global alert or increment unread for this specific room
      if (activeRoomId === data.roomId) return;

      setUnreadChatCount(prev => prev + 1);
      showAlert(`New message: ${data.preview || 'Click to view'}`, 'info');
    };

    const handleMessagesRead = (data) => {
      // If the current user read messages, or we see someone else read our messages
      fetchUnreadCounts();
    };

    const handleNewNotification = (notif) => {
      setUnreadNotifCount(prev => prev + 1);
      
      // Prevent double alerts if we're already in the chat room for this message notification
      if (notif.type === 'new_message' && activeRoomId === notif.data?.roomId) return;
      
      showAlert(`${notif.title}: ${notif.body}`, 'info');
    };

    socketService.onMessageNotification(handleMessageNotification);
    socketService.onMessagesRead(handleMessagesRead);
    socketService._on('new-notification', handleNewNotification);

    return () => {
      socketService._off('message-notification', handleMessageNotification);
      socketService._off('messages-read', handleMessagesRead);
      socketService._off('new-notification', handleNewNotification);
    };
  }, [isAuthenticated, user?._id, activeRoomId, showAlert, fetchUnreadCounts]);

  return (
    <NotificationContext.Provider value={{ 
      unreadChatCount, 
      unreadNotifCount, 
      refreshCounts: fetchUnreadCounts,
      setActiveRoomId 
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
