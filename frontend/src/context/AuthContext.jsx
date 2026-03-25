import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import socketService from '../services/socket';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(api.getUser());
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(!!api.getToken());

  useEffect(() => {
    const initAuth = async () => {
      const token = api.getToken();
      const savedUser = api.getUser();
      
      if (token && savedUser) {
        try {
          // Verify token and refresh user data
          const updated = await api.getProfile();
          setUser(updated);
          api.setUser(updated);
          setIsAuthenticated(true);
          
          socketService.connect();
          socketService.register(updated._id);
        } catch (e) {
          console.error('Auth check failed:', e);
          logout();
        }
      } else {
        setIsAuthenticated(false);
      }
      setLoading(false);
    };

    initAuth();
  }, []);

  const login = async (phoneNumber, otp) => {
    const result = await api.verifyOtp(phoneNumber, otp);
    api.setToken(result.token);
    api.setUser(result.user);
    setUser(result.user);
    setIsAuthenticated(true);
    
    socketService.connect();
    socketService.register(result.user._id);
    
    return result;
  };

  const loginWithFirebase = async (idToken) => {
    const result = await api.verifyFirebaseOtp(idToken);
    api.setToken(result.token);
    api.setUser(result.user);
    setUser(result.user);
    setIsAuthenticated(true);
    
    socketService.connect();
    socketService.register(result.user._id);
    
    return result;
  };

  const logout = useCallback(() => {
    api.clearToken();
    setUser(null);
    setIsAuthenticated(false);
    socketService.disconnect();
  }, []);

  const refreshUser = async () => {
    try {
      const updated = await api.getProfile();
      setUser(updated);
      api.setUser(updated);
      return updated;
    } catch (e) {
      if (e.message?.includes('401') || e.message?.includes('Unauthorized')) {
        logout();
      }
    }
  };

  const updateLocalUser = (updatedData) => {
    const newUser = { ...user, ...updatedData };
    setUser(newUser);
    api.setUser(newUser);
  };

  return (
    <AuthContext.Provider value={{
      user, setUser, loading, isAuthenticated,
      login, loginWithFirebase, logout, refreshUser, updateLocalUser
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}

export default AuthContext;
