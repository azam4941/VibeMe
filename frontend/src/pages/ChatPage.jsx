import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Send, Users, ChevronLeft, UserCircle2, Info, 
  Check, CheckCheck, Eye, ShieldAlert, Image as ImageIcon,
  Flag, Ban, MoreVertical, MessageSquare
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
  
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const messagesRef = useRef(messages);

  // Keep ref in sync
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // 0. Ensure socket is connected
  useEffect(() => {
    if (!socketService.isConnected()) {
      socketService.connect();
    }
  }, []);

  // 1. Fetch Rooms
  useEffect(() => {
    fetchRooms();
  }, []);

  const fetchRooms = async () => {
    try {
      const data = await api.getChatRooms();
      setRooms(data);
    } catch (err) {
      console.error('Failed to load chats');
    } finally {
      setLoading(false);
    }
  };

  // 2. Set Active Room & Join Socket
  useEffect(() => {
    if (!roomId || !user?._id) return;
    
    // If rooms are loaded, set active room
    const room = rooms.find(r => r._id === roomId);
    if (room) {
      setActiveRoom(room);
    }
    
    // Fetch messages
    fetchMessages(roomId);
    
    // Socket Join
    socketService.joinRoom(roomId);
    
    // Mark as read
    api.markAsRead(roomId).catch(console.error);
    socketService.markRead(roomId, user._id);

    return () => {
      if (roomId) socketService.leaveRoom(roomId);
    };
  }, [roomId, rooms, user]);

  const fetchMessages = async (id) => {
    try {
      const msgs = await api.getMessages(id, 100);
      setMessages(msgs.reverse());
      scrollToBottom();
    } catch (err) {
      console.error('Failed to load messages');
    }
  };

  // 3. Socket Event Listeners
  useEffect(() => {
    if (!user?._id) return;

    const handleNewMessage = (msg) => {
      const currentRoomId = roomId; // capture from closure
      if (msg.roomId?.toString() === currentRoomId || msg.roomId === currentRoomId) {
        // Check for duplicates
        setMessages(prev => {
          const exists = prev.some(m => m._id === msg._id);
          if (exists) return prev;
          return [...prev, msg];
        });
        scrollToBottom();
        
        // Auto-mark read if we're in the room
        const receiverId = msg.receiverId?._id || msg.receiverId;
        if (receiverId === user._id) {
          socketService.markRead(currentRoomId, user._id);
        }
      }
      // Update room list preview
      setRooms(prev => prev.map(r => 
        r._id === (msg.roomId?._id || msg.roomId) 
          ? { ...r, lastMessage: msg.message, lastMessageAt: msg.timestamp || msg.createdAt } 
          : r
      ).sort((a,b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt)));
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
      if (readRoomId === roomId && readerId !== user._id) {
        setMessages(prev => prev.map(m => ({ ...m, isRead: true })));
      }
    };

    const handleMessageError = ({ error }) => {
      console.error('Message failed:', error);
    };

    socketService.onNewMessage(handleNewMessage);
    socketService.onUserTyping(handleTyping);
    socketService.onUserStopTyping(handleStopTyping);
    socketService.onMessagesRead(handleMessagesRead);
    socketService.onMessageError(handleMessageError);

    return () => {
      socketService.socket?.off('new-message', handleNewMessage);
      socketService.socket?.off('user-typing', handleTyping);
      socketService.socket?.off('user-stop-typing', handleStopTyping);
      socketService.socket?.off('messages-read', handleMessagesRead);
      socketService.socket?.off('message-error', handleMessageError);
    };
  }, [roomId, user]);

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeRoom || !user?._id) return;

    const otherUser = activeRoom.participants.find(p => p._id !== user._id);
    if (!otherUser) return;
    
    socketService.sendMessage({
      roomId,
      senderId: user._id,
      receiverId: otherUser._id,
      content: newMessage.trim(),
    });

    setNewMessage('');
    handleStopTyping();
  };

  const handleTyping = (e) => {
    setNewMessage(e.target.value);
    
    if (!roomId || !user?._id) return;
    
    socketService.emitTyping(roomId, user._id);
    
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    
    typingTimeoutRef.current = setTimeout(() => {
      handleStopTyping();
    }, 2000);
  };

  const handleStopTyping = () => {
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
          <span className="badge badge-accent">{rooms.length}</span>
        </div>
        
        <div className="rooms-list">
          {rooms.length === 0 ? (
            <div className="empty-rooms text-muted text-center pt-24 text-sm">
              <MessageSquare size={32} opacity={0.3} className="mx-auto mb-12" />
              <p>No conversations yet.</p>
              <p>Book a session or message someone to start chatting!</p>
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
              <Users size={48} className="mb-16 text-primary" />
              <h3>Select a conversation</h3>
              <p className="text-muted">Choose a chat from the sidebar to start messaging</p>
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
                </div>
              </div>

              <div className="header-actions">
                {isAnonymous && (
                  <button 
                    className={`btn btn-sm ${hasRequestedReveal ? 'btn-success' : 'btn-outline'}`}
                    onClick={requestReveal}
                    disabled={hasRequestedReveal}
                  >
                    <Eye size={14} /> 
                    {hasRequestedReveal ? 'Reveal Requested' : 'Request Reveal'}
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
                              {msg.isRead ? <CheckCheck size={12} className="text-accent" /> : <Check size={12} />}
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
            <form className="chat-input-area glass" onSubmit={handleSend}>
              <button type="button" className="btn-attachment">
                <ImageIcon size={20} />
              </button>
              <input
                type="text"
                placeholder="Type a message..."
                value={newMessage}
                onChange={handleTyping}
                className="message-input"
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
