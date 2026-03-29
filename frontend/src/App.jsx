import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
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

function AppRoutes() {
  const { isAuthenticated } = useAuth();
  
  return (
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
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AlertProvider>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </AlertProvider>
    </BrowserRouter>
  );
}
