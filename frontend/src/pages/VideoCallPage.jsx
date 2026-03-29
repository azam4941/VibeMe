import React, { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, VideoOff } from 'lucide-react';
import './VideoCallPage.css';

const VideoCallPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { url, partnerName } = location.state || {};

  useEffect(() => {
    if (!url) {
      navigate('/home');
    }
  }, [url, navigate]);

  if (!url) return null;

  return (
    <div className="video-call-page">
      <div className="vc-header">
        <button className="vc-back" onClick={() => navigate(-1)}>
          <ArrowLeft size={24} />
        </button>
        <div className="vc-title">
          Secure Call with {partnerName || 'User'}
        </div>
      </div>
      
      <div className="vc-frame-container">
        <iframe 
          src={url} 
          allow="camera; microphone; fullscreen; display-capture; autoplay"
          className="vc-iframe"
          title="Video Call"
        />
      </div>
      
      <div className="vc-footer">
        <button className="vc-end-btn" onClick={() => navigate(-1)}>
          <VideoOff size={20} /> End Call
        </button>
      </div>
    </div>
  );
};

export default VideoCallPage;
