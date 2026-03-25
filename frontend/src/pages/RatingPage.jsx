import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle } from 'lucide-react';
import './RatingPage.css';

const QUICK_TAGS = ['Great listener', 'Very helpful', 'On time', 'No judgment', 'Good vibe', 'Patient', 'Funny', 'Kind'];

const RatingPage = () => {
  const navigate = useNavigate();
  const [stars, setStars] = useState(5);
  const [selectedTags, setSelectedTags] = useState(['Great listener', 'Very helpful', 'No judgment']);
  const [review, setReview] = useState('');

  const toggleTag = (tag) => {
    setSelectedTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  };

  return (
    <div className="rating-page">
      <div className="rating-top">
        <div className="rt-check"><CheckCircle size={28} color="#fff" /></div>
        <h2 className="rt-title">Session Complete!</h2>
        <p className="rt-sub">How was your time with Priya?</p>
      </div>

      <div className="rating-summary">
        <div className="rs-item"><div className="rs-val">32 min</div><div className="rs-label">Duration</div></div>
        <div className="rs-item"><div className="rs-val">₹96</div><div className="rs-label">Paid</div></div>
        <div className="rs-item"><div className="rs-val">Priya S.</div><div className="rs-label">You chatted with</div></div>
      </div>

      <div className="rating-body">
        <div className="rb-section">
          <div className="section-title">RATE YOUR EXPERIENCE</div>
          <div className="star-row">
            {[1, 2, 3, 4, 5].map(n => (
              <span key={n} className={`star ${n <= stars ? 'lit' : ''}`} onClick={() => setStars(n)}>★</span>
            ))}
          </div>
        </div>

        <div className="rb-section">
          <div className="section-title">QUICK FEEDBACK</div>
          <div className="quick-tags">
            {QUICK_TAGS.map(tag => (
              <div key={tag} className={`qt ${selectedTags.includes(tag) ? 'sel' : ''}`} onClick={() => toggleTag(tag)}>
                {tag}
              </div>
            ))}
          </div>
        </div>

        <div className="rb-section">
          <div className="section-title">WRITE A REVIEW (optional)</div>
          <textarea className="rating-textarea" placeholder="Tell others about your experience..." value={review} onChange={e => setReview(e.target.value)} />
        </div>

        <button className="btn btn-primary btn-block" onClick={() => navigate('/discover')}>
          Submit & Continue →
        </button>
      </div>
    </div>
  );
};

export default RatingPage;
