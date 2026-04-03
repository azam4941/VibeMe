// API URL is set at build time via VITE_API_URL environment variable.
// Build with: npm run build:phone  (uses .env.phone with your LAN IP)
const getApiBase = () => {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  const hostname = window.location.hostname;
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return `http://${hostname}:3001/api`;
  }
  return 'http://localhost:3001/api';
};

// Expose the server origin (without /api) for socket.js
export const getServerBase = () => {
  const apiBase = getApiBase();
  return apiBase.replace(/\/api\/?$/, '');
};

const API_BASE = getApiBase();
console.log('🔗 API Base URL:', API_BASE);

class ApiService {
  getToken() {
    return localStorage.getItem('ct_token');
  }

  setToken(token) {
    localStorage.setItem('ct_token', token);
  }

  setUser(user) {
    localStorage.setItem('ct_user', JSON.stringify(user));
  }

  getUser() {
    const user = localStorage.getItem('ct_user');
    return user ? JSON.parse(user) : null;
  }

  clearToken() {
    localStorage.removeItem('ct_token');
    localStorage.removeItem('ct_user');
  }

  async request(endpoint, options = {}) {
    const token = this.getToken();
    const headers = {
      'Content-Type': 'application/json',
      'Bypass-Tunnel-Reminder': 'true',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    };

    const res = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: 'Request failed' }));
      throw new Error(err.message || `Error ${res.status}`);
    }

    return res.json();
  }

  // Auth
  sendOtp(phoneNumber) {
    return this.request('/auth/send-otp', {
      method: 'POST',
      body: JSON.stringify({ phoneNumber }),
    });
  }

  verifyOtp(phoneNumber, otp) {
    return this.request('/auth/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ phoneNumber, otp }),
    });
  }

  verifyFirebaseOtp(idToken) {
    return this.request('/auth/verify-firebase', {
      method: 'POST',
      body: JSON.stringify({ idToken }),
    });
  }

  // Users
  getProfile() {
    return this.request('/users/me');
  }

  updateProfile(data) {
    return this.request('/users/me', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  setRentMode(rentMode) {
    return this.request('/users/me/rent-mode', {
      method: 'PUT',
      body: JSON.stringify({ rentMode }),
    });
  }

  setPrice(pricePerMinute) {
    return this.request('/users/me/price', {
      method: 'PUT',
      body: JSON.stringify({ pricePerMinute }),
    });
  }

  setAvailability(availability) {
    return this.request('/users/me/availability', {
      method: 'PUT',
      body: JSON.stringify({ availability }),
    });
  }

  requestVerification(idPhotoUrl) {
    return this.request('/users/me/verify-request', {
      method: 'PUT',
      body: JSON.stringify({ idPhotoUrl }),
    });
  }

  blockUser(userId, reason) {
    return this.request('/users/me/block', {
      method: 'POST',
      body: JSON.stringify({ userId, reason }),
    });
  }

  unblockUser(userId) {
    return this.request('/users/me/unblock', {
      method: 'POST',
      body: JSON.stringify({ userId }),
    });
  }

  getUserById(id) {
    return this.request(`/users/${id}`);
  }

  // Discovery
  discover(filters = {}) {
    const params = new URLSearchParams();
    if (filters.interests) params.set('interests', typeof filters.interests === 'string' ? filters.interests : filters.interests.join(','));
    if (filters.minPrice) params.set('minPrice', filters.minPrice);
    if (filters.maxPrice) params.set('maxPrice', filters.maxPrice);
    if (filters.status) params.set('status', filters.status);
    if (filters.minRating) params.set('minRating', filters.minRating);
    if (filters.search) params.set('search', filters.search);
    if (filters.sortBy) params.set('sortBy', filters.sortBy);
    if (filters.page) params.set('page', filters.page);
    return this.request(`/discover?${params.toString()}`);
  }

  getInterests() {
    return this.request('/discover/interests');
  }

  // Chat
  getChatRooms() {
    return this.request('/chat/rooms');
  }

  getChatRoom(roomId) {
    return this.request(`/chat/rooms/${roomId}`);
  }

  createChatRoom(userId) {
    return this.request('/chat/rooms', {
      method: 'POST',
      body: JSON.stringify({ userId }),
    });
  }

  getMessages(roomId, limit = 50, skip = 0) {
    return this.request(`/chat/rooms/${roomId}/messages?limit=${limit}&skip=${skip}`);
  }

  requestReveal(roomId) {
    return this.request(`/chat/rooms/${roomId}/reveal`, { method: 'POST' });
  }

  markAsRead(roomId) {
    return this.request(`/chat/rooms/${roomId}/read`, { method: 'POST' });
  }

  getUnreadCount() {
    return this.request('/chat/unread');
  }

  blockChatRoom(roomId) {
    return this.request(`/chat/rooms/${roomId}/block`, { method: 'PUT' });
  }

  // Sessions (Bookings)
  createSession(renterId, notes) {
    return this.request('/sessions', {
      method: 'POST',
      body: JSON.stringify({ renterId, notes }),
    });
  }

  acceptSession(id) {
    return this.request(`/sessions/${id}/accept`, { method: 'PUT' });
  }

  startSession(id) {
    return this.request(`/sessions/${id}/start`, { method: 'PUT' });
  }

  endSession(id, reason) {
    return this.request(`/sessions/${id}/end`, {
      method: 'PUT',
      body: JSON.stringify({ reason }),
    });
  }

  cancelSession(id, reason) {
    return this.request(`/sessions/${id}/cancel`, {
      method: 'PUT',
      body: JSON.stringify({ reason }),
    });
  }

  getMySessions(role = 'buyer') {
    return this.request(`/sessions/my?role=${role}`);
  }

  getSession(id) {
    return this.request(`/sessions/${id}`);
  }

  // Reviews
  createReview(data) {
    return this.request('/reviews', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  getUserReviews(userId) {
    return this.request(`/reviews/user/${userId}`);
  }

  getSessionReviews(sessionId) {
    return this.request(`/reviews/session/${sessionId}`);
  }

  // Admin
  getAdminDashboard() {
    return this.request('/admin/dashboard');
  }

  getAdminUsers() {
    return this.request('/admin/users');
  }

  adminBlockUser(id, reason) {
    return this.request(`/admin/users/${id}/block`, {
      method: 'PUT',
      body: JSON.stringify({ reason }),
    });
  }

  adminUnblockUser(id) {
    return this.request(`/admin/users/${id}/unblock`, { method: 'PUT' });
  }

  verifyUser(id, status = 'verified') {
    return this.request(`/admin/users/${id}/verify`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    });
  }

  getAdminReports(status) {
    const q = status ? `?status=${status}` : '';
    return this.request(`/admin/reports${q}`);
  }

  updateReport(id, data) {
    return this.request(`/admin/reports/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  getAdminSessions() {
    return this.request('/admin/sessions');
  }

  // Wallet
  getWallet() {
    return this.request('/users/me/wallet');
  }

  addFunds(amount) {
    return this.request('/users/me/wallet/add', {
      method: 'POST',
      body: JSON.stringify({ amount }),
    });
  }

  withdrawFunds(amount) {
    return this.request('/users/me/wallet/withdraw', {
      method: 'POST',
      body: JSON.stringify({ amount }),
    });
  }

  // Report a user
  createReport(data) {
    return this.request('/reports', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Notifications
  getNotifications() {
    return this.request('/notifications');
  }

  getUnreadNotifCount() {
    return this.request('/notifications/unread-count');
  }

  markAllNotifRead() {
    return this.request('/notifications/read-all', { method: 'PUT' });
  }

  markNotifRead(id) {
    return this.request(`/notifications/${id}/read`, { method: 'PUT' });
  }

  deleteNotif(id) {
    return this.request(`/notifications/${id}`, { method: 'DELETE' });
  }

  // Account Management
  pauseAccount() {
    return this.request('/users/me/pause', { method: 'PUT' });
  }

  resumeAccount() {
    return this.request('/users/me/resume', { method: 'PUT' });
  }

  deleteAccount() {
    return this.request('/users/me', { method: 'DELETE' });
  }
}

export const api = new ApiService();
export default api;
