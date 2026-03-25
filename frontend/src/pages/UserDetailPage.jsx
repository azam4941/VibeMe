import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  Star, MessageCircle, Clock, ShieldCheck, 
  MapPin, CheckCircle, Info, CalendarClock, ChevronLeft, Flag, Ban 
} from 'lucide-react';
import './UserDetailPage.css';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

const UserDetailPage = () => {
  const { userId } = useParams();
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  
  const [profile, setProfile] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isBooking, setIsBooking] = useState(false);
  const [isReporting, setIsReporting] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [showReportModal, setShowReportModal] = useState(false);

  useEffect(() => {
    fetchUserDetails();
  }, [userId]);

  const fetchUserDetails = async () => {
    try {
      setLoading(true);
      const [userRes, reviewsRes] = await Promise.all([
        api.getUserById(userId),
        api.getUserReviews(userId)
      ]);
      setProfile(userRes);
      setReviews(reviewsRes);
    } catch (err) {
      setError('Failed to load user profile');
    } finally {
      setLoading(false);
    }
  };

  const handleStartChat = async () => {
    try {
      const room = await api.createChatRoom(userId);
      navigate(`/chat/${room._id}`);
    } catch (err) {
      alert('Failed to start chat: ' + err.message);
    }
  };

  const handleBookSession = async () => {
    if (!profile.rentMode) return alert('This user is not accepting bookings.');
    setIsBooking(true);
    try {
      await api.createSession(userId, 'Booking request from profile');
      alert('Booking request sent successfully!');
      navigate('/bookings');
    } catch (err) {
      alert('Booking failed: ' + err.message);
    } finally {
      setIsBooking(false);
    }
  };

  const handleReportUser = async () => {
    if (!reportReason.trim()) return alert('Please provide a reason for reporting.');
    setIsReporting(true);
    try {
      await api.createReport({
        reportedUserId: userId,
        reason: reportReason,
        details: 'User reported from profile page'
      });
      alert('Report submitted successfully. Our safety team will review it.');
      setShowReportModal(false);
      setReportReason('');
    } catch (err) {
      alert('Failed to submit report: ' + err.message);
    } finally {
      setIsReporting(false);
    }
  };

  const handleBlockUser = async () => {
    if (!window.confirm('Are you sure you want to block this user? You will not be able to message them or see their profile.')) return;
    try {
      await api.blockUser(userId, 'Blocked from profile page');
      alert('User blocked successfully.');
      navigate('/discover');
    } catch (err) {
      alert('Failed to block user: ' + err.message);
    }
  };

  if (loading) return <div className="loading-page"><div className="spinner" /></div>;
  if (error || !profile) return <div className="error-state">{error || 'User not found'}</div>;

  const isVerifiedViewer = currentUser?.isVerified;
  const isSelf = currentUser?._id === profile._id;

  return (
    <div className="user-detail-container pb-24">
      <div className="detail-hero">
        <button className="back-btn glass" onClick={() => navigate(-1)}>
          <ChevronLeft /> Back
        </button>
        
        <div className="hero-gradient" />
        
        <div className="hero-content container">
          <motion.div 
            className="hero-avatar-wrapper"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", bounce: 0.5 }}
          >
            <img 
              src={profile.profilePhoto || `https://avatar.iran.liara.run/public?username=${profile.name}`} 
              alt={profile.name}
              className={`hero-avatar ${profile.isPhotoLocked && !isVerifiedViewer ? 'blurred' : ''}`}
            />
            {profile.isVerified && (
              <div className="hero-verified-badge" title="Trusted & Verified Member">
                <CheckCircle size={20} />
              </div>
            )}
          </motion.div>

          <motion.div 
            className="hero-info"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1 }}
          >
            <h1 className="hero-name">
              {profile.name}
              {profile.isVerified && <CheckCircle size={24} className="verified-icon-inline" fill="var(--primary-500)" color="white" />}
            </h1>
            
            <div className="hero-stats">
              <div className="stat-pill">
                <Star className="stat-icon star" size={16} />
                <span>{profile.rating?.toFixed(1) || '0.0'} ({reviews.length} reviews)</span>
              </div>
              <div className="stat-pill">
                <ShieldCheck className="stat-icon" size={16} />
                <span>{profile.isVerified ? 'Verified Identity' : 'Basic Profile'}</span>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      <div className="container mt-neg">
        <div className="detail-grid">
          <div className="detail-main">
            <motion.section 
              className="card glass about-section"
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              <h2>About</h2>
              <p className="bio-text">{profile.bio || "No bio provided."}</p>
              
              <h3 className="section-subtitle mt-24">Interests & Expertise</h3>
              <div className="tags">
                {profile.interests?.length > 0 ? (
                  profile.interests.map(i => <span key={i} className="tag">{i}</span>)
                ) : (
                  <span className="text-muted text-sm">No general interests listed</span>
                )}
              </div>

              {profile.findInterests?.length > 0 && (
                <>
                  <h3 className="section-subtitle mt-24">Looking For</h3>
                  <div className="tags">
                    {profile.findInterests.map(i => <span key={i} className="tag tag-accent">{i}</span>)}
                  </div>
                </>
              )}

              {profile.professionalInterests?.length > 0 && (
                <>
                  <h3 className="section-subtitle mt-24">Professional Goals</h3>
                  <div className="tags">
                    {profile.professionalInterests.map(i => <span key={i} className="tag tag-success">{i}</span>)}
                  </div>
                </>
              )}
            </motion.section>


            <motion.section 
              className="mt-24"
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3 }}
            >
              <h2>Recent Reviews</h2>
              <div className="reviews-list">
                {reviews.length === 0 ? (
                  <div className="empty-reviews card glass">
                    <Star size={32} opacity={0.2} />
                    <p>No reviews yet.</p>
                  </div>
                ) : (
                  reviews.map(review => (
                    <div key={review._id} className="review-card glass">
                      <div className="review-header">
                        <div className="reviewer-info">
                          <img src={review.reviewerId.profilePhoto || `https://avatar.iran.liara.run/public?username=${review.reviewerId.name}`} alt="Reviewer" className="avatar avatar-sm" />
                          <span className="reviewer-name">{review.reviewerId.name}</span>
                        </div>
                        <div className="stars">
                          {[1,2,3,4,5].map(s => (
                            <Star key={s} size={14} fill={s <= review.rating ? '#f97316' : 'none'} color={s <= review.rating ? '#f97316' : 'var(--text-muted)'} />
                          ))}
                        </div>
                      </div>
                      <p className="review-comment">{review.comment}</p>
                    </div>
                  ))
                )}
              </div>
            </motion.section>
          </div>

          <div className="detail-sidebar">
            <motion.div 
              className="booking-card card sticky-top"
              initial={{ x: 20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.4 }}
            >
              {profile.rentMode ? (
                <>
                  <div className="price-display">
                    {profile.pricePerMinute === 0 ? (
                      <span className="free-price-tag">FREE SESSION</span>
                    ) : (
                      <>
                        <span className="currency">₹</span>
                        <span className="amount">{profile.pricePerMinute}</span>
                        <span className="unit">/ min</span>
                      </>
                    )}
                  </div>
                  
                  <div className="availability-box">
                    <h4 className="flex items-center gap-2"><CalendarClock size={16} /> Weekly Availability</h4>
                    {profile.availability?.length > 0 ? (
                      <ul className="availability-list">
                        {profile.availability.map((slot, i) => (
                          <li key={i}>
                            <span className="day">{slot.day}</span>
                            <span className="time">{slot.startTime} - {slot.endTime}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-muted text-sm mt-8">No specific hours set.</p>
                    )}
                  </div>

                  {!isSelf && (
                    <button 
                      className="btn btn-primary w-full mt-24"
                      onClick={handleBookSession}
                      disabled={isBooking}
                    >
                      <Clock size={18} /> {isBooking ? 'Requesting...' : 'Request Session'}
                    </button>
                  )}
                </>
              ) : (
                <div className="not-renting-msg">
                  <Info size={40} className="mb-12" opacity={0.5} />
                  <h3>Not Offering Time</h3>
                  <p>This user is currently using the platform to find people.</p>
                </div>
              )}

              {!isSelf && (
                <>
                  <div className="divider" />
                  <button className="btn btn-secondary w-full mb-12" onClick={handleStartChat}>
                    <MessageCircle size={18} /> Send Message
                  </button>
                  <div className="safety-actions">
                    <button className="btn btn-outline w-full mb-12" onClick={() => setShowReportModal(true)}>
                      <Flag size={18} /> Report User
                    </button>
                    <button className="btn btn-ghost w-full danger" onClick={handleBlockUser}>
                      <Ban size={18} /> Block User
                    </button>
                  </div>
                </>
              )}
            </motion.div>
          </div>
        </div>
      </div>

      {/* Report Modal */}
      {showReportModal && (
        <div className="modal-overlay" onClick={() => setShowReportModal(false)}>
          <div className="modal-content glass" onClick={e => e.stopPropagation()}>
            <h3>Report {profile.name}</h3>
            <p className="text-muted text-sm mb-16">Please let us know why you are reporting this user. This helps us keep RentMe safe.</p>
            
            <select 
              className="input mb-12"
              value={reportReason}
              onChange={e => setReportReason(e.target.value)}
            >
              <option value="">Select a reason...</option>
              <option value="Inappropriate Profile">Inappropriate Profile</option>
              <option value="Harassment">Harassment</option>
              <option value="Scam/Fraud">Scam/Fraud</option>
              <option value="Adult/Escort Services">Adult/Escort Services</option>
              <option value="Underage User">Underage User</option>
              <option value="Other">Other</option>
            </select>

            <div className="modal-actions mt-16">
              <button className="btn btn-ghost" onClick={() => setShowReportModal(false)}>Cancel</button>
              <button 
                className="btn btn-primary" 
                onClick={handleReportUser}
                disabled={isReporting || !reportReason}
              >
                {isReporting ? 'Submitting...' : 'Submit Report'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserDetailPage;

