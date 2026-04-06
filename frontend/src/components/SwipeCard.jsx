import React, { useState } from 'react';
import { motion, useMotionValue, useTransform, useAnimation } from 'framer-motion';
import { MapPin, User as UserIcon, MessageSquare, Heart, X } from 'lucide-react';

const SwipeCard = ({ user, index, totalCards, onSwipeRight, onSwipeLeft, onClick }) => {
  const [exitX, setExitX] = useState(0);
  const x = useMotionValue(0);
  const scale = useTransform(x, [-150, 0, 150], [0.95, 1, 0.95]);
  const rotate = useTransform(x, [-150, 0, 150], [-8, 0, 8]);
  
  // Opacity indicators for LIKE (right) and PASS (left)
  const likeOpacity = useTransform(x, [20, 100], [0, 1]);
  const passOpacity = useTransform(x, [-20, -100], [0, 1]);

  const animationControls = useAnimation();

  const handleDragEnd = async (event, info) => {
    const threshold = 100;
    const velocity = info.velocity.x;

    if (info.offset.x > threshold || velocity > 500) {
      // Swiped Right
      setExitX(window.innerWidth);
      onSwipeRight(user);
    } else if (info.offset.x < -threshold || velocity < -500) {
      // Swiped Left
      setExitX(-window.innerWidth);
      onSwipeLeft(user);
    } else {
      // Snap back if threshold not met
      animationControls.start({ x: 0, y: 0, transition: { type: 'spring', stiffness: 300, damping: 20 } });
    }
  };

  // Stack styling so the first card is visible, the next is slightly smaller behind it
  const isFront = index === 0;
  const isSecond = index === 1;

  const cardStyle = {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    width: '100%',
    height: '100%',
    zIndex: totalCards - index,
    pointerEvents: isFront ? 'auto' : 'none',
    opacity: index > 2 ? 0 : 1, // Only show top 3 cards
  };

  const getInitials = (name) => {
    if (!name) return '??';
    return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <motion.div
      style={{
        ...cardStyle,
        x: isFront ? x : 0,
        rotate: isFront ? rotate : 0,
        scale: isFront ? scale : isSecond ? 0.95 : 0.90,
        y: isFront ? 0 : isSecond ? 15 : 30,
      }}
      initial={isFront ? { scale: 1, y: 0 } : false}
      animate={animationControls}
      drag={isFront ? "x" : false}
      dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
      onDragEnd={handleDragEnd}
      exit={{ x: exitX, opacity: 0, transition: { duration: 0.2 } }}
      className="swipe-card"
      onClick={isFront ? onClick : undefined}
    >
      <div className="swipe-card-content glass">
        {/* Like/Pass Overlays */}
        {isFront && (
          <>
            <motion.div style={{ opacity: likeOpacity }} className="swipe-indicator like">
              <MessageSquare size={32} />
              <span>CHAT</span>
            </motion.div>
            <motion.div style={{ opacity: passOpacity }} className="swipe-indicator pass">
              <X size={40} />
              <span>PASS</span>
            </motion.div>
          </>
        )}

        {/* Profile Image / Initials */}
        <div className="sc-header">
           <div className={`avatar avatar-xl ${user.profilePhoto ? '' : 'avatar-purple'}`}>
             {user.profilePhoto ? (
               <img src={user.profilePhoto} alt={user.name} />
             ) : (
               getInitials(user.name)
             )}
           </div>
        </div>

        {/* Info Area */}
        <div className="sc-info">
          <div className="sc-name">
            {user.name}
            {user.isVerified && <span className="verified-badge">✓</span>}
          </div>
          <div className="sc-location">
            <MapPin size={12} />
            {user.location || 'Nearby'} &bull; ₹{user.pricePerMinute || 3}/min
          </div>

          {user.bio && (
            <div className="sc-bio">
              {user.bio.length > 80 ? user.bio.slice(0, 80) + '...' : user.bio}
            </div>
          )}

          {user.interests?.length > 0 && (
            <div className="sc-tags">
              {user.interests.slice(0, 3).map((item, i) => (
                <span key={i} className={`tag tag-${['purple', 'pink', 'teal'][i % 3]}`}>{item}</span>
              ))}
            </div>
          )}

          <div className="sc-stats">
            <div className="sc-stat">★ {user.rating?.toFixed(1) || '—'}</div>
            <div className="sc-stat">{user.totalSessions || 0} Sessions</div>
          </div>
        </div>

        <div className="sc-hint">Swipe Right to Chat, Left to Pass</div>
      </div>
    </motion.div>
  );
};

export default SwipeCard;
