import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  User, Wallet, Shield, BarChart3, Users, Settings, LogOut,
  ChevronRight, CheckCircle, MapPin, Star, PauseCircle, Trash2, Play,
} from 'lucide-react';
import api from '../services/api';
import AccountSettingsModal from '../components/AccountSettingsModal';
import './ProfilePage.css';

const ProfilePage = () => {
  const navigate = useNavigate();
  const { user, logout, refreshUser, updateLocalUser } = useAuth();
  const [toggling, setToggling] = useState(false);
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [accountLoading, setAccountLoading] = useState(false);

  const getInitials = (name) => {
    if (!name) return 'U';
    return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  };

  const handleToggleRent = async () => {
    if (toggling) return;
    setToggling(true);
    try {
      const newMode = !user?.rentMode;
      await api.setRentMode(newMode);
      updateLocalUser({ rentMode: newMode });
      await refreshUser();
    } catch (err) {
      console.error('Toggle rent failed:', err);
    } finally {
      setToggling(false);
    }
  };

  const handleLogout = () => {
    if (window.confirm('Are you sure you want to sign out?')) {
      logout();
    }
  };

  const handlePauseAccount = async () => {
    setAccountLoading(true);
    try {
      await api.pauseAccount();
      await refreshUser();
      setShowAccountModal(false);
    } catch (err) {
      console.error('Pause failed:', err);
    } finally {
      setAccountLoading(false);
    }
  };

  const handleResumeAccount = async () => {
    setAccountLoading(true);
    try {
      await api.resumeAccount();
      await refreshUser();
      setShowAccountModal(false);
    } catch (err) {
      console.error('Resume failed:', err);
    } finally {
      setAccountLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    setAccountLoading(true);
    try {
      await api.deleteAccount();
      logout();
    } catch (err) {
      console.error('Delete failed:', err);
    } finally {
      setAccountLoading(false);
    }
  };

  const isPaused = user?.accountStatus === 'paused';

  const menuItems = [
    { icon: <User size={18} />, iconBg: 'rgba(123,47,255,0.15)', iconColor: '#A78BFA', title: 'Edit Profile', sub: 'Name, bio, interests, photo', route: '/setup' },
    { icon: <Wallet size={18} />, iconBg: 'rgba(0,230,164,0.15)', iconColor: '#00E6A4', title: 'Wallet & Payments', sub: `Balance: ₹${user?.balance || '0'}`, route: '/wallet' },
    { icon: <Shield size={18} />, iconBg: 'rgba(147,51,234,0.15)', iconColor: '#A855F7', title: 'Privacy & Safety', sub: user?.isVerified ? 'Verified' : 'KYC Pending', route: '/notifications' },
    { icon: <BarChart3 size={18} />, iconBg: 'rgba(255,179,36,0.15)', iconColor: '#FFB324', title: 'Session History', sub: `${user?.totalSessions || 0} sessions completed`, route: '/bookings' },
    { icon: <Users size={18} />, iconBg: 'rgba(123,47,255,0.15)', iconColor: '#A78BFA', title: 'Refer & Earn', sub: 'Earn ₹50 per friend', route: '/notifications' },
    { icon: <Settings size={18} />, iconBg: 'rgba(255,255,255,0.08)', iconColor: '#8B85A8', title: 'Settings', sub: 'App preferences', route: '/notifications' },
  ];

  return (
    <div className="myprofile-page page">
      <div className="mp-hero dark-header">
        <div className="mp-top-row">
          <h2 className="mp-title">My Profile</h2>
          <span className="mp-edit" onClick={() => navigate('/setup')}>Edit</span>
        </div>

        {isPaused && (
          <div className="mp-paused-banner">
            <PauseCircle size={16} />
            <span>Your account is paused — you're hidden from discovery</span>
            <button className="mp-resume-btn" onClick={handleResumeAccount}>Resume</button>
          </div>
        )}

        <div className="mp-card">
          <div className="mp-avatar avatar avatar-lg avatar-purple"
            style={{
              borderRadius: '20px',
              border: '3px solid var(--purple-light)',
              backgroundImage: user?.profilePhoto ? `url(${user.profilePhoto})` : 'none',
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '24px',
              fontWeight: '800'
            }}>
            {!user?.profilePhoto && getInitials(user?.name)}
          </div>
          <div className="mp-meta">
            <div className="mp-name">{user?.name || 'User'}</div>
            <div className="mp-phone">+91 {user?.phoneNumber || '—'}</div>
            {user?.location && (
              <div className="mp-location-row">
                <MapPin size={10} />
                <span>{user.location}</span>
              </div>
            )}
            {user?.isVerified && (
              <div className="mp-verified-badge">
                <CheckCircle size={10} />
                <span>Verified</span>
              </div>
            )}
          </div>
        </div>

        {user?.bio && (
          <div className="mp-bio">{user.bio}</div>
        )}

        {user?.interests?.length > 0 && (
          <div className="mp-interests">
            {user.interests.slice(0, 5).map((int, i) => (
              <span key={i} className="mp-interest-tag">{int}</span>
            ))}
            {user.interests.length > 5 && (
              <span className="mp-interest-tag" style={{ opacity: 0.5 }}>+{user.interests.length - 5}</span>
            )}
          </div>
        )}

        <div className="mp-stats-row">
          <div className="mps">
            <div className="mps-num">{user?.totalSessions || 0}</div>
            <div className="mps-label">Sessions</div>
          </div>
          <div className="mps">
            <div className="mps-num" style={{ color: 'var(--purple-light)' }}>
              <Star size={12} style={{ marginRight: 2, verticalAlign: 'middle' }} />
              {user?.rating?.toFixed(1) || '—'}
            </div>
            <div className="mps-label">My Rating</div>
          </div>
          <div className="mps">
            <div className="mps-num" style={{ color: 'var(--teal)' }}>₹{user?.totalEarnings || '0'}</div>
            <div className="mps-label">Earnings</div>
          </div>
        </div>
      </div>

      <div className="mp-body">
        <div className="mp-rent-banner card">
          <div className="mrb-row">
            <div className="mrb-left">
              <div className="mrb-title">Rent Mode — Earn Money</div>
              <div className="mrb-sub">Currently: ₹{user?.pricePerMinute || 3}/min &bull; {user?.rentMode ? 'Active' : 'Off'}</div>
            </div>
            <div className={`toggle-switch ${!user?.rentMode ? 'off' : ''}`} onClick={handleToggleRent} style={{ opacity: toggling ? 0.5 : 1 }}>
              <div className="toggle-thumb" />
            </div>
          </div>
          {user?.rentMode && (
            <div className="mrb-earning">
              <span className="mre-label">Total Earnings</span>
              <span className="mre-val">₹{user?.totalEarnings || '0'}</span>
            </div>
          )}
        </div>

        <div className="mp-menu card">
          {menuItems.map((item, i) => (
            <div key={i} className="mp-menu-item" onClick={() => item.route && navigate(item.route)}>
              <div className="mmi-icon" style={{ background: item.iconBg, color: item.iconColor }}>{item.icon}</div>
              <div className="mmi-text">
                <div className="mmi-title">{item.title}</div>
                <div className="mmi-sub">{item.sub}</div>
              </div>
              {item.badge && <span className="mmi-badge">{item.badge}</span>}
              <ChevronRight size={18} className="mmi-arrow" />
            </div>
          ))}
        </div>

        {/* Account Management */}
        <div className="mp-account-section card">
          <div className="mp-menu-item" onClick={() => setShowAccountModal(true)}>
            <div className="mmi-icon" style={{ background: 'rgba(123,47,255,0.12)' }}>
              {isPaused ? <Play size={18} color="#A78BFA" /> : <PauseCircle size={18} color="#A78BFA" />}
            </div>
            <div className="mmi-text">
              <div className="mmi-title">{isPaused ? 'Resume Account' : 'Pause Account'}</div>
              <div className="mmi-sub">{isPaused ? 'Your profile is currently hidden' : 'Temporarily hide from discovery'}</div>
            </div>
            <ChevronRight size={18} className="mmi-arrow" />
          </div>
          <div className="mp-menu-item" onClick={() => setShowAccountModal(true)}>
            <div className="mmi-icon" style={{ background: 'rgba(255,59,93,0.12)' }}>
              <Trash2 size={18} color="var(--red)" />
            </div>
            <div className="mmi-text">
              <div className="mmi-title" style={{ color: 'var(--red)' }}>Delete Account</div>
              <div className="mmi-sub">Permanently remove your account</div>
            </div>
            <ChevronRight size={18} className="mmi-arrow" />
          </div>
        </div>

        <div className="mp-signout card" onClick={handleLogout}>
          <div className="mmi-icon" style={{ background: 'rgba(255,59,93,0.12)' }}><LogOut size={18} color="var(--red)" /></div>
          <div className="mmi-text"><div className="mmi-title" style={{ color: 'var(--red)' }}>Sign Out</div></div>
        </div>
      </div>

      <AccountSettingsModal
        isOpen={showAccountModal}
        onClose={() => setShowAccountModal(false)}
        onPause={handlePauseAccount}
        onResume={handleResumeAccount}
        onDelete={handleDeleteAccount}
        isPaused={isPaused}
        loading={accountLoading}
      />
    </div>
  );
};

export default ProfilePage;
