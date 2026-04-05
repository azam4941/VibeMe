import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck, Trash2, MessageSquare, DollarSign, Star, Eye, Calendar, Zap, Phone, PhoneMissed } from 'lucide-react';
import api from '../services/api';
import socketService from '../services/socket';
import './NotificationsPage.css';

const typeIcons = {
  new_message: <MessageSquare size={18} />,
  session_booked: <Calendar size={18} />,
  payment: <DollarSign size={18} />,
  reveal_request: <Eye size={18} />,
  review: <Star size={18} />,
  video_call: <Zap size={18} />,
  incoming_call: <Phone size={18} />,
  missed_call: <PhoneMissed size={18} />,
  system: <Bell size={18} />,
};

const typeColors = {
  new_message: 'var(--purple)',
  session_booked: 'var(--teal)',
  payment: 'var(--amber)',
  reveal_request: 'var(--pink)',
  review: 'var(--coral)',
  video_call: 'var(--teal)',
  incoming_call: 'var(--teal)',
  missed_call: 'var(--red)',
  system: 'var(--purple-mid)',
};

const NotificationsPage = () => {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchNotifications = useCallback(async () => {
    try {
      const data = await api.getNotifications();
      setNotifications(data || []);
      setError(null);
    } catch (err) {
      console.error('Failed to load notifications:', err);
      setError('Failed to load notifications');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    
    const handleNewNotif = () => fetchNotifications();
    socketService._on('new-notification', handleNewNotif);

    // Keep polling as backup (but less frequent)
    const interval = setInterval(fetchNotifications, 60000);
    
    return () => {
      clearInterval(interval);
      socketService._off('new-notification', handleNewNotif);
    };
  }, [fetchNotifications]);

  const handleMarkAllRead = async () => {
    try {
      await api.markAllNotifRead();
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    } catch (err) {
      console.error('Failed to mark all read:', err);
    }
  };

  const handleDelete = async (id, e) => {
    e.stopPropagation();
    try {
      await api.deleteNotif(id);
      setNotifications(prev => prev.filter(n => n._id !== id));
    } catch (err) {
      console.error('Failed to delete notification:', err);
    }
  };

  const handleNotifClick = async (n) => {
    // Mark as read
    if (!n.isRead) {
      try {
        await api.markNotifRead(n._id);
        setNotifications(prev => prev.map(item => 
          item._id === n._id ? { ...item, isRead: true } : item
        ));
      } catch (err) {
        console.error('Failed to mark read:', err);
      }
    }

    // Navigate based on type
    const routes = {
      new_message: '/chat',
      session_booked: '/discover',
      payment: '/wallet',
      reveal_request: '/chat',
      review: '/profile',
      video_call: '/chat',
      incoming_call: '/chat',
      missed_call: '/chat',
    };
    const route = n.data?.screen ? `/${n.data.screen.toLowerCase()}` : routes[n.type];
    if (route) navigate(route);
  };

  const formatTime = (ts) => {
    if (!ts) return '';
    const d = new Date(ts);
    const now = new Date();
    const diff = now - d;
    
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)} min ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} hr ago`;
    if (diff < 604800000) return `${Math.floor(diff / 86400000)} days ago`;
    return d.toLocaleDateString();
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;

  return (
    <div className="notifications-page page">
      <div className="notif-header dark-header">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
          <h2 className="nh-title">Notifications</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {unreadCount > 0 && (
              <button 
                className="notif-mark-read-btn"
                onClick={handleMarkAllRead}
              >
                <CheckCheck size={14} /> Mark all read
              </button>
            )}
            <div className="nh-count">{unreadCount} unread</div>
          </div>
        </div>
      </div>

      <div className="notif-body">
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 20px' }}>
            <div className="spinner" style={{ margin: '0 auto' }} />
          </div>
        ) : error ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text3)' }}>
            <p>{error}</p>
            <button className="btn btn-sm btn-primary" style={{ marginTop: '12px' }} onClick={fetchNotifications}>
              Retry
            </button>
          </div>
        ) : notifications.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text3)' }}>
            <Bell size={40} opacity={0.3} />
            <p style={{ marginTop: '12px', fontSize: '13px' }}>No notifications yet</p>
            <p style={{ fontSize: '11px', marginTop: '4px' }}>When someone messages you or books a session, you'll see it here!</p>
          </div>
        ) : (
          notifications.map(n => (
            <div 
              key={n._id} 
              className={`notif-item card ${!n.isRead ? 'notif-unread' : ''}`} 
              onClick={() => handleNotifClick(n)}
            >
              <div className="ni-icon" style={{ background: typeColors[n.type] || 'var(--purple)', color: '#fff' }}>
                {typeIcons[n.type] || <Bell size={18} />}
              </div>
              <div className="ni-content">
                <div className="ni-title">{n.title}</div>
                <div className="ni-body">{n.body}</div>
                <div className="ni-time">{formatTime(n.createdAt)}</div>
              </div>
              <button className="ni-delete" onClick={(e) => handleDelete(n._id, e)}>
                <Trash2 size={14} />
              </button>
              {!n.isRead && <div className="notif-dot" />}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default NotificationsPage;
