import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Send, Users, ChevronLeft, UserCircle2, Info, 
  Check, CheckCheck, Eye, ShieldAlert, Image as ImageIcon,
  Flag, Ban, MoreVertical, MessageSquare, Wifi, WifiOff,
  Phone, Video
} from 'lucide-react';
import './ChatPage.css';
import api from '../services/api';
import socketService from '../services/socket';

const ChatPage = () => {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [rooms, setRooms] = useState([]);
  const [activeRoom, setActiveRoom] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [typingUsers, setTypingUsers] = useState(new Set());
  const [showSafetyMenu, setShowSafetyMenu] = useState(false);
  const [socketConnected, setSocketConnected] = useState(false);
  const [showVoiceCall, setShowVoiceCall] = useState(false);
  const [voiceCallDuration, setVoiceCallDuration] = useState(0);
  const [voiceCallState, setVoiceCallState] = useState('idle'); // idle | calling | active | ended
  const voiceTimerRef = useRef(null);
  
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const currentRoomRef = useRef(roomId);

  // Keep room ref in sync
  useEffect(() => {
    currentRoomRef.current = roomId;
  }, [roomId]);

  // ─── 0. CONNECT SOCKET ON MOUNT ───
  useEffect(() => {
    console.log('🚀 ChatPage: Initializing socket connection...');
    const sock = socketService.connect();
    
    const onConnect = () => {
      console.log('✅ ChatPage: Socket is connected!');
      setSocketConnected(true);
    };
    const onDisconnect = () => {
      console.log('❌ ChatPage: Socket disconnected');
      setSocketConnected(false);
    };

    if (sock) {
      sock.on('connect', onConnect);
      sock.on('disconnect', onDisconnect);
      if (sock.connected) setSocketConnected(true);
    }

    return () => {
      if (sock) {
        sock.off('connect', onConnect);
        sock.off('disconnect', onDisconnect);
      }
    };
  }, []);

  // ─── 1. FETCH ROOMS ───
  useEffect(() => {
    fetchRooms();
  }, []);

  const fetchRooms = async () => {
    try {
      const data = await api.getChatRooms();
      setRooms(data || []);
    } catch (err) {
      console.error('Failed to load chats:', err);
    } finally {
      setLoading(false);
    }
  };

  // ─── 2. SET ACTIVE ROOM & JOIN SOCKET ───
  useEffect(() => {
    if (!roomId || !user?._id) return;
    
    const room = rooms.find(r => r._id === roomId);
    if (room) setActiveRoom(room);
    
    fetchMessages(roomId);
    
    console.log('📌 Joining room:', roomId);
    socketService.joinRoom(roomId);
    
    api.markAsRead(roomId).catch(console.error);
    socketService.markRead(roomId, user._id);

    return () => {
      if (roomId) {
        console.log('📤 Leaving room:', roomId);
        socketService.leaveRoom(roomId);
      }
    };
  }, [roomId, rooms, user]);

  const fetchMessages = async (id) => {
    try {
      const msgs = await api.getMessages(id, 100);
      setMessages((msgs || []).reverse());
      scrollToBottom();
    } catch (err) {
      console.error('Failed to load messages:', err);
    }
  };

  // ─── 3. SOCKET EVENT LISTENERS ───
  useEffect(() => {
    if (!user?._id) return;

    const handleNewMessage = (msg) => {
      console.log('📩 New message received:', msg);
      const msgRoomId = msg.roomId?.toString() || msg.roomId;
      
      if (msgRoomId === currentRoomRef.current) {
        setMessages(prev => {
          const exists = prev.some(m => m._id === msg._id);
          if (exists) return prev;
          return [...prev, msg];
        });
        scrollToBottom();
        
        const receiverId = msg.receiverId?._id || msg.receiverId;
        if (receiverId === user._id) {
          socketService.markRead(currentRoomRef.current, user._id);
        }
      }
      
      // Update room list
      setRooms(prev => prev.map(r => 
        r._id === msgRoomId 
          ? { ...r, lastMessage: msg.message, lastMessageAt: msg.timestamp || msg.createdAt } 
          : r
      ).sort((a,b) => new Date(b.lastMessageAt || 0) - new Date(a.lastMessageAt || 0)));
    };

    const handleTyping = ({ userId: typingUserId }) => {
      if (typingUserId === user._id) return;
      setTypingUsers(prev => {
        const next = new Set(prev);
        next.add(typingUserId);
        return next;
      });
    };

    const handleStopTyping = ({ userId: typingUserId }) => {
      setTypingUsers(prev => {
        const next = new Set(prev);
        next.delete(typingUserId);
        return next;
      });
    };

    const handleMessagesRead = ({ roomId: readRoomId, userId: readerId }) => {
      if (readRoomId === currentRoomRef.current && readerId !== user._id) {
        setMessages(prev => prev.map(m => ({ ...m, isRead: true })));
      }
    };

    const handleMessageError = ({ error }) => {
      console.error('❌ Message failed:', error);
      alert('Message failed: ' + error);
    };

    const handleMessageSent = (data) => {
      console.log('✅ Message confirmed sent:', data);
    };

    // Register all listeners
    socketService.onNewMessage(handleNewMessage);
    socketService.onUserTyping(handleTyping);
    socketService.onUserStopTyping(handleStopTyping);
    socketService.onMessagesRead(handleMessagesRead);
    socketService.onMessageError(handleMessageError);
    socketService.onMessageSent(handleMessageSent);

    return () => {
      socketService._off('new-message', handleNewMessage);
      socketService._off('user-typing', handleTyping);
      socketService._off('user-stop-typing', handleStopTyping);
      socketService._off('messages-read', handleMessagesRead);
      socketService._off('message-error', handleMessageError);
      socketService._off('message-sent', handleMessageSent);
    };
  }, [user]);

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 150);
  };

  // ─── SEND MESSAGE ───
  const handleSend = useCallback((e) => {
    e?.preventDefault();
    if (!newMessage.trim() || !activeRoom || !user?._id) return;

    const otherUser = activeRoom.participants.find(p => p._id !== user._id);
    if (!otherUser) return;
    
    const msgData = {
      roomId,
      senderId: user._id,
      receiverId: otherUser._id,
      content: newMessage.trim(),
    };

    console.log('📤 Sending message:', msgData);
    socketService.sendMessage(msgData);

    // Optimistic update — add to local messages immediately
    const optimisticMsg = {
      _id: 'temp_' + Date.now(),
      senderId: { _id: user._id, name: user.name },
      receiverId: otherUser._id,
      roomId: roomId,
      message: newMessage.trim(),
      timestamp: new Date().toISOString(),
      isRead: false,
      _optimistic: true,
    };
    setMessages(prev => [...prev, optimisticMsg]);
    scrollToBottom();

    setNewMessage('');
    handleStopTypingEmit();
  }, [newMessage, activeRoom, user, roomId]);

  // ─── TYPING ───
  const handleInputChange = (e) => {
    setNewMessage(e.target.value);
    
    if (!roomId || !user?._id) return;
    socketService.emitTyping(roomId, user._id);
    
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      handleStopTypingEmit();
    }, 2000);
  };

  const handleStopTypingEmit = () => {
    if (!roomId || !user?._id) return;
    socketService.emitStopTyping(roomId, user._id);
  };

  const requestReveal = async () => {
    try {
      const updated = await api.requestReveal(roomId);
      setActiveRoom(updated);
      alert('Identity reveal requested. When both parties request, identities will be shown.');
    } catch (e) {
      alert(e.message || 'Failed to request reveal');
    }
  };

  const handleBlockRoom = async () => {
    if (!window.confirm('Are you sure you want to block this conversation?')) return;
    try {
      await api.blockChatRoom(roomId);
      alert('Conversation blocked.');
      navigate('/chat');
      fetchRooms();
    } catch (err) {
      alert('Failed to block conversation: ' + err.message);
    }
  };

  const otherUser = activeRoom?.participants?.find(p => p._id !== user?._id);

  const handleReportInChat = async () => {
    const reason = window.prompt('Please provide a reason for reporting this user:');
    if (!reason) return;
    try {
      await api.createReport({
        reportedUserId: otherUser?._id,
        reason: reason,
        details: 'User reported from chat room'
      });
      alert('Report submitted successfully.');
    } catch (err) {
      alert('Failed to submit report: ' + err.message);
    }
  };

  if (loading) return <div className="loading-page"><div className="spinner" /></div>;

  const isAnonymous = activeRoom?.isAnonymous;
  const isTyping = Array.from(typingUsers).some(id => id !== user?._id);
  const hasRequestedReveal = activeRoom?.revealRequests?.includes(user?._id);

  const formatTime = (ts) => {
    if (!ts) return '';
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="chat-container">
      {/* Sidebar List */}
      {!roomId && (
        <div className="chat-sidebar glass">
        <div className="sidebar-header">
          <h2>Messages</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {socketConnected 
              ? <Wifi size={14} color="var(--teal)" />
              : <WifiOff size={14} color="var(--red)" />
            }
            <span className="badge badge-accent">{rooms.length}</span>
          </div>
        </div>
        
        <div className="rooms-list">
          {rooms.length === 0 ? (
            <div className="empty-rooms text-muted text-center pt-24 text-sm">
              <MessageSquare size={32} opacity={0.3} className="mx-auto mb-12" />
              <p>No conversations yet.</p>
              <p>Browse people and start chatting!</p>
            </div>
          ) : (
            rooms.map(room => {
              const partner = room.participants.find(p => p._id !== user?._id);
              const isActive = room._id === roomId;
              const displayName = room.isAnonymous ? 'Anonymous User' : (partner?.name || 'User');
              const displayPhoto = room.isAnonymous 
                ? `https://api.dicebear.com/7.x/bottts/svg?seed=${partner?._id}`
                : (partner?.profilePhoto || `https://avatar.iran.liara.run/public?username=${partner?.name}`);

              return (
                <div 
                  key={room._id} 
                  className={`room-item ${isActive ? 'active' : ''}`}
                  onClick={() => navigate(`/chat/${room._id}`)}
                >
                  <img src={displayPhoto} alt={displayName} className="room-avatar" />
                  <div className="room-info">
                    <div className="room-top">
                      <span className="room-name">{displayName}</span>
                      {room.lastMessageAt && (
                        <span className="room-time">{formatTime(room.lastMessageAt)}</span>
                      )}
                    </div>
                    <div className="room-bottom">
                      <p className="room-preview line-clamp-1 text-sm text-muted">
                        {room.lastMessage || 'No messages yet'}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
      )}

      {/* Main Chat Area */}
      {roomId && (
        <div className="chat-main">
        {!activeRoom ? (
          <div className="chat-placeholder">
            <div className="glass empty-chat-card">
              <div className="spinner" style={{ margin: '0 auto 16px' }} />
              <h3>Loading conversation...</h3>
            </div>
          </div>
        ) : (
          <>
            {/* Chat Header */}
            <div className="chat-header glass">
              <button className="mobile-back-btn" onClick={() => navigate('/chat')}>
                <ChevronLeft size={24} />
              </button>
              
              <div className="chat-partner-info">
                <img 
                  src={isAnonymous ? `https://api.dicebear.com/7.x/bottts/svg?seed=${otherUser?._id}` : (otherUser?.profilePhoto || `https://avatar.iran.liara.run/public?username=${otherUser?.name}`)} 
                  alt="Partner" 
                  className="avatar flex-shrink-0"
                />
                <div>
                  <h3 className="partner-name">
                    {isAnonymous ? 'Anonymous User' : otherUser?.name}
                    {isAnonymous && <ShieldAlert size={14} className="ml-8 text-accent inline" />}
                  </h3>
                  {isTyping && <span className="typing-indicator">typing...</span>}
                  {!isTyping && (
                    <span className="typing-indicator" style={{ color: socketConnected ? 'var(--teal)' : 'var(--red)', fontStyle: 'normal', fontSize: '9px' }}>
                      {socketConnected ? '● Online' : '● Connecting...'}
                    </span>
                  )}
                </div>
              </div>

              <div className="header-actions">
                {/* Voice Call Button */}
                <button
                  className="btn btn-icon btn-sm"
                  title="Voice Call"
                  onClick={() => {
                    setShowVoiceCall(true);
                    setVoiceCallState('calling');
                    setVoiceCallDuration(0);
                    setTimeout(() => {
                      setVoiceCallState('active');
                      voiceTimerRef.current = setInterval(() => {
                        setVoiceCallDuration(prev => prev + 1);
                      }, 1000);
                    }, 2000);
                  }}
                >
                  <Phone size={16} />
                </button>

                {/* Video Call Button */}
                <button
                  className="btn btn-icon btn-sm"
                  title="Video Call"
                  onClick={() => {
                    const partnerName = isAnonymous ? 'Anonymous User' : (otherUser?.name || 'User');
                    navigate('/video-call', {
                      state: {
                        url: `https://meet.jit.si/vibeme_${user?._id}_${otherUser?._id}_${Date.now()}`,
                        partnerName,
                      }
                    });
                  }}
                >
                  <Video size={16} />
                </button>

                {isAnonymous && (
                  <button 
                    className={`btn btn-sm ${hasRequestedReveal ? 'btn-success' : 'btn-outline'}`}
                    onClick={requestReveal}
                    disabled={hasRequestedReveal}
                  >
                    <Eye size={14} /> 
                    {hasRequestedReveal ? 'Requested' : 'Reveal'}
                  </button>
                )}
                {!isAnonymous && (
                  <button className="btn btn-sm btn-secondary" onClick={() => navigate(`/user/${otherUser?._id}`)}>
                    <UserCircle2 size={16} /> Profile
                  </button>
                )}

                <div className="relative safety-menu-container">
                  <button 
                    className="btn btn-icon btn-sm" 
                    onClick={() => setShowSafetyMenu(!showSafetyMenu)}
                  >
                    <MoreVertical size={18} />
                  </button>
                  
                  {showSafetyMenu && (
                    <div className="safety-dropdown glass" onMouseLeave={() => setShowSafetyMenu(false)}>
                      <button className="dropdown-item" onClick={handleReportInChat}>
                        <Flag size={14} /> Report User
                      </button>
                      <button className="dropdown-item danger" onClick={handleBlockRoom}>
                        <Ban size={14} /> Block Chat
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Warning Banner */}
            {isAnonymous && (
              <div className="anonymous-banner">
                <Info size={16} />
                <span>This chat is anonymous. Identities are hidden until both users agree to reveal them.</span>
              </div>
            )}

            {/* Messages Area */}
            <div className="messages-area">
              <AnimatePresence>
                {messages.map((msg, index) => {
                  const senderId = msg.senderId?._id || msg.senderId;
                  const isMine = senderId === user?._id;
                  
                  return (
                    <motion.div 
                      key={msg._id || index}
                      initial={{ opacity: 0, scale: 0.9, y: 10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      className={`message-wrapper ${isMine ? 'mine' : 'theirs'}`}
                    >
                      <div className="message-bubble">
                        <p>{msg.message}</p>
                        <div className="message-meta">
                          <span className="time">{formatTime(msg.timestamp || msg.createdAt)}</span>
                          {isMine && (
                            <span className="status">
                              {msg._optimistic ? <Check size={12} style={{ opacity: 0.4 }} /> :
                               msg.isRead ? <CheckCheck size={12} className="text-accent" /> : <Check size={12} />}
                            </span>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <form className="chat-input-area" onSubmit={handleSend}>
              <input
                type="text"
                placeholder={socketConnected ? "Type a message..." : "Connecting..."}
                value={newMessage}
                onChange={handleInputChange}
                className="message-input"
                autoComplete="off"
                disabled={!socketConnected}
              />
              <button 
                type="submit" 
                className={`btn-send ${!newMessage.trim() || !socketConnected ? 'disabled' : ''}`}
                disabled={!newMessage.trim() || !socketConnected}
              >
                <Send size={18} />
              </button>
            </form>
          </>
        )}
      </div>
      )}

      {/* ─── VOICE CALL OVERLAY ─── */}
      {showVoiceCall && (
        <div className="voice-call-screen">
          <div className="vc-caller-avatar">
            {(isAnonymous ? 'AU' : (otherUser?.name || 'U').slice(0, 2)).toUpperCase()}
          </div>
          <div className="vc-caller-name">
            {isAnonymous ? 'Anonymous User' : otherUser?.name}
          </div>
          <div className="vc-call-status">
            {voiceCallState === 'calling' && '📞 Calling...'}
            {voiceCallState === 'active' && `${String(Math.floor(voiceCallDuration / 60)).padStart(2, '0')}:${String(voiceCallDuration % 60).padStart(2, '0')}`}
            {voiceCallState === 'ended' && 'Call Ended'}
          </div>
          <div className="vc-voice-controls">
            <button 
              className="vc-ctrl-btn"
              onClick={() => { /* toggle mute */ }}
            >
              🎤
            </button>
            <button 
              className="vc-ctrl-btn vc-end-call-btn"
              onClick={() => {
                clearInterval(voiceTimerRef.current);
                setVoiceCallState('ended');
                setTimeout(() => {
                  setShowVoiceCall(false);
                  setVoiceCallState('idle');
                  setVoiceCallDuration(0);
                }, 1500);
              }}
            >
              📵
            </button>
            <button className="vc-ctrl-btn">
              🔊
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatPage;
