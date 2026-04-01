import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  Bell, MapPin, Check, X, ChevronDown, ChevronUp,
  Search, SlidersHorizontal, Star, Clock, TrendingUp,
  MessageSquare, User as UserIcon, Video,
} from 'lucide-react';
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

const SORT_OPTIONS = [
  { value: 'rating', label: 'Top Rated', icon: Star },
  { value: 'price_asc', label: 'Price: Low→High', icon: TrendingUp },
  { value: 'price_desc', label: 'Price: High→Low', icon: TrendingUp },
  { value: 'sessions', label: 'Most Sessions', icon: Clock },
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
  const [isVibeDropdownOpen, setIsVibeDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('rating');
  const [showSortMenu, setShowSortMenu] = useState(false);
  const debounceRef = useRef(null);

  const fetchUsers = useCallback(async (vibes, currentMode, search, sort) => {
    setLoading(true);
    try {
      const filters = { sortBy: sort };
      const active = vibes.filter(v => v !== 'All Vibes');
      if (active.length > 0) filters.interests = active.join(',');
      if (search?.trim()) filters.search = search.trim();

      const data = await api.discover(filters);
      let filtered = (data.users || []).filter(u => u._id !== user?._id);

      if (currentMode === 'offer') {
        filtered = filtered.filter(u => !u.rentMode || u._id);
      }

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
      } else {
        setStats({ online: 0, minPrice: 0, maxPrice: 0, avgRating: 0 });
      }
    } catch (err) {
      console.error('Failed to fetch users:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchUsers(selectedVibes, mode, searchQuery, sortBy);
  }, [selectedVibes, mode, sortBy]);

  const handleSearchChange = (e) => {
    const val = e.target.value;
    setSearchQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchUsers(selectedVibes, mode, val, sortBy);
    }, 400);
  };

  const toggleVibe = (label) => {
    if (label === 'All Vibes') {
      setSelectedVibes([]);
      return;
    }
    setSelectedVibes(prev => {
      if (prev.includes(label)) return prev.filter(v => v !== label);
      return [...prev, label];
    });
  };

  const clearAll = (e) => {
    e.stopPropagation();
    setSelectedVibes([]);
  };

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
      const rid = room?._id ?? room?.id;
      if (!rid) {
        console.error('createChatRoom: missing room id', room);
        navigate('/chat');
        return;
      }
      navigate(`/chat/${rid}`, { state: { room } });
    } catch (err) {
      console.error('Failed to create chat room:', err);
      navigate('/chat');
    }
  };

  const selectedCount = selectedVibes.length;
  const activeSortLabel = SORT_OPTIONS.find(o => o.value === sortBy)?.label || 'Top Rated';

  return (
    <div className="discover-page page">
      <div className="home-header dark-header">
        <div className="hh-row">
          <div>
            <div className="hh-logo">VibeMe</div>
            <div className="hh-greeting">{getGreeting()}, {user?.name?.split(' ')[0] || 'there'}</div>
            <div className="hh-sub">Find your vibe today</div>
          </div>
          <div className="hh-right">
            <div className="hh-notif" onClick={() => navigate('/notifications')}>
              <Bell size={16} />
              <div className="notif-badge" />
            </div>
          </div>
        </div>

        {/* Search Bar */}
        <div className="discover-search-bar">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            placeholder="Search by name..."
            value={searchQuery}
            onChange={handleSearchChange}
            className="discover-search-input"
          />
          {searchQuery && (
            <button className="search-clear" onClick={() => { setSearchQuery(''); fetchUsers(selectedVibes, mode, '', sortBy); }}>
              <X size={14} />
            </button>
          )}
        </div>

        <div className="home-toggle">
          <div className={`ht ${mode === 'find' ? 'on' : ''}`} onClick={() => setMode('find')}>Find People</div>
          <div className={`ht ${mode === 'offer' ? 'on' : ''}`} onClick={() => setMode('offer')}>Offer Time</div>
        </div>
      </div>

      <div className="home-list">
        {mode === 'offer' && (
          <div className="offer-mode-banner">
            <p>Showing users you've rented or requested time from.</p>
          </div>
        )}

        <div className="home-stats-row">
          <div className="hs-card"><div className="hs-num">{stats.online || '0'}</div><div className="hs-label">Online Now</div></div>
          <div className="hs-card"><div className="hs-num text-teal">{stats.minPrice > 0 ? `₹${stats.minPrice}–₹${stats.maxPrice}` : '—'}</div><div className="hs-label">Price Range</div></div>
          <div className="hs-card"><div className="hs-num text-amber">{stats.avgRating}★</div><div className="hs-label">Avg Rating</div></div>
        </div>

        {/* Sort Control */}
        <div className="discover-sort-row">
          <span className="sort-label">{users.length} people found</span>
          <div className="sort-dropdown-wrap">
            <button className="sort-trigger" onClick={() => setShowSortMenu(!showSortMenu)}>
              <SlidersHorizontal size={13} /> {activeSortLabel}
              <ChevronDown size={12} />
            </button>
            {showSortMenu && (
              <div className="sort-dropdown" onMouseLeave={() => setShowSortMenu(false)}>
                {SORT_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    className={`sort-option ${sortBy === opt.value ? 'sort-active' : ''}`}
                    onClick={() => { setSortBy(opt.value); setShowSortMenu(false); }}
                  >
                    <opt.icon size={13} /> {opt.label}
                    {sortBy === opt.value && <Check size={12} />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Dropdown for Browse by Vibe */}
        <div className="vibe-dropdown-container">
          <div
            className="vibe-dropdown-header"
            onClick={() => setIsVibeDropdownOpen(!isVibeDropdownOpen)}
          >
            <div className="cats-label" style={{ marginBottom: 0 }}>
              BROWSE BY VIBE
              {selectedCount > 0 && <span className="cats-count-badge">{selectedCount}</span>}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {selectedCount > 0 && (
                <span className="cats-clear" onClick={clearAll}><X size={10} /> Clear</span>
              )}
              {isVibeDropdownOpen ? <ChevronUp size={16} color="var(--text3)" /> : <ChevronDown size={16} color="var(--text3)" />}
            </div>
          </div>

          {isVibeDropdownOpen && (
            <div className="cats-grid dropdown-cats-grid">
              {VIBE_CATEGORIES.map(cat => {
                const isAll = cat.label === 'All Vibes';
                const isSelected = isAll ? selectedVibes.length === 0 : selectedVibes.includes(cat.label);
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
          )}
        </div>

        {loading ? (
          <div className="discover-loading">
            <div className="spinner" />
            <span>Finding vibes...</span>
          </div>
        ) : users.length === 0 ? (
          <div className="discover-empty">
            <UserIcon size={36} opacity={0.3} />
            <p>{searchQuery ? `No results for "${searchQuery}"` : 'No vibes found in this category'}</p>
            {searchQuery && (
              <button className="btn btn-sm btn-secondary" onClick={() => { setSearchQuery(''); fetchUsers(selectedVibes, mode, '', sortBy); }}>Clear Search</button>
            )}
          </div>
        ) : (
          users.map((u, i) => (
            <div key={u._id} className="user-card card" onClick={() => navigate(`/user/${u._id}`)} style={{ cursor: 'pointer' }}>
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
                  {u.bio && (
                    <div className="uc-bio">{u.bio.length > 60 ? u.bio.slice(0, 60) + '...' : u.bio}</div>
                  )}
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
                  {u.interests.length > 3 && (
                    <span className="tag tag-purple" style={{ opacity: 0.6 }}>+{u.interests.length - 3}</span>
                  )}
                </div>
              )}

              <div className="uc-footer">
                <div className="uc-price">₹{u.pricePerMinute || 3}<span className="uc-price-unit">/min</span></div>
                <div className="uc-rating">★ {u.rating?.toFixed(1) || '—'} <span className="uc-sessions">({u.totalSessions || 0} sessions)</span></div>
              </div>

              <div className="uc-btns">
                <div className="ucb-chat" onClick={(e) => { e.stopPropagation(); handleChatNow(u); }}>
                  <MessageSquare size={14} /> Chat Now
                </div>
                <div className="ucb-book" onClick={(e) => { e.stopPropagation(); navigate(`/user/${u._id}`); }}>
                  <UserIcon size={14} /> View Profile
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default DiscoverPage;
