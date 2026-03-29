import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, VideoOff, Phone } from 'lucide-react';
import './VideoCallPage.css';

const VideoCallPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { url, partnerName } = location.state || {};
  const jitsiContainer = useRef(null);
  const [apiLoaded, setApiLoaded] = useState(false);
  const [callActive, setCallActive] = useState(false);

  useEffect(() => {
    if (!url) {
      navigate('/home');
      return;
    }

    // Extract room name from URL
    const roomName = url.split('/').pop() || `vibeme_${Date.now()}`;

    // Load Jitsi Meet External API script
    const script = document.createElement('script');
    script.src = 'https://meet.jit.si/external_api.js';
    script.async = true;
    script.onload = () => {
      setApiLoaded(true);
      initJitsi(roomName);
    };
    script.onerror = () => {
      console.error('Failed to load Jitsi API');
      // Fallback to iframe
      setCallActive(true);
    };
    document.head.appendChild(script);

    return () => {
      try { document.head.removeChild(script); } catch(e) {}
    };
  }, [url]);

  const initJitsi = (roomName) => {
    if (!jitsiContainer.current || !window.JitsiMeetExternalAPI) return;

    try {
      const api = new window.JitsiMeetExternalAPI('meet.jit.si', {
        roomName: roomName,
        parentNode: jitsiContainer.current,
        width: '100%',
        height: '100%',
        configOverwrite: {
          startWithAudioMuted: false,
          startWithVideoMuted: false,
          disableDeepLinking: true,
          prejoinPageEnabled: false,
          enableClosePage: false,
          disableInviteFunctions: true,
          toolbarButtons: [
            'microphone', 'camera', 'hangup', 'chat',
            'tileview', 'fullscreen', 'toggle-camera',
          ],
        },
        interfaceConfigOverwrite: {
          SHOW_JITSI_WATERMARK: false,
          SHOW_WATERMARK_FOR_GUESTS: false,
          DEFAULT_BACKGROUND: '#090914',
          TOOLBAR_ALWAYS_VISIBLE: true,
          MOBILE_APP_PROMO: false,
          HIDE_INVITE_MORE_HEADER: true,
          DISPLAY_WELCOME_PAGE_CONTENT: false,
        },
        userInfo: {
          displayName: partnerName ? `Caller → ${partnerName}` : 'VibeMe User',
        },
      });

      setCallActive(true);

      api.addEventListener('readyToClose', () => {
        navigate(-1);
      });

      api.addEventListener('videoConferenceLeft', () => {
        navigate(-1);
      });

    } catch (err) {
      console.error('Jitsi init failed:', err);
      setCallActive(true); // fallback to iframe
    }
  };

  if (!url) return null;

  return (
    <div className="video-call-page">
      <div className="vc-header">
        <button className="vc-back" onClick={() => navigate(-1)}>
          <ArrowLeft size={24} />
        </button>
        <div className="vc-title">
          <Phone size={16} /> Call with {partnerName || 'User'}
        </div>
      </div>
      
      <div className="vc-frame-container">
        {/* Jitsi will render here */}
        <div ref={jitsiContainer} className="vc-jitsi-container" />
        
        {/* Fallback iframe */}
        {!apiLoaded && callActive && (
          <iframe 
            src={url} 
            allow="camera; microphone; fullscreen; display-capture; autoplay"
            className="vc-iframe"
            title="Video Call"
          />
        )}
        
        {!callActive && (
          <div className="vc-loading">
            <div className="spinner" />
            <p style={{ marginTop: '16px', color: 'var(--text3)', fontSize: '13px' }}>
              Setting up secure video call...
            </p>
          </div>
        )}
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
