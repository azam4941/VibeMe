import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import socketService from '../services/socket';

const CallContext = createContext(null);

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'turn:openrelay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' },
  { urls: 'turn:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' },
  { urls: 'turn:openrelay.metered.ca:443?transport=tcp', username: 'openrelayproject', credential: 'openrelayproject' },
];

const CALL_TIMEOUT_MS = 30000;

export function CallProvider({ children }) {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [incomingCall, setIncomingCall] = useState(null);
  const [callState, setCallState] = useState('idle');
  const [callInfo, setCallInfo] = useState(null);

  const peerConnection = useRef(null);
  const localStream = useRef(null);
  const remoteStream = useRef(null);
  const pendingCandidates = useRef([]);
  const callStateRef = useRef(callState);
  callStateRef.current = callState;
  const disconnectTimerRef = useRef(null);
  const callTimeoutRef = useRef(null);

  // Stops media tracks and closes peer connection (does NOT touch callInfo/callState)
  const stopMedia = useCallback(() => {
    if (disconnectTimerRef.current) {
      clearTimeout(disconnectTimerRef.current);
      disconnectTimerRef.current = null;
    }
    if (callTimeoutRef.current) {
      clearTimeout(callTimeoutRef.current);
      callTimeoutRef.current = null;
    }
    if (localStream.current) {
      localStream.current.getTracks().forEach(t => t.stop());
      localStream.current = null;
    }
    if (peerConnection.current) {
      peerConnection.current.close();
      peerConnection.current = null;
    }
    remoteStream.current = null;
    pendingCandidates.current = [];
  }, []);

  // Full reset: stop media + clear all call state back to idle
  const fullReset = useCallback(() => {
    stopMedia();
    setIncomingCall(null);
    setCallInfo(null);
    setCallState('idle');
  }, [stopMedia]);

  // ─── Socket event listeners (stable — no callState in deps) ───
  useEffect(() => {
    if (!user?._id) return;

    const handleIncoming = (data) => {
      if (callStateRef.current !== 'idle') {
        socketService.rejectCall({ to: data.from, from: user._id });
        return;
      }
      setIncomingCall(data);
    };

    const handleCallEnded = () => {
      stopMedia();
      setIncomingCall(null);
      setCallState('ended');
      // callInfo preserved so UI can still show peer name
      setTimeout(() => { setCallInfo(null); setCallState('idle'); }, 2500);
    };

    const handleCallRejected = () => {
      stopMedia();
      setIncomingCall(null);
      setCallState('rejected');
      setTimeout(() => { setCallInfo(null); setCallState('idle'); }, 2500);
    };

    const handleCallUnavailable = () => {
      stopMedia();
      setIncomingCall(null);
      setCallState('unavailable');
      setTimeout(() => { setCallInfo(null); setCallState('idle'); }, 3000);
    };

    socketService.onIncomingCall(handleIncoming);
    socketService.onCallEnded(handleCallEnded);
    socketService.onCallRejected(handleCallRejected);
    socketService.onCallUnavailable(handleCallUnavailable);

    return () => {
      socketService.offIncomingCall(handleIncoming);
      socketService.offCallEnded(handleCallEnded);
      socketService.offCallRejected(handleCallRejected);
      socketService.offCallUnavailable(handleCallUnavailable);
    };
  }, [user, stopMedia]);

  const getMediaStream = async (type) => {
    const constraints = {
      audio: true,
      video: type === 'video' ? { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } } : false,
    };
    return navigator.mediaDevices.getUserMedia(constraints);
  };

  const createPeerConnection = useCallback((peerId) => {
    if (disconnectTimerRef.current) {
      clearTimeout(disconnectTimerRef.current);
      disconnectTimerRef.current = null;
    }
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    pc.onicecandidate = (event) => {
      if (event.candidate && user?._id) {
        socketService.sendIceCandidate({
          to: peerId,
          from: user._id,
          candidate: event.candidate,
        });
      }
    };

    pc.ontrack = (event) => {
      remoteStream.current = event.streams[0];
      window.dispatchEvent(new CustomEvent('remote-stream-updated', { detail: event.streams[0] }));
    };

    pc.onconnectionstatechange = () => {
      if (disconnectTimerRef.current) {
        clearTimeout(disconnectTimerRef.current);
        disconnectTimerRef.current = null;
      }
      if (pc.connectionState === 'connected') {
        setCallState('connected');
        return;
      }
      if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        stopMedia();
        setCallState('failed');
        setTimeout(() => { setCallInfo(null); setCallState('idle'); }, 2500);
        return;
      }
      // `disconnected` is often transient during ICE — wait before declaring failure
      if (pc.connectionState === 'disconnected') {
        disconnectTimerRef.current = setTimeout(() => {
          disconnectTimerRef.current = null;
          const current = peerConnection.current;
          if (current === pc && (pc.connectionState === 'disconnected' || pc.connectionState === 'failed')) {
            stopMedia();
            setCallState('failed');
            setTimeout(() => { setCallInfo(null); setCallState('idle'); }, 2500);
          }
        }, 6000);
      }
    };

    peerConnection.current = pc;
    return pc;
  }, [user, stopMedia]);

  // Navigate immediately, WebRTC setup happens on VideoCallPage mount
  const initiateCall = useCallback(async (peerId, peerName, type = 'video') => {
    if (callStateRef.current !== 'idle') return;
    callStateRef.current = 'requesting-media';

    setCallState('requesting-media');
    setCallInfo({ peerId, peerName, type, isInitiator: true });
    navigate('/video-call');
  }, [navigate]);

  // Called by VideoCallPage once mounted
  const setupOutgoingCall = useCallback(async () => {
    if (!callInfo?.isInitiator || !user?._id) return;

    try {
      const stream = await getMediaStream(callInfo.type);
      localStream.current = stream;
      window.dispatchEvent(new CustomEvent('local-stream-ready'));

      const pc = createPeerConnection(callInfo.peerId);
      stream.getTracks().forEach(track => pc.addTrack(track, stream));

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      setCallState('calling');

      socketService.callUser({
        to: callInfo.peerId,
        from: user._id,
        offer: { type: offer.type, sdp: offer.sdp },
        type: callInfo.type,
        callerName: user.name || 'User',
      });

      // Auto-end if the callee doesn't answer within timeout
      callTimeoutRef.current = setTimeout(() => {
        callTimeoutRef.current = null;
        if (callStateRef.current === 'calling') {
          stopMedia();
          setIncomingCall(null);
          setCallState('unavailable');
          setTimeout(() => { setCallInfo(null); setCallState('idle'); }, 3000);
        }
      }, CALL_TIMEOUT_MS);
    } catch (err) {
      console.error('Failed to setup outgoing call:', err);
      fullReset();
    }
  }, [callInfo, user, createPeerConnection, fullReset, stopMedia]);

  const acceptIncoming = useCallback(async () => {
    if (!incomingCall) return;

    try {
      const { from, offer, type, callerName } = incomingCall;
      setCallState('requesting-media');
      setCallInfo({ peerId: from, peerName: callerName, type: type || 'video', isInitiator: false });
      setIncomingCall(null);
      navigate('/video-call');

      const stream = await getMediaStream(type || 'video');
      localStream.current = stream;
      window.dispatchEvent(new CustomEvent('local-stream-ready'));

      const pc = createPeerConnection(from);
      stream.getTracks().forEach(track => pc.addTrack(track, stream));

      await pc.setRemoteDescription(new RTCSessionDescription(offer));

      for (const candidate of pendingCandidates.current) {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      }
      pendingCandidates.current = [];

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      socketService.acceptCall({
        to: from,
        from: user._id,
        answer: { type: answer.type, sdp: answer.sdp },
      });

      setCallState('connecting');
    } catch (err) {
      console.error('Failed to accept call:', err);
      fullReset();
    }
  }, [incomingCall, user, createPeerConnection, navigate, fullReset]);

  const rejectIncoming = useCallback(() => {
    if (!incomingCall) return;
    socketService.rejectCall({ to: incomingCall.from, from: user?._id });
    setIncomingCall(null);
  }, [incomingCall, user]);

  const endCurrentCall = useCallback(() => {
    if (callInfo?.peerId && user?._id) {
      socketService.endCall({ to: callInfo.peerId, from: user._id });
    }
    stopMedia();
    setIncomingCall(null);
    setCallState('ended');
    // callInfo preserved for 2.5s so the UI shows the correct peer name
    setTimeout(() => { setCallInfo(null); setCallState('idle'); }, 2500);
  }, [callInfo, user, stopMedia]);

  const toggleMute = useCallback(() => {
    if (!localStream.current) return false;
    const audioTrack = localStream.current.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      return !audioTrack.enabled;
    }
    return false;
  }, []);

  const toggleCamera = useCallback(() => {
    if (!localStream.current) return false;
    const videoTrack = localStream.current.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      return !videoTrack.enabled;
    }
    return false;
  }, []);

  // ─── Call-answered & ICE candidate listeners ───
  useEffect(() => {
    if (!user?._id) return;

    const handleCallAnswered = async ({ answer }) => {
      if (!peerConnection.current) return;
      // Call was answered — clear the unanswered timeout
      if (callTimeoutRef.current) {
        clearTimeout(callTimeoutRef.current);
        callTimeoutRef.current = null;
      }
      try {
        await peerConnection.current.setRemoteDescription(new RTCSessionDescription(answer));
        for (const candidate of pendingCandidates.current) {
          await peerConnection.current.addIceCandidate(new RTCIceCandidate(candidate));
        }
        pendingCandidates.current = [];
        setCallState('connecting');
      } catch (err) {
        console.error('Error setting remote description:', err);
      }
    };

    const handleIceCandidate = async ({ candidate }) => {
      if (!candidate) return;
      if (peerConnection.current && peerConnection.current.remoteDescription) {
        try {
          await peerConnection.current.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
          console.error('Error adding ICE candidate:', err);
        }
      } else {
        pendingCandidates.current.push(candidate);
      }
    };

    socketService.onCallAnswered(handleCallAnswered);
    socketService.onIceCandidate(handleIceCandidate);

    return () => {
      socketService.offCallAnswered(handleCallAnswered);
      socketService.offIceCandidate(handleIceCandidate);
    };
  }, [user]);

  return (
    <CallContext.Provider value={{
      incomingCall,
      callState,
      callInfo,
      localStream,
      remoteStream,
      peerConnection,
      initiateCall,
      setupOutgoingCall,
      acceptIncoming,
      rejectIncoming,
      endCurrentCall,
      toggleMute,
      toggleCamera,
    }}>
      {children}
    </CallContext.Provider>
  );
}

export function useCall() {
  const ctx = useContext(CallContext);
  if (!ctx) throw new Error('useCall must be used within CallProvider');
  return ctx;
}

export default CallContext;
