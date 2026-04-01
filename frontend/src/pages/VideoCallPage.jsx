import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCall } from '../context/CallContext';
import {
  PhoneOff, Mic, MicOff, Video, VideoOff,
  Maximize, Minimize, AlertCircle,
} from 'lucide-react';
import './VideoCallPage.css';

const TERMINAL_STATES = new Set(['ended', 'failed', 'rejected', 'unavailable']);

const VideoCallPage = () => {
  const navigate = useNavigate();
  const {
    callState, callInfo, localStream, remoteStream,
    endCurrentCall, toggleMute, toggleCamera, setupOutgoingCall,
  } = useCall();

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [duration, setDuration] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const durationRef = useRef(null);
  const setupTriggered = useRef(false);
  const mountedAt = useRef(Date.now());

  // Trigger outgoing call setup once on mount
  useEffect(() => {
    if (callInfo?.isInitiator && callState === 'requesting-media' && !setupTriggered.current) {
      setupTriggered.current = true;
      setupOutgoingCall();
    }
  }, [callInfo, callState, setupOutgoingCall]);

  // Redirect to /chat when the call is fully idle.
  // Skip during the first 500ms to let state propagate from initiateCall.
  useEffect(() => {
    if (callState === 'idle' && callInfo === null && Date.now() - mountedAt.current > 500) {
      navigate('/chat', { replace: true });
    }
  }, [callState, callInfo, navigate]);

  // Attach local video stream
  useEffect(() => {
    const attachLocal = () => {
      if (localStream.current && localVideoRef.current) {
        localVideoRef.current.srcObject = localStream.current;
      }
    };

    attachLocal();
    window.addEventListener('local-stream-ready', attachLocal);
    return () => window.removeEventListener('local-stream-ready', attachLocal);
  }, [localStream, callState]);

  // Attach remote video stream
  useEffect(() => {
    const handleRemoteStream = (e) => {
      if (remoteVideoRef.current && e.detail) {
        remoteVideoRef.current.srcObject = e.detail;
      }
    };

    window.addEventListener('remote-stream-updated', handleRemoteStream);

    if (remoteStream.current && remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = remoteStream.current;
    }

    return () => window.removeEventListener('remote-stream-updated', handleRemoteStream);
  }, [remoteStream, callState]);

  // Duration timer when connected
  useEffect(() => {
    if (callState === 'connected') {
      setDuration(0);
      durationRef.current = setInterval(() => setDuration(d => d + 1), 1000);
    }
    return () => {
      if (durationRef.current) clearInterval(durationRef.current);
    };
  }, [callState]);

  const handleEnd = useCallback(() => {
    if (durationRef.current) clearInterval(durationRef.current);
    endCurrentCall();
  }, [endCurrentCall]);

  const handleToggleMute = () => {
    const muted = toggleMute();
    setIsMuted(muted);
  };

  const handleToggleCamera = () => {
    const off = toggleCamera();
    setIsCameraOff(off);
  };

  const handleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.();
      setIsFullscreen(false);
    }
  };

  const formatDuration = (s) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };

  const statusLabels = {
    'requesting-media': 'Requesting permissions...',
    'calling': 'Calling...',
    'connecting': 'Connecting...',
    'connected': formatDuration(duration),
    'ended': 'Call Ended',
    'failed': 'Connection Failed',
    'rejected': 'Call Declined',
    'unavailable': 'User Unavailable',
  };

  const isVideo = callInfo?.type === 'video';
  const peerName = callInfo?.peerName || 'User';
  const peerInitials = peerName.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || 'U';

  const showRemoteVideo = callState === 'connected' && isVideo;
  const isEnding = TERMINAL_STATES.has(callState);

  return (
    <div className={`vc-page ${isEnding ? 'vc-ending' : ''}`}>
      {/* Remote video (full background) */}
      {showRemoteVideo ? (
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className="vc-remote-video"
        />
      ) : (
        <div className="vc-no-video-bg">
          <div className="vc-avatar-large">{peerInitials}</div>
          <div className="vc-peer-name">{peerName}</div>
          <div className="vc-status-text">
            {callState === 'connected' && !isVideo ? (
              <span className="vc-duration">{formatDuration(duration)}</span>
            ) : (
              statusLabels[callState] || 'Connecting...'
            )}
          </div>
          {(callState === 'calling' || callState === 'connecting' || callState === 'requesting-media') && (
            <div className="vc-pulse-ring" />
          )}
        </div>
      )}

      {/* Status overlay on video */}
      {showRemoteVideo && (
        <div className="vc-top-bar">
          <div className="vc-top-info">
            <span className="vc-top-name">{peerName}</span>
            <span className="vc-top-duration">{formatDuration(duration)}</span>
          </div>
        </div>
      )}

      {/* Local video preview (PiP) */}
      {isVideo && localStream.current && (
        <div className="vc-local-pip">
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className="vc-local-video"
          />
          {isCameraOff && (
            <div className="vc-local-cam-off">
              <VideoOff size={16} />
            </div>
          )}
        </div>
      )}

      {/* Terminal state overlay */}
      {isEnding && (
        <div className="vc-end-overlay">
          <AlertCircle size={48} />
          <div className="vc-end-text">{statusLabels[callState]}</div>
          {callState === 'unavailable' && (
            <div className="vc-end-subtext">The user is not online right now.</div>
          )}
        </div>
      )}

      {/* Controls */}
      <div className="vc-controls">
        <button
          className={`vc-ctrl ${isMuted ? 'vc-ctrl-active' : ''}`}
          onClick={handleToggleMute}
          disabled={isEnding}
        >
          {isMuted ? <MicOff size={22} /> : <Mic size={22} />}
          <span>{isMuted ? 'Unmute' : 'Mute'}</span>
        </button>

        {isVideo && (
          <button
            className={`vc-ctrl ${isCameraOff ? 'vc-ctrl-active' : ''}`}
            onClick={handleToggleCamera}
            disabled={isEnding}
          >
            {isCameraOff ? <VideoOff size={22} /> : <Video size={22} />}
            <span>{isCameraOff ? 'Camera On' : 'Camera Off'}</span>
          </button>
        )}

        <button className="vc-ctrl vc-ctrl-end" onClick={handleEnd} disabled={isEnding}>
          <PhoneOff size={22} />
          <span>End</span>
        </button>

        <button className="vc-ctrl" onClick={handleFullscreen}>
          {isFullscreen ? <Minimize size={22} /> : <Maximize size={22} />}
          <span>{isFullscreen ? 'Exit' : 'Fullscreen'}</span>
        </button>
      </div>
    </div>
  );
};

export default VideoCallPage;
