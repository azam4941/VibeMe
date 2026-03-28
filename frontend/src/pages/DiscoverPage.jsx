import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Bell, MapPin, Check, X } from 'lucide-react';
import api from '../services/api';
import './DiscoverPage.css';

const VIBE_CATEGORIES = [
  { label: 'All Vibes', color: 'purple' },
  { label: 'Gossip Partner', color: 'purple' },
  { label: 'Vent Listener', color: 'pink' },
  { label: 'Emotional Support', color: 'teal' },
  { label: 'Timepass / Fun', color: 'purple' },
  { label: 'Deep Talks', color: 'amber' },
  { label: 'Late Night Chats', color: 'amber' },
  { label: 'Rona Chahte Ho', color: 'pink' },
  { label: 'Frustration Nikalna', color: 'pink' },
  { label: 'Life Advice', color: 'teal' },
  { label: 'Relationship Talk', color: 'teal' },
  { label: 'Career Guidance', color: 'teal' },
  { label: 'Study Buddy', color: 'coral' },
  { label: 'Gaming Partner', color: 'coral' },
  { label: 'Motivational Talk', color: 'teal' },
  { label: 'Just Exist Together', color: 'amber' },
];

const AVATAR_COLORS = ['avatar-purple', 'avatar-pink', 'avatar-teal', 'avatar-amber', 'avatar-coral'];

const DiscoverPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [selectedVibes, setSelectedVibes] = useState([]);
  const [mode, setMode] = useState('find');
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ online: 0, minPrice: 0, maxPrice: 0, avgRating: 0 });

  const fetchUsers = async (vibes) => {
    setLoading(true);
    try {
      const filters = {};
      const active = vibes.filter(v => v !== 'All Vibes');
      if (active.length > 0) {
        filters.interests = active.join(',');
      }
      const data = await api.discover(filters);
      const filtered = (data.users || []).filter(u => u._id !== user?._id);
      setUsers(filtered);

      if (filtered.length > 0) {
        const prices = filtered.map(u => u.pricePerMinute || 0).filter(p => p > 0);
        const ratings = filtered.map(u => u.rating || 0).filter(r => r > 0);
        const onlineCount = filtered.filter(u => u.currentStatus === 'online').length;
        setStats({
          online: onlineCount,
          minPrice: Math.min(...(prices.length ? prices : [0])),
          maxPrice: Math.max(...(prices.length ? prices : [0])),
          avgRating: ratings.length ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1) : '—',
        });
      }
    } catch (err) {
      console.error('Failed to fetch users:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers(selectedVibes);
  }, [selectedVibes, user]);

  const toggleVibe = (label) => {
    if (label === 'All Vibes') {
      setSelectedVibes([]);
      return;
    }
    setSelectedVibes(prev => {
      if (prev.includes(label)) {
        return prev.filter(v => v !== label);
      }
      return [...prev, label];
    });
  };

  const clearAll = () => setSelectedVibes([]);

  const getInitials = (name) => {
    if (!name) return '??';
    return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const handleChatNow = async (targetUser) => {
    try {
      const room = await api.createChatRoom(targetUser._id);
      navigate(`/chat/${room._id}`);
    } catch (err) {
      console.error('Failed to create chat room:', err);
      navigate('/chat');
    }
  };

  const selectedCount = selectedVibes.length;

  return (
    <div className="discover-page page">
      <div className="home-header dark-header">
        <div className="hh-row">
          <div>
            <div className="hh-logo">VibeMe</div>
            <div className="hh-greeting">{getGreeting()}, {user?.name?.split(' ')[0] || 'there'} 👋</div>
            <div className="hh-sub">Find your vibe today</div>
          </div>
          <div className="hh-right">
            <div className="hh-notif" onClick={() => navigate('/notifications')}>
              <Bell size={16} />
              <div className="notif-badge" />
            </div>
          </div>
        </div>
        <div className="home-toggle">
          <div className={`ht ${mode === 'find' ? 'on' : ''}`} onClick={() => setMode('find')}>Find People</div>
          <div className={`ht ${mode === 'offer' ? 'on' : ''}`} onClick={() => setMode('offer')}>Offer Time</div>
        </div>
      </div>

      <div className="home-cats">
        <div className="cats-header">
          <div className="cats-label">BROWSE BY VIBE</div>
          {selectedCount > 0 && (
            <div className="cats-meta">
              <span className="cats-count">{selectedCount} vibe{selectedCount > 1 ? 's' : ''} selected</span>
              <span className="cats-clear" onClick={clearAll}><X size={10} /> Clear All</span>
            </div>
          )}
        </div>
        <div className="cats-grid">
          {VIBE_CATEGORIES.map(cat => {
            const isAll = cat.label === 'All Vibes';
            const isSelected = isAll
              ? selectedVibes.length === 0
              : selectedVibes.includes(cat.label);
            return (
              <div
                key={cat.label}
                className={`vibe-chip vibe-${cat.color} ${isSelected ? 'vibe-selected' : ''}`}
                onClick={() => toggleVibe(cat.label)}
              >
                <span className="vibe-check">
                  {isSelected ? <Check size={10} strokeWidth={3} /> : null}
                </span>
                <span className="vibe-text">{cat.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="home-list">
        <div className="home-stats-row">
          <div className="hs-card"><div className="hs-num">{stats.online || '—'}</div><div className="hs-label">Online Now</div></div>
          <div className="hs-card"><div className="hs-num text-teal">₹{stats.minPrice}–₹{stats.maxPrice}</div><div className="hs-label">Price Range</div></div>
          <div className="hs-card"><div className="hs-num text-amber">{stats.avgRating}★</div><div className="hs-label">Avg Rating</div></div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text3)', fontSize: '12px' }}>Loading vibes...</div>
        ) : users.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text3)', fontSize: '12px' }}>No vibes found in this category</div>
        ) : (
          users.map((u, i) => (
            <div key={u._id} className="user-card card">
              <div className="uc-top">
                <div className={`avatar avatar-md ${AVATAR_COLORS[i % AVATAR_COLORS.length]}`}>
                  {u.profilePhoto ? <img src={u.profilePhoto} alt={u.name} className="avatar-img" /> : getInitials(u.name)}
                </div>
                <div className="uc-meta">
                  <div className="uc-name">
                    {u.name}
                    {u.isVerified && <span className="verified-badge">✓</span>}
                  </div>
                  <div className="uc-location">
                    <MapPin size={9} />
                    {u.location || 'Nearby'}
                  </div>
                </div>
                {u.currentStatus === 'online' && <div className="online-label"><span className="online-dot" /> Live</div>}
              </div>

              {u.interests?.length > 0 && (
                <div className="uc-tags">
                  {u.interests.slice(0, 3).map((interest, j) => (
                    <span key={j} className={`tag tag-${['purple', 'pink', 'teal', 'amber', 'coral'][j % 5]}`}>
                      {interest}
                    </span>
                  ))}
                </div>
              )}

              <div className="uc-footer">
                <div className="uc-price">₹{u.pricePerMinute || 3}<span className="uc-price-unit">/min</span></div>
                <div className="uc-rating">★ {u.rating?.toFixed(1) || '—'} <span className="uc-sessions">({u.totalSessions || 0} sessions)</span></div>
              </div>

              <div className="uc-btns">
                <div className="ucb-chat" onClick={() => handleChatNow(u)}>Chat Now</div>
                <div className="ucb-book" onClick={() => navigate(`/user/${u._id}`)}>View Profile</div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default DiscoverPage;
