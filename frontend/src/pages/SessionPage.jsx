import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Clock, Mic, MicOff } from 'lucide-react';
import './SessionPage.css';

const SessionPage = () => {
  const navigate = useNavigate();

  return (
    <div className="session-page">
      <div className="sess-header">
        <div className="sess-back" onClick={() => navigate(-1)}>← Back</div>
        <div className="sess-title">SESSION</div>
        <div className="sess-live">● LIVE</div>
      </div>

      <div className="sess-partner">
        <div className="sp-avatar avatar avatar-md avatar-purple">PS</div>
        <div className="sp-info">
          <div className="sp-name">Priya Sharma</div>
          <div className="sp-vibe">Gossip Partner · Vent Listener</div>
        </div>
        <div className="sp-rating">★ 4.9</div>
      </div>

      <div className="timer-area">
        <div className="timer-ring-outer">
          <svg className="timer-ring-svg" viewBox="0 0 160 160" fill="none">
            <circle cx="80" cy="80" r="70" stroke="#1e1e38" strokeWidth="8"/>
            <circle cx="80" cy="80" r="70" stroke="#7F77DD" strokeWidth="8" strokeLinecap="round" strokeDasharray="440" strokeDashoffset="150" transform="rotate(-90 80 80)"/>
          </svg>
          <div className="timer-inner">
            <div className="timer-num">14:32</div>
            <div className="timer-label">ELAPSED</div>
          </div>
        </div>
        <div className="timer-pulse">SESSION IN PROGRESS</div>
      </div>

      <div className="cost-cards">
        <div className="cost-card">
          <div className="cc-label">TOTAL COST</div>
          <div className="cc-val">₹43</div>
          <div className="cc-sub">@₹3/min</div>
        </div>
        <div className="cost-card">
          <div className="cc-label">WALLET</div>
          <div className="cc-val">₹842</div>
          <div className="cc-sub">balance left</div>
        </div>
      </div>

      <div className="session-actions">
        <div className="sa-mute">
          <Mic size={16} />
          <span>Mute</span>
        </div>
        <div className="sa-end" onClick={() => navigate('/rating/demo')}>End Session</div>
        <div className="sa-extend">
          <Clock size={16} />
          <span>+15 min</span>
        </div>
      </div>

      <div className="session-notes">
        <div className="sn-card">
          <div className="sn-title">SESSION INFO</div>
          <div className="sn-rows">
            <div className="sn-row"><span className="k">Started</span><span className="v">10:22 AM</span></div>
            <div className="sn-row"><span className="k">Rate</span><span className="v">₹3/min</span></div>
            <div className="sn-row"><span className="k">Mode</span><span className="v">Anonymous Chat</span></div>
            <div className="sn-row"><span className="k">Auto-end</span><span className="v">11:22 AM</span></div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SessionPage;
