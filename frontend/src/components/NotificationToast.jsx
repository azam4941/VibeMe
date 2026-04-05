import React from 'react';
import { useNotifications } from '../context/NotificationContext';
import { X } from 'lucide-react';
import './NotificationToast.css';

export default function NotificationToast() {
  const { toasts, dismissToast } = useNotifications();

  if (!toasts || toasts.length === 0) return null;

  return (
    <div className="toast-container" id="notification-toast-container">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`toast-item toast-${toast.type} ${toast.visible ? 'toast-enter' : 'toast-exit'}`}
          onClick={() => dismissToast(toast.id)}
        >
          <div className="toast-glow" />
          <div className="toast-icon-wrap">
            <span className="toast-icon">{toast.icon}</span>
          </div>
          <div className="toast-content">
            {toast.title && <div className="toast-title">{toast.title}</div>}
            <div className="toast-message">{toast.message}</div>
          </div>
          <button className="toast-close" onClick={(e) => { e.stopPropagation(); dismissToast(toast.id); }}>
            <X size={14} />
          </button>
          <div className="toast-progress" />
        </div>
      ))}
    </div>
  );
}
