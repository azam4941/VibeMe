import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import socketService from '../services/socket';

const CallContext = createContext(null);

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun3.l.google.com:19302' },
  { urls: 'stun:stun4.l.google.com:19302' },
  // Free TURN servers for NAT traversal (essential for mobile/4G networks)
  {
    urls: 'turn:openrelay.metered.ca:80',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
  {
    urls: 'turn:openrelay.metered.ca:443',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
  {
    urls: 'turn:openrelay.metered.ca:443?transport=tcp',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
];

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
  // Track whether we have a peer connection being set up (to buffer ICE candidates)
  const pcSetupInProgress = useRef(false);

  // Stops media tracks and closes peer connection (does NOT touch callInfo/callState)
  const stopMedia = useCallback(() => {
    if (disconnectTimerRef.current) {
      clearTimeout(disconnectTimerRef.current);
      disconnectTimerRef.current = null;
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
    pcSetupInProgress.current = false;
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

    socketService.connect();
    socketService.register(user._id);

    const handleIncoming = (data) => {
      console.log('[Call] 📞 Incoming call from:', data.callerName, 'type:', data.type);
      if (callStateRef.current !== 'idle') {
        console.log('[Call] Already in call, rejecting incoming from:', data.from);
        socketService.rejectCall({ to: data.from?.toString?.() || data.from, from: user._id?.toString?.() || user._id });
        return;
      }
      setIncomingCall(data);
    };

    const handleCallEnded = () => {
      console.log('[Call] 📴 Call ended by remote');
      stopMedia();
      setIncomingCall(null);
      setCallState('ended');
      // callInfo preserved so UI can still show peer name
      setTimeout(() => { setCallInfo(null); setCallState('idle'); }, 2500);
    };

    const handleCallRejected = () => {
      console.log('[Call] ❌ Call rejected by remote');
      stopMedia();
      setIncomingCall(null);
      setCallState('rejected');
      setTimeout(() => { setCallInfo(null); setCallState('idle'); }, 2500);
    };

    const handleCallUnavailable = () => {
      console.log('[Call] 🚫 Remote user is unavailable');
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
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('Camera/Microphone not supported on this browser (check secure domain/permissions).');
    }
    const constraints = {
      audio: true,
      video: type === 'video' ? { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } } : false,
    };
    console.log('[Call] 🎤 Requesting media with constraints:', JSON.stringify(constraints));
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    console.log('[Call] ✅ Got media stream, tracks:', stream.getTracks().map(t => `${t.kind}:${t.readyState}`).join(', '));
    return stream;
  };

  const createPeerConnection = useCallback((peerId) => {
    if (disconnectTimerRef.current) {
      clearTimeout(disconnectTimerRef.current);
      disconnectTimerRef.current = null;
    }

    console.log('[Call] 🔧 Creating RTCPeerConnection for peer:', peerId);
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    pc.onicecandidate = (event) => {
      if (event.candidate && user?._id) {
        console.log('[Call] 🧊 Sending ICE candidate:', event.candidate.candidate?.slice(0, 50));
        socketService.sendIceCandidate({
          to: peerId?.toString?.() || peerId,
          from: user._id?.toString?.() || user._id,
          candidate: event.candidate,
        });
      } else if (!event.candidate) {
        console.log('[Call] 🧊 ICE gathering complete');
      }
    };

    pc.ontrack = (event) => {
      console.log('[Call] 🎥 Remote track received:', event.track.kind, 'streams:', event.streams.length);
      remoteStream.current = event.streams[0];
      window.dispatchEvent(new CustomEvent('remote-stream-updated', { detail: event.streams[0] }));
    };

    pc.oniceconnectionstatechange = () => {
      console.log('[Call] 🧊 ICE connection state:', pc.iceConnectionState);
    };

    pc.onicegatheringstatechange = () => {
      console.log('[Call] 🧊 ICE gathering state:', pc.iceGatheringState);
    };

    pc.onsignalingstatechange = () => {
      console.log('[Call] 📡 Signaling state:', pc.signalingState);
    };

    pc.onconnectionstatechange = () => {
      console.log('[Call] 🔗 Connection state:', pc.connectionState);
      if (disconnectTimerRef.current) {
        clearTimeout(disconnectTimerRef.current);
        disconnectTimerRef.current = null;
      }
      if (pc.connectionState === 'connected') {
        console.log('[Call] ✅ CONNECTED — call is live!');
        setCallState('connected');
        return;
      }
      if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        console.log('[Call] ❌ Connection', pc.connectionState);
        stopMedia();
        setCallState('failed');
        setTimeout(() => { setCallInfo(null); setCallState('idle'); }, 2500);
        return;
      }
      // `disconnected` is often transient during ICE — wait before declaring failure
      if (pc.connectionState === 'disconnected') {
        console.log('[Call] ⚠️ Connection disconnected — waiting 6s before declaring failure');
        disconnectTimerRef.current = setTimeout(() => {
          disconnectTimerRef.current = null;
          const current = peerConnection.current;
          if (current === pc && (pc.connectionState === 'disconnected' || pc.connectionState === 'failed')) {
            console.log('[Call] ❌ Connection failed after disconnect timeout');
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

    console.log('[Call] 📲 Initiating', type, 'call to:', peerName, '(', peerId, ')');
    setCallState('requesting-media');
    setCallInfo({ peerId, peerName, type, isInitiator: true });
    navigate('/video-call');
  }, [navigate]);

  // Called by VideoCallPage once mounted
  const setupOutgoingCall = useCallback(async () => {
    if (!callInfo?.isInitiator || !user?._id) return;

    try {
      console.log('[Call] 🚀 Setting up outgoing call...');
      pcSetupInProgress.current = true;

      const stream = await getMediaStream(callInfo.type);
      localStream.current = stream;
      window.dispatchEvent(new CustomEvent('local-stream-ready'));

      const pc = createPeerConnection(callInfo.peerId);
      stream.getTracks().forEach(track => {
        pc.addTrack(track, stream);
        console.log('[Call] ➕ Added local track:', track.kind);
      });

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      console.log('[Call] 📤 Offer created and set as local description');

      pcSetupInProgress.current = false;

      // Process any ICE candidates that arrived during setup
      if (pendingCandidates.current.length > 0) {
        console.log('[Call] 🧊 Processing', pendingCandidates.current.length, 'buffered ICE candidates');
        for (const candidate of pendingCandidates.current) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
          } catch (err) {
            console.warn('[Call] Failed to add buffered ICE candidate:', err.message);
          }
        }
        pendingCandidates.current = [];
      }

      setCallState('calling');

      socketService.callUser({
        to: callInfo.peerId?.toString?.() || callInfo.peerId,
        from: user._id?.toString?.() || user._id,
        offer: { type: offer.type, sdp: offer.sdp },
        type: callInfo.type,
        callerName: user.name || 'User',
      });
      console.log('[Call] 📤 Call-user signal sent to:', callInfo.peerId);
    } catch (err) {
      console.error('[Call] ❌ Failed to setup outgoing call:', err);
      pcSetupInProgress.current = false;
      alert('Could not start call: ' + (err.message || 'Check camera/mic permissions'));
      fullReset();
    }
  }, [callInfo, user, createPeerConnection, fullReset]);

  const acceptIncoming = useCallback(async () => {
    if (!incomingCall) return;

    // Capture data from incomingCall before clearing it
    const { from, offer, type, callerName } = incomingCall;
    console.log('[Call] ✅ Accepting call from:', callerName, '(', from, ')');

    // Signal that a PC setup is in progress — buffer any ICE candidates
    pcSetupInProgress.current = true;

    setCallState('requesting-media');
    setCallInfo({ peerId: from, peerName: callerName, type: type || 'video', isInitiator: false });
    setIncomingCall(null);
    navigate('/video-call');

    try {
      const stream = await getMediaStream(type || 'video');
      localStream.current = stream;
      window.dispatchEvent(new CustomEvent('local-stream-ready'));

      const pc = createPeerConnection(from);
      stream.getTracks().forEach(track => {
        pc.addTrack(track, stream);
        console.log('[Call] ➕ Added local track:', track.kind);
      });

      console.log('[Call] 📥 Setting remote description (offer)');
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      console.log('[Call] ✅ Remote description set');

      // Now process any ICE candidates that were buffered
      pcSetupInProgress.current = false;
      if (pendingCandidates.current.length > 0) {
        console.log('[Call] 🧊 Processing', pendingCandidates.current.length, 'buffered ICE candidates');
        for (const candidate of pendingCandidates.current) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
          } catch (err) {
            console.warn('[Call] Failed to add buffered ICE candidate:', err.message);
          }
        }
        pendingCandidates.current = [];
      }

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      console.log('[Call] 📤 Answer created and set as local description');

      socketService.acceptCall({
        to: from?.toString?.() || from,
        from: user._id?.toString?.() || user._id,
        answer: { type: answer.type, sdp: answer.sdp },
      });
      console.log('[Call] 📤 Call-accepted signal sent to:', from);

      setCallState('connecting');
    } catch (err) {
      console.error('[Call] ❌ Failed to accept call:', err);
      pcSetupInProgress.current = false;
      alert('Could not join call: ' + (err.message || 'Check camera/mic permissions'));
      fullReset();
    }
  }, [incomingCall, user, createPeerConnection, navigate, fullReset]);

  const rejectIncoming = useCallback(() => {
    if (!incomingCall) return;
    console.log('[Call] 🚫 Rejecting call from:', incomingCall.from);
    socketService.rejectCall({ to: incomingCall.from?.toString?.() || incomingCall.from, from: user?._id?.toString?.() || user?._id });
    setIncomingCall(null);
  }, [incomingCall, user]);

  const endCurrentCall = useCallback(() => {
    console.log('[Call] 📴 Ending current call');
    if (callInfo?.peerId && user?._id) {
      socketService.endCall({ to: callInfo.peerId?.toString?.() || callInfo.peerId, from: user._id?.toString?.() || user._id });
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
      console.log('[Call] 📥 Received call-answered signal');
      if (!peerConnection.current) {
        console.error('[Call] ❌ No peer connection when call-answered received!');
        return;
      }
      try {
        console.log('[Call] 📥 Setting remote description (answer)');
        await peerConnection.current.setRemoteDescription(new RTCSessionDescription(answer));
        console.log('[Call] ✅ Remote description (answer) set');

        // Process buffered ICE candidates
        if (pendingCandidates.current.length > 0) {
          console.log('[Call] 🧊 Processing', pendingCandidates.current.length, 'buffered ICE candidates after answer');
          for (const candidate of pendingCandidates.current) {
            try {
              await peerConnection.current.addIceCandidate(new RTCIceCandidate(candidate));
            } catch (err) {
              console.warn('[Call] Failed to add buffered ICE candidate:', err.message);
            }
          }
          pendingCandidates.current = [];
        }
        setCallState('connecting');
      } catch (err) {
        console.error('[Call] ❌ Error setting remote description:', err);
      }
    };

    const handleIceCandidate = async ({ candidate }) => {
      if (!candidate) return;

      // If PC setup is still in progress OR no peer connection yet OR no remote description,
      // buffer the candidate for later
      if (pcSetupInProgress.current || !peerConnection.current || !peerConnection.current.remoteDescription) {
        console.log('[Call] 🧊 Buffering ICE candidate (pc setup in progress:', pcSetupInProgress.current,
          ', pc exists:', !!peerConnection.current,
          ', has remote desc:', !!peerConnection.current?.remoteDescription, ')');
        pendingCandidates.current.push(candidate);
        return;
      }

      try {
        await peerConnection.current.addIceCandidate(new RTCIceCandidate(candidate));
        console.log('[Call] 🧊 Added ICE candidate directly');
      } catch (err) {
        console.error('[Call] ❌ Error adding ICE candidate:', err);
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
