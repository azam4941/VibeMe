import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Clock, CheckCircle, XCircle, PlayCircle, StopCircle, 
  IndianRupee, Star, RefreshCw, CalendarOff, ArrowLeft 
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import './BookingsPage.css';
import api from '../services/api';

const BookingsPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [sessions, setSessions] = useState({ buyer: [], renter: [] });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('buyer'); // 'buyer' or 'renter'
  const [activeSession, setActiveSession] = useState(null);

  useEffect(() => {
    fetchSessions();
    const interval = setInterval(fetchSessions, 15000); // Polling for updates
    return () => clearInterval(interval);
  }, []);

  const fetchSessions = async () => {
    try {
      const buyerSessions = await api.getMySessions('buyer');
      const renterSessions = await api.getMySessions('renter');
      
      setSessions({
        buyer: buyerSessions,
        renter: renterSessions
      });

      // Find any ongoing session to display in the live timer
      const ongoing = [...buyerSessions, ...renterSessions].find(s => s.status === 'active');
      setActiveSession(ongoing || null);
    } catch (err) {
      console.error('Failed to fetch sessions:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (action, sessionId) => {
    try {
      if (action === 'accept') await api.acceptSession(sessionId);
      if (action === 'start') await api.startSession(sessionId);
      if (action === 'end') await api.endSession(sessionId, 'Completed manually');
      if (action === 'cancel') await api.cancelSession(sessionId, 'User cancelled');
      
      fetchSessions();
    } catch (err) {
      alert(err.message || `Failed to ${action} session`);
    }
  };

  // Timer component for active session
  const LiveTimer = ({ session }) => {
    const [elapsed, setElapsed] = useState(0);
    const costPerMinute = session.pricePerMinute;

    useEffect(() => {
      if (!session.startTime) return;
      const start = new Date(session.startTime).getTime();
      
      const updateTimer = () => {
        const now = Date.now();
        const diffInMinutes = Math.max(0, (now - start) / 60000);
        setElapsed(diffInMinutes);
      };

      updateTimer();
      const interval = setInterval(updateTimer, 1000);
      return () => clearInterval(interval);
    }, [session.startTime]);

    const currentCost = Math.ceil(elapsed) * costPerMinute;
    const isRenter = user._id === session.renterId._id;

    return (
      <motion.div 
        className="live-session-tracker glass pulse-subtle"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
      >
        <div className="live-header">
          <div className="live-pulse"><span className="dot"></span> Live Session</div>
          <h3>Session with {isRenter ? session.buyerId.name : session.renterId.name}</h3>
        </div>

        <div className="live-stats">
          <div className="stat-box">
            <Clock size={24} className="text-accent" />
            <div className="stat-val">{Math.floor(elapsed)}m {(Math.floor((elapsed % 1) * 60)).toString().padStart(2, '0')}s</div>
            <div className="stat-label">Elapsed Time</div>
          </div>
          
          <div className="stat-box">
            <IndianRupee size={24} className="text-hot" />
            <div className="stat-val">Rs. {currentCost}</div>
            <div className="stat-label">{isRenter ? 'Earned' : 'Cost'} So Far</div>
          </div>
        </div>

        <div className="live-actions">
          <button 
            className="btn btn-danger btn-lg w-full"
            onClick={() => handleAction('end', session._id)}
          >
            <StopCircle /> End Session
          </button>
        </div>
      </motion.div>
    );
  };

  const renderSessionCard = (session, role) => {
    const isRenter = role === 'renter';
    const otherUser = isRenter ? session.buyerId : session.renterId;
    
    return (
      <motion.div 
        key={session._id} 
        className={`session-card glass status-${session.status}`}
        layout
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="session-header">
          <div className="session-user">
            <img src={otherUser.profilePhoto || `https://avatar.iran.liara.run/public?username=${otherUser.name}`} alt={otherUser.name} className="avatar avatar-sm" />
            <div>
              <p className="font-semibold">{otherUser.name}</p>
              <p className="text-xs text-muted">{new Date(session.createdAt).toLocaleDateString()}</p>
            </div>
          </div>
          <span className={`status-badge status-${session.status}`}>{session.status}</span>
        </div>

        <div className="session-details">
          <div className="detail-row">
            <span>Rate</span>
            <span className="font-semibold">Rs. {session.pricePerMinute}/min</span>
          </div>
          {session.status === 'completed' && (
            <>
              <div className="detail-row">
                <span>Duration</span>
                <span>{session.totalDuration} min</span>
              </div>
              <div className="detail-row highlight">
                <span>Total {isRenter ? 'Earned' : 'Paid'}</span>
                <span>Rs. {session.totalCost}</span>
              </div>
            </>
          )}
          {session.notes && (
            <div className="session-notes">
              <p className="text-sm">"{session.notes}"</p>
            </div>
          )}
        </div>

        {/* Actions based on status */}
        <div className="session-actions">
          {session.status === 'pending' && isRenter && (
            <>
              <button className="btn btn-success flex-1" onClick={() => handleAction('accept', session._id)}>
                <CheckCircle size={16} /> Accept
              </button>
              <button className="btn btn-danger flex-1" onClick={() => handleAction('cancel', session._id)}>
                <XCircle size={16} /> Decline
              </button>
            </>
          )}
          
          {session.status === 'pending' && !isRenter && (
            <button className="btn btn-outline flex-1" onClick={() => handleAction('cancel', session._id)}>
              <XCircle size={16} /> Cancel Request
            </button>
          )}

          {session.status === 'accepted' && (
            <>
              <button className="btn btn-primary flex-1" onClick={() => handleAction('start', session._id)}>
                <PlayCircle size={16} /> Start Session
              </button>
              <button className="btn btn-outline flex-1" onClick={() => handleAction('cancel', session._id)}>
                <XCircle size={16} /> Cancel
              </button>
            </>
          )}

          {session.status === 'completed' && ((isRenter && !session.renterReviewed) || (!isRenter && !session.buyerReviewed)) && (
            <button className="btn btn-outline flex-1 w-full" onClick={() => alert('Review functionality coming next!')}>
              <Star size={16} /> Leave Review
            </button>
          )}
        </div>
      </motion.div>
    );
  };

  const displayList = sessions[activeTab];

  return (
    <div className="bookings-container container">
      <div className="page-header wh-top-row">
        <button className="back-btn" onClick={() => navigate('/profile')}><ArrowLeft size={20} /></button>
        <h1 className="wh-title">Sessions & Bookings</h1>
        <button className="btn btn-icon btn-outline" onClick={fetchSessions} title="Refresh">
          <RefreshCw size={18} className={loading ? 'spinning' : ''} />
        </button>
      </div>

      {activeSession && <LiveTimer session={activeSession} />}

      <div className="profile-tabs glass mt-24">
        <button 
          className={`tab-btn ${activeTab === 'buyer' ? 'active' : ''}`}
          onClick={() => setActiveTab('buyer')}
        >
          My Bookings (Found People)
        </button>
        <button 
          className={`tab-btn ${activeTab === 'renter' ? 'active' : ''}`}
          onClick={() => setActiveTab('renter')}
        >
          My Clients (Offered Time)
        </button>
      </div>

      <div className="sessions-list mt-24">
        {loading ? (
          <div className="loading-state h-64"><div className="spinner" /></div>
        ) : displayList.length === 0 ? (
          <div className="empty-state card glass">
            <CalendarOff size={48} opacity={0.2} />
            <h3>No sessions found</h3>
            <p>You don't have any {activeTab === 'buyer' ? 'bookings' : 'clients'} yet.</p>
          </div>
        ) : (
          <div className="sessions-grid">
            <AnimatePresence>
              {displayList.map(session => renderSessionCard(session, activeTab))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
};

export default BookingsPage;
