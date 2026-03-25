import React from 'react';
import { useNavigate } from 'react-router-dom';
import './NotificationsPage.css';

const NotificationsPage = () => {
  const navigate = useNavigate();

  const notifications = [
    { id: 1, type: 'booking', title: 'New booking request', body: 'Someone wants to book a 30-min session with you tonight at 8 PM.', time: '2 minutes ago', unread: true, action: 'Accept / Decline →', route: '/bookings' },
    { id: 2, type: 'chat', title: 'Priya S. sent you a message', body: '"Hey! Are you available tonight? I really need to talk..."', time: '15 minutes ago', unread: true, action: 'Reply →', route: '/chat' },
    { id: 3, type: 'wallet', title: '₹96 added to your wallet', body: 'Payment released after your session with Anonymous User (32 min).', time: '1 hour ago', unread: true, action: null, route: '/wallet' },
    { id: 4, type: 'review', title: 'Aisha left you a 5★ review', body: '"Great listener, very helpful and no judgment at all!"', time: 'Yesterday', unread: false, action: null, route: null },
    { id: 5, type: 'bonus', title: 'Referral bonus earned', body: 'Your friend joined VibeMe! ₹50 added to your wallet.', time: '2 days ago', unread: false, action: null, route: '/wallet' },
    { id: 6, type: 'reveal', title: 'Identity reveal request', body: 'A user wants to reveal their identity to you. Do you agree?', time: '3 days ago', unread: false, action: 'View Request →', route: '/chat' },
  ];

  const unreadCount = notifications.filter(n => n.unread).length;

  return (
    <div className="notifications-page page">
      <div className="notif-header dark-header">
        <h2 className="nh-title">Notifications</h2>
        <div className="nh-count">{unreadCount} unread</div>
      </div>
      <div className="notif-body">
        {notifications.map(n => (
          <div key={n.id} className={`notif-item card ${n.unread ? 'notif-unread' : ''}`} onClick={() => n.route && navigate(n.route)}>
            {n.unread && <div className="notif-dot" />}
            <div className="ni-content">
              <div className="ni-title">{n.title}</div>
              <div className="ni-body">{n.body}</div>
              <div className="ni-time">{n.time}</div>
              {n.action && <div className="ni-action">{n.action}</div>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default NotificationsPage;
