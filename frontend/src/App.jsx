import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { CallProvider, useCall } from './context/CallContext';
import { AlertProvider } from './context/AlertContext';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import ProfileSetupPage from './pages/ProfileSetupPage';
import DiscoverPage from './pages/DiscoverPage';
import ProfilePage from './pages/ProfilePage';
import ChatPage from './pages/ChatPage';
import UserDetailPage from './pages/UserDetailPage';
import SessionPage from './pages/SessionPage';
import RatingPage from './pages/RatingPage';
import WalletPage from './pages/WalletPage';
import NotificationsPage from './pages/NotificationsPage';
import BookingsPage from './pages/BookingsPage';
import AdminPage from './pages/AdminPage';
import VideoCallPage from './pages/VideoCallPage';
import { Phone, PhoneOff, Video } from 'lucide-react';
import './App.css';

function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return <div className="loading-page"><div className="spinner" /><span className="logo">Vibe<span style={{color:'#AFA9EC'}}>Me</span></span></div>;
  return isAuthenticated ? children : <Navigate to="/login" />;
}

function AdminRoute({ children }) {
  const { user, isAuthenticated, loading } = useAuth();
  if (loading) return <div className="loading-page"><div className="spinner" /></div>;
  if (!isAuthenticated) return <Navigate to="/login" />;
  if (!user?.isAdmin) return <Navigate to="/discover" />;
  return children;
}

/* Global Incoming Call Overlay — rendered outside Layout so it shows on ALL pages */
function IncomingCallOverlay() {
  const { incomingCall, acceptIncoming, rejectIncoming } = useCall();

  if (!incomingCall) return null;

  const callerInitials = incomingCall?.callerName
    ? incomingCall.callerName.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
    : 'U';

  return (
    <div className="incoming-call-overlay">
      <div className="ic-card">
        <div className="ic-pulse-bg" />
        <div className="ic-avatar">{callerInitials}</div>
        <div className="ic-name">{incomingCall.callerName || 'Unknown Caller'}</div>
        <div className="ic-type">
          {incomingCall.type === 'video' ? <Video size={14} /> : <Phone size={14} />}
          Incoming {incomingCall.type === 'video' ? 'Video' : 'Voice'} Call
        </div>
        <div className="ic-actions">
          <button className="ic-btn ic-reject" onClick={rejectIncoming}>
            <PhoneOff size={24} />
            <span>Decline</span>
          </button>
          <button className="ic-btn ic-accept" onClick={acceptIncoming}>
            <Phone size={24} />
            <span>Accept</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function AppRoutes() {
  const { isAuthenticated } = useAuth();

  return (
    <>
      <Routes>
        <Route path="/login" element={isAuthenticated ? <Navigate to="/discover" /> : <LoginPage />} />
        <Route path="/setup" element={<ProtectedRoute><ProfileSetupPage /></ProtectedRoute>} />

        <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route index element={<Navigate to="/discover" />} />
          <Route path="discover" element={<DiscoverPage />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="chat" element={<ChatPage />} />
          <Route path="chat/:roomId" element={<ChatPage />} />
          <Route path="wallet" element={<WalletPage />} />
          <Route path="notifications" element={<NotificationsPage />} />
          <Route path="bookings" element={<BookingsPage />} />
          <Route path="user/:userId" element={<UserDetailPage />} />
          <Route path="session/:sessionId" element={<SessionPage />} />
          <Route path="rating/:sessionId" element={<RatingPage />} />
          <Route path="admin" element={<AdminRoute><AdminPage /></AdminRoute>} />
        </Route>
        <Route path="/video-call" element={<ProtectedRoute><VideoCallPage /></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>

      {/* Global incoming call overlay - visible on every page */}
      <IncomingCallOverlay />
    </>
  );
}

function AuthenticatedApp() {
  return (
    <CallProvider>
      <AppRoutes />
    </CallProvider>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AlertProvider>
        <AuthProvider>
          <AuthenticatedApp />
        </AuthProvider>
      </AlertProvider>
    </BrowserRouter>
  );
}
