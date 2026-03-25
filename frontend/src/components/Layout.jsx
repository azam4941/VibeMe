import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Home, MessageCircle, Wallet, User, Bell } from 'lucide-react';
import './Layout.css';

export default function Layout() {
  const { user } = useAuth();
  const location = useLocation();

  // Hide bottom nav on certain pages
  const hideNav = ['/session', '/rating'].some(p => location.pathname.startsWith(p));

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
    </div>
  );
}
