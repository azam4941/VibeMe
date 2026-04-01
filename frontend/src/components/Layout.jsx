import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCall } from '../context/CallContext';
import { Home, MessageCircle, Wallet, User, Bell, Phone, PhoneOff, Video } from 'lucide-react';
import './Layout.css';

export default function Layout() {
  const { user } = useAuth();
  const { incomingCall, acceptIncoming, rejectIncoming } = useCall();
  const location = useLocation();

  const hideNav = ['/session', '/rating', '/video-call'].some(p => location.pathname.startsWith(p));

  const callerInitials = incomingCall?.callerName
    ? incomingCall.callerName.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
    : 'U';

  return (
    <div className="app-layout">
      <main className="main-content">
        <Outlet />
      </main>

      {!hideNav && (
        <nav className="bottom-nav">
          <NavLink to="/discover" className={({ isActive }) => `bnav-item ${isActive ? 'active' : ''}`}>
            <Home size={20} />
            <span>Home</span>
            {location.pathname === '/discover' && <div className="bnav-dot" />}
          </NavLink>
          <NavLink to="/chat" className={({ isActive }) => `bnav-item ${isActive ? 'active' : ''}`}>
            <MessageCircle size={20} />
            <span>Chats</span>
          </NavLink>
          <NavLink to="/wallet" className={({ isActive }) => `bnav-item ${isActive ? 'active' : ''}`}>
            <Wallet size={20} />
            <span>Wallet</span>
          </NavLink>
          <NavLink to="/notifications" className={({ isActive }) => `bnav-item ${isActive ? 'active' : ''}`}>
            <Bell size={20} />
            <span>Alerts</span>
          </NavLink>
          <NavLink to="/profile" className={({ isActive }) => `bnav-item ${isActive ? 'active' : ''}`}>
            <User size={20} />
            <span>Profile</span>
          </NavLink>
        </nav>
      )}

      {/* Incoming Call Modal */}
      {incomingCall && (
        <div className="incoming-call-overlay">
          <div className="ic-card">
            <div className="ic-pulse-bg" />
            <div className="ic-avatar">{callerInitials}</div>
            <div className="ic-name">{incomingCall.callerName || 'Unknown Caller'}</div>
            <div className="ic-type">
              {incomingCall.type === 'video' ? <Video size={14} /> : <Phone size={14} />}
              Incoming {incomingCall.type === 'video' ? 'Video' : 'Voice'} Call
            </div>
            <div className="ic-actions">
              <button className="ic-btn ic-reject" onClick={rejectIncoming}>
                <PhoneOff size={24} />
                <span>Decline</span>
              </button>
              <button className="ic-btn ic-accept" onClick={acceptIncoming}>
                <Phone size={24} />
                <span>Accept</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
