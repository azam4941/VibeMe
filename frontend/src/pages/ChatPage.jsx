import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCall } from '../context/CallContext';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Send, ChevronLeft, UserCircle2, Info,
  Check, CheckCheck, Eye, ShieldAlert,
  Flag, Ban, MoreVertical, MessageSquare, Wifi, WifiOff,
  Phone, Video, RefreshCw, AlertTriangle,
} from 'lucide-react';
import './ChatPage.css';
import api from '../services/api';
import socketService from '../services/socket';

const ChatPage = () => {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { initiateCall } = useCall();
  const userId = user?._id;

  const [rooms, setRooms] = useState([]);
  const [activeRoom, setActiveRoom] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [sendError, setSendError] = useState(null);
  const [roomError, setRoomError] = useState(null);
  const [typingUsers, setTypingUsers] = useState(new Set());
  const [showSafetyMenu, setShowSafetyMenu] = useState(false);
  const [socketConnected, setSocketConnected] = useState(socketService.isConnected());
  const [fetchError, setFetchError] = useState(null);

  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const currentRoomRef = useRef(roomId);
  const activeRoomRef = useRef(null);
  const prevRoomIdRef = useRef(null);
  const roomsRef = useRef([]);
  roomsRef.current = rooms;

  useEffect(() => { currentRoomRef.current = roomId; }, [roomId]);
  useEffect(() => { activeRoomRef.current = activeRoom; }, [activeRoom]);

  // ─── 0. CONNECT SOCKET & REGISTER USER ───
  useEffect(() => {
    const sock = socketService.connect();

    const onConnect = () => {
      setSocketConnected(true);
      if (userId) socketService.register(userId);
      if (currentRoomRef.current) socketService.joinRoom(currentRoomRef.current);
    };

    const onDisconnect = () => setSocketConnected(false);

    if (sock) {
      sock.on('connect', onConnect);
      sock.on('disconnect', onDisconnect);
      if (sock.connected) {
        setSocketConnected(true);
        if (userId) socketService.register(userId);
      }
    }

    return () => {
      if (sock) {
        sock.off('connect', onConnect);
        sock.off('disconnect', onDisconnect);
      }
    };
  }, [userId]);

  // ─── 1. FETCH ROOMS ───
  useEffect(() => { fetchRooms(); }, []);

  const fetchRooms = async () => {
    setFetchError(null);
    try {
      const data = await api.getChatRooms();
      setRooms(data || []);
    } catch (err) {
      console.error('Failed to load chats:', err);
      setFetchError('Could not load conversations. Check your connection.');
    } finally {
      setLoading(false);
    }
  };

  // ─── 2. SET ACTIVE ROOM ───
  // Deps: only roomId + userId. NOT location.state (object ref changes break StrictMode).
  useEffect(() => {
    if (!roomId || !userId) return;

    if (prevRoomIdRef.current !== roomId) {
      setActiveRoom(null);
      setRoomError(null);
      prevRoomIdRef.current = roomId;
    }

    let cancelled = false;
    const sameId = (a, b) => a != null && b != null && String(a) === String(b);

    // Optimistically show room from navigation state (instant UI)
    const navRoom = location.state?.room;
    if (navRoom && sameId(navRoom._id ?? navRoom.id, roomId)) {
      setActiveRoom(navRoom);
      setRoomError(null);
    }

    // Always fetch authoritative data from API (works in StrictMode, always correct)
    api.getChatRoom(roomId)
      .then(room => {
        if (!cancelled && room) {
          setActiveRoom(room);
          setRoomError(null);
          setRooms(prev => prev.some(r => sameId(r._id ?? r.id, roomId)) ? prev : [room, ...prev]);
        }
      })
      .catch(async (err) => {
        console.error('getChatRoom failed (attempt 1):', err.message);
        // One retry after a short delay
        try {
          await new Promise(r => setTimeout(r, 1000));
          if (cancelled) return;
          const room = await api.getChatRoom(roomId);
          if (!cancelled && room) {
            setActiveRoom(room);
            setRoomError(null);
            setRooms(prev => prev.some(r => sameId(r._id ?? r.id, roomId)) ? prev : [room, ...prev]);
          }
        } catch (retryErr) {
          console.error('getChatRoom failed (attempt 2):', retryErr.message);
          // Only show error if we don't already have the room from nav state
          if (!cancelled && !navRoom) {
            setRoomError('Could not load this conversation. Tap retry.');
          }
        }
      });

    return () => { cancelled = true; };
  }, [roomId, userId]);

  // ─── 2b. JOIN SOCKET ROOM & FETCH MESSAGES ───
  useEffect(() => {
    if (!roomId || !userId) return;

    fetchMessages(roomId);
    socketService.joinRoom(roomId);
    api.markAsRead(roomId).catch(() => {});
    socketService.markRead(roomId, userId);

    return () => {
      socketService.leaveRoom(roomId);
      setMessages([]);
    };
  }, [roomId, userId]);

  const fetchMessages = async (id) => {
    setMessagesLoading(true);
    try {
      const msgs = await api.getMessages(id, 100);
      setMessages((msgs || []).reverse());
      scrollToBottom();
    } catch (err) {
      console.error('Failed to load messages:', err);
    } finally {
      setMessagesLoading(false);
    }
  };

  // ─── 3. SOCKET EVENT LISTENERS ───
  useEffect(() => {
    if (!userId) return;

    const handleNewMessage = (msg) => {
      const msgRoomId = typeof msg.roomId === 'object' ? msg.roomId?.toString() : msg.roomId;
      const msgSenderId = msg.senderId?._id?.toString() || msg.senderId?._id || msg.senderId?.toString?.() || msg.senderId;

      if (msgRoomId === currentRoomRef.current) {
        setMessages(prev => {
          const exists = prev.some(m => m._id?.toString() === msg._id?.toString());
          if (exists) return prev;

          if (msgSenderId?.toString() === userId?.toString()) {
            let replaced = false;
            const updated = prev.map(m => {
              if (m._optimistic && !replaced) { replaced = true; return msg; }
              return m;
            });
            if (replaced) return updated;
          }

          return [...prev, msg];
        });
        scrollToBottom();

        if (msgSenderId?.toString() !== userId?.toString()) {
          socketService.markRead(currentRoomRef.current, userId);
        }
      }

      setRooms(prev => prev.map(r =>
        r._id === msgRoomId
          ? { ...r, lastMessage: msg.message, lastMessageAt: msg.timestamp || msg.createdAt }
          : r
      ).sort((a, b) => new Date(b.lastMessageAt || 0) - new Date(a.lastMessageAt || 0)));
    };

    const handleTyping = ({ userId: typingUserId }) => {
      if (typingUserId === userId) return;
      setTypingUsers(prev => { const n = new Set(prev); n.add(typingUserId); return n; });
    };

    const handleStopTyping = ({ userId: typingUserId }) => {
      setTypingUsers(prev => { const n = new Set(prev); n.delete(typingUserId); return n; });
    };

    const handleMessagesRead = ({ roomId: readRoomId, userId: readerId }) => {
      if (readRoomId === currentRoomRef.current && readerId !== userId) {
        setMessages(prev => prev.map(m => ({ ...m, isRead: true })));
      }
    };

    const handleMessageError = ({ error }) => {
      setMessages(prev => {
        const idx = prev.map(m => m._optimistic).lastIndexOf(true);
        if (idx !== -1) {
          const updated = [...prev];
          updated.splice(idx, 1);
          return updated;
        }
        return prev;
      });
      setSendError(error);
      setTimeout(() => setSendError(null), 4000);
    };

    socketService.onNewMessage(handleNewMessage);
    socketService._on('room-joined', () => {});
    socketService.onUserTyping(handleTyping);
    socketService.onUserStopTyping(handleStopTyping);
    socketService.onMessagesRead(handleMessagesRead);
    socketService.onMessageError(handleMessageError);
    socketService.onMessageSent(() => {});

    return () => {
      socketService._off('new-message', handleNewMessage);
      socketService._off('room-joined');
      socketService._off('user-typing', handleTyping);
      socketService._off('user-stop-typing', handleStopTyping);
      socketService._off('messages-read', handleMessagesRead);
      socketService._off('message-error', handleMessageError);
      socketService._off('message-sent');
    };
  }, [userId]);

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  // ─── SEND MESSAGE ───
  const handleSend = useCallback((e) => {
    e?.preventDefault();
    const trimmed = newMessage.trim();
    if (!trimmed || !activeRoomRef.current || !userId) return;
    setSendError(null);

    const room = activeRoomRef.current;
    const otherUser = room.participants?.find(p => {
      const pid = p._id?.toString() || p._id;
      return pid !== userId?.toString();
    });

    if (!otherUser) return;

    const msgData = {
      roomId: currentRoomRef.current,
      senderId: userId,
      receiverId: otherUser._id?.toString() || otherUser._id,
      content: trimmed,
    };

    // Show message optimistically regardless of socket state
    const optimisticMsg = {
      _id: 'temp_' + Date.now(),
      senderId: { _id: userId, name: user?.name, profilePhoto: user?.profilePhoto },
      receiverId: otherUser._id,
      roomId: currentRoomRef.current,
      message: trimmed,
      timestamp: new Date().toISOString(),
      isRead: false,
      _optimistic: true,
    };
    setMessages(prev => [...prev, optimisticMsg]);
    scrollToBottom();
    setNewMessage('');
    handleStopTypingEmit();

    const sent = socketService.sendMessage(msgData);
    if (!sent) {
      setSendError('Connecting... message will send when online.');
      // Retry sending when socket reconnects
      const retryInterval = setInterval(() => {
        if (socketService.sendMessage(msgData)) {
          clearInterval(retryInterval);
          setSendError(null);
        }
      }, 2000);
      setTimeout(() => { clearInterval(retryInterval); setSendError(null); }, 15000);
    }
  }, [newMessage, userId, user?.name, user?.profilePhoto]);

  const handleInputChange = (e) => {
    setNewMessage(e.target.value);
    if (!roomId || !userId) return;
    socketService.emitTyping(roomId, userId);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(handleStopTypingEmit, 2000);
  };

  const handleStopTypingEmit = () => {
    if (!roomId || !userId) return;
    socketService.emitStopTyping(roomId, userId);
  };

  const requestReveal = async () => {
    try {
      const updated = await api.requestReveal(roomId);
      setActiveRoom(updated);
    } catch (e) {
      setSendError(e.message || 'Failed to request reveal');
      setTimeout(() => setSendError(null), 3000);
    }
  };

  const handleBlockRoom = async () => {
    if (!window.confirm('Block this conversation?')) return;
    try {
      await api.blockChatRoom(roomId);
      navigate('/chat');
      fetchRooms();
    } catch (err) {
      setSendError('Failed to block: ' + err.message);
    }
  };

  const otherUser = activeRoom?.participants?.find(p => {
    const pid = p._id?.toString() || p._id;
    return pid !== userId?.toString() && pid !== userId;
  });

  const handleReportInChat = async () => {
    const reason = window.prompt('Reason for reporting this user:');
    if (!reason) return;
    try {
      await api.createReport({ reportedUserId: otherUser?._id, reason, details: 'Reported from chat' });
      setSendError(null);
    } catch (err) {
      setSendError('Failed to submit report: ' + err.message);
    }
  };

  const isAnonymous = activeRoom?.isAnonymous;

  const handleVoiceCall = async () => {
    if (!otherUser?._id) return;
    try {
      await initiateCall(otherUser._id, isAnonymous ? 'Anonymous User' : otherUser.name, 'voice');
    } catch (err) {
      setSendError('Could not start voice call. Check mic permissions.');
      setTimeout(() => setSendError(null), 4000);
    }
  };

  const handleVideoCall = async () => {
    if (!otherUser?._id) return;
    try {
      await initiateCall(otherUser._id, isAnonymous ? 'Anonymous User' : otherUser.name, 'video');
    } catch (err) {
      setSendError('Could not start video call. Check camera/mic permissions.');
      setTimeout(() => setSendError(null), 4000);
    }
  };

  // Only show full-page loading spinner for the room list view (no roomId).
  // When a specific room is open, skip the gate — activeRoom from nav state is enough.
  if (loading && !roomId) return <div className="loading-page"><div className="spinner" /></div>;

  const isTyping = typingUsers.size > 0;
  const hasRequestedReveal = activeRoom?.revealRequests?.some(id => id?.toString() === userId?.toString());

  const formatTime = (ts) => {
    if (!ts) return '';
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // activeRoom takes priority — if we loaded the room, ignore any stale roomError
  const showError = roomError && !activeRoom;

  return (
    <div className="chat-container">
      {/* Sidebar */}
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

          {!socketConnected && (
            <div className="reconnecting-bar">
              <RefreshCw size={12} className="spin-icon" /> Reconnecting...
            </div>
          )}

          {fetchError && (
            <div className="chat-error-bar">
              <AlertTriangle size={14} />
              <span>{fetchError}</span>
              <button onClick={fetchRooms} className="retry-btn">Retry</button>
            </div>
          )}

          <div className="rooms-list">
            {rooms.length === 0 && !fetchError ? (
              <div className="empty-rooms text-muted text-center pt-24 text-sm">
                <MessageSquare size={32} opacity={0.3} className="mx-auto mb-12" />
                <p>No conversations yet.</p>
                <p>Browse people and start chatting!</p>
              </div>
            ) : (
              rooms.map(room => {
                const partner = room.participants?.find(p => p._id?.toString() !== userId?.toString());
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
          {showError ? (
            <div className="chat-placeholder">
              <div className="glass empty-chat-card">
                <AlertTriangle size={32} style={{ margin: '0 auto 16px', color: 'var(--red)' }} />
                <h3>{roomError}</h3>
                <div style={{ display: 'flex', gap: 8, marginTop: 12, justifyContent: 'center' }}>
                  <button className="btn btn-sm btn-primary" onClick={() => { setRoomError(null); prevRoomIdRef.current = null; }}>
                    <RefreshCw size={14} /> Retry
                  </button>
                  <button className="btn btn-sm btn-secondary" onClick={() => navigate('/chat')}>Go Back</button>
                </div>
              </div>
            </div>
          ) : !activeRoom ? (
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
                    src={isAnonymous
                      ? `https://api.dicebear.com/7.x/bottts/svg?seed=${otherUser?._id}`
                      : (otherUser?.profilePhoto || `https://avatar.iran.liara.run/public?username=${otherUser?.name}`)}
                    alt="Partner"
                    className="avatar flex-shrink-0"
                  />
                  <div>
                    <h3 className="partner-name">
                      {isAnonymous ? 'Anonymous User' : otherUser?.name}
                      {isAnonymous && <ShieldAlert size={14} className="ml-8 text-accent inline" />}
                    </h3>
                    {isTyping
                      ? <span className="typing-indicator">typing...</span>
                      : <span className="typing-indicator" style={{ color: socketConnected ? 'var(--teal)' : 'var(--red)', fontStyle: 'normal', fontSize: '9px' }}>
                          {socketConnected ? '● Online' : '● Connecting...'}
                        </span>
                    }
                  </div>
                </div>

                <div className="header-actions">
                  <button className="btn btn-icon btn-sm" title="Voice Call" onClick={handleVoiceCall}>
                    <Phone size={16} />
                  </button>
                  <button className="btn btn-icon btn-sm" title="Video Call" onClick={handleVideoCall}>
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
                    <button className="btn btn-icon btn-sm" onClick={() => setShowSafetyMenu(!showSafetyMenu)}>
                      <MoreVertical size={18} />
                    </button>
                    {showSafetyMenu && (
                      <div className="safety-dropdown glass" onMouseLeave={() => setShowSafetyMenu(false)}>
                        <button className="dropdown-item" onClick={handleReportInChat}><Flag size={14} /> Report User</button>
                        <button className="dropdown-item danger" onClick={handleBlockRoom}><Ban size={14} /> Block Chat</button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {isAnonymous && (
                <div className="anonymous-banner">
                  <Info size={16} />
                  <span>This chat is anonymous. Identities are hidden until both users agree to reveal.</span>
                </div>
              )}

              {!socketConnected && (
                <div className="reconnecting-bar">
                  <RefreshCw size={12} className="spin-icon" /> Reconnecting to server...
                </div>
              )}

              {sendError && (
                <div className="chat-send-error">
                  <AlertTriangle size={14} />
                  <span>{sendError}</span>
                </div>
              )}

              {/* Messages Area */}
              <div className="messages-area">
                {messagesLoading && messages.length === 0 && (
                  <div className="messages-loading">
                    <div className="spinner" style={{ width: 24, height: 24 }} />
                    <span>Loading messages...</span>
                  </div>
                )}
                <AnimatePresence>
                  {messages.map((msg, index) => {
                    const senderId = msg.senderId?._id?.toString() || msg.senderId?._id || msg.senderId?.toString?.() || msg.senderId;
                    const isMine = senderId === userId?.toString() || senderId === userId;

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
                                {msg._optimistic
                                  ? <Check size={12} style={{ opacity: 0.4 }} />
                                  : msg.isRead
                                    ? <CheckCheck size={12} className="text-accent" />
                                    : <Check size={12} />}
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
                  placeholder="Type a message..."
                  value={newMessage}
                  onChange={handleInputChange}
                  className="message-input"
                  autoComplete="off"
                />
                <button
                  type="submit"
                  className={`btn-send ${!newMessage.trim() ? 'disabled' : ''}`}
                  disabled={!newMessage.trim()}
                >
                  <Send size={18} />
                </button>
              </form>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default ChatPage;
