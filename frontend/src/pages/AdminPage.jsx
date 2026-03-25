import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Users, AlertTriangle, Activity, ShieldBan, ShieldCheck, 
  CheckCircle, RefreshCw, BarChart, UserX, Clock
} from 'lucide-react';
import './AdminPage.css';
import api from '../services/api';

const AdminPage = () => {
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [reports, setReports] = useState([]);
  const [verifications, setVerifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard'); // 'dashboard', 'users', 'reports', 'verifications'

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'dashboard') {
        const data = await api.getAdminDashboard();
        setStats(data);
      } else if (activeTab === 'users') {
        const data = await api.getAdminUsers();
        setUsers(data);
      } else if (activeTab === 'reports') {
        const data = await api.getAdminReports('pending');
        setReports(data);
      } else if (activeTab === 'verifications') {
        const data = await api.getAdminUsers(); // Filter users by pending verification
        setVerifications(data.filter(u => u.verificationStatus === 'pending'));
      }
    } catch (err) {
      console.error('Failed to fetch admin data', err);
    } finally {
      setLoading(false);
    }
  };

  const handleBlockUser = async (userId, isBlocked) => {
    try {
      if (isBlocked) {
        await api.adminUnblockUser(userId);
      } else {
        await api.adminBlockUser(userId, 'Admin decision');
      }
      fetchData(); // refresh list
    } catch (err) {
      alert('Failed to update user block status');
    }
  };

  const handleVerifyUser = async (userId, status = 'verified') => {
    try {
      await api.verifyUser(userId, status);
      fetchData();
    } catch (err) {
      alert('Failed to update verification status');
    }
  };

  const handleUpdateReport = async (reportId, status) => {
    try {
      await api.updateReport(reportId, { status, adminNote: `Resolved at ${new Date().toISOString()}` });
      fetchData(); // refresh
    } catch (err) {
      alert('Failed to update report');
    }
  };

  return (
    <div className="admin-container container">
      <div className="admin-header">
        <div>
          <h1 className="flex items-center gap-2"><ShieldCheck className="text-primary" /> Admin Portal</h1>
          <p className="text-muted text-sm mt-4">Manage users, reports, and system health.</p>
        </div>
        <button className="btn btn-icon btn-secondary" onClick={fetchData}>
          <RefreshCw size={18} className={loading ? 'spinning' : ''} />
        </button>
      </div>

      <div className="admin-tabs glass">
        <button 
          className={`tab-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
          onClick={() => setActiveTab('dashboard')}
        >
          <BarChart size={18} /> Dashboard
        </button>
        <button 
          className={`tab-btn ${activeTab === 'users' ? 'active' : ''}`}
          onClick={() => setActiveTab('users')}
        >
          <Users size={18} /> User Management
        </button>
        <button 
          className={`tab-btn ${activeTab === 'reports' ? 'active' : ''}`}
          onClick={() => setActiveTab('reports')}
        >
          <AlertTriangle size={18} /> Reports {stats?.pendingReports > 0 && <span className="badge badge-danger">{stats.pendingReports}</span>}
        </button>
        <button 
          className={`tab-btn ${activeTab === 'verifications' ? 'active' : ''}`}
          onClick={() => setActiveTab('verifications')}
        >
          <ShieldCheck size={18} /> Verifications
        </button>
      </div>

      <div className="admin-content mt-24">
        {loading && !stats ? (
          <div className="flex-center py-40"><div className="spinner" /></div>
        ) : (
          <AnimatePresence mode="wait">
            {activeTab === 'dashboard' && stats && (
              <motion.div 
                key="dashboard"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="dashboard-grid"
              >
                <div className="stat-card glass">
                  <div className="stat-icon-wrap primary"><Users size={24} /></div>
                  <div className="stat-info">
                    <span className="stat-val">{stats.totalUsers}</span>
                    <span className="stat-label">Total Users</span>
                  </div>
                </div>
                <div className="stat-card glass">
                  <div className="stat-icon-wrap accent"><ShieldCheck size={24} /></div>
                  <div className="stat-info">
                    <span className="stat-val">{stats.verifiedUsers}</span>
                    <span className="stat-label">Verified</span>
                  </div>
                </div>
                <div className="stat-card glass">
                  <div className="stat-icon-wrap hot"><Activity size={24} /></div>
                  <div className="stat-info">
                    <span className="stat-val">{stats.totalSessions}</span>
                    <span className="stat-label">Total Sessions</span>
                  </div>
                </div>
                <div className="stat-card glass">
                  <div className="stat-icon-wrap danger"><AlertTriangle size={24} /></div>
                  <div className="stat-info">
                    <span className="stat-val">{stats.pendingReports}</span>
                    <span className="stat-label">Pending Reports</span>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'users' && (
              <motion.div 
                key="users"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                className="admin-table-container glass"
              >
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>User</th>
                      <th>Phone</th>
                      <th>Mode</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map(u => (
                      <tr key={u._id} className={u.isBlocked ? 'row-blocked' : ''}>
                        <td>
                          <div className="flex items-center">
                            <img src={u.profilePhoto || `https://avatar.iran.liara.run/public?username=${u.name}`} alt={u.name} className="avatar avatar-sm" />
                            <div className="ml-12"><span className="font-semibold">{u.name}</span></div>
                          </div>
                        </td>
                        <td className="text-muted">{u.phoneNumber}</td>
                        <td>
                          {u.rentMode ? (
                            <span className="badge badge-primary">Renter</span>
                          ) : (
                            <span className="badge badge-secondary">Buyer</span>
                          )}
                        </td>
                        <td>
                          <div className="flex gap-2">
                            {u.isVerified ? (
                              <span className="badge badge-success" title="Verified"><CheckCircle size={12} /></span>
                            ) : (
                              <span className="badge badge-secondary" title="Unverified"><Clock size={12} /></span>
                            )}
                            {u.isBlocked && (
                              <span className="badge badge-danger" title="Blocked"><ShieldBan size={12} /></span>
                            )}
                          </div>
                        </td>
                        <td>
                          <div className="td-actions">
                            {!u.isVerified && (
                              <button className="btn btn-sm btn-success" onClick={() => handleVerifyUser(u._id)}>
                                Verify
                              </button>
                            )}
                            <button 
                              className={`btn btn-sm ${u.isBlocked ? 'btn-secondary' : 'btn-danger'}`}
                              onClick={() => handleBlockUser(u._id, u.isBlocked)}
                            >
                              {u.isBlocked ? 'Unblock' : 'Block'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </motion.div>
            )}
            {activeTab === 'reports' && (
              <motion.div 
                key="reports"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="reports-grid"
              >
                {reports.length === 0 ? (
                  <div className="empty-state w-full card glass">
                    <CheckCircle size={48} className="text-success" />
                    <h3>All caught up!</h3>
                    <p>There are no pending reports to review.</p>
                  </div>
                ) : (
                  reports.map(report => (
                    <div key={report._id} className="report-card glass">
                      <div className="report-header">
                        <span className="badge badge-danger">Report: {report.reason}</span>
                        <span className="text-xs text-muted">{new Date(report.createdAt).toLocaleDateString()}</span>
                      </div>
                      
                      <div className="report-body">
                        <p className="text-sm font-semibold mb-8">Target User:</p>
                        <div className="td-user mb-16">
                          <img src={report.reportedUser.profilePhoto || `https://avatar.iran.liara.run/public?username=${report.reportedUser.name}`} alt={report.reportedUser.name} className="avatar avatar-sm" />
                          <div className="ml-12">
                            <span className="font-semibold block">{report.reportedUser.name}</span>
                            <span className="text-xs text-danger">{report.reportedUser.reportCount || 0} prior reports</span>
                          </div>
                        </div>
                        
                        <p className="text-sm font-semibold mb-4">Details:</p>
                        <p className="text-sm text-secondary bg-black-20 p-12 rounded-md italic">
                          "{report.details || 'No details provided'}"
                        </p>
                      </div>

                      <div className="report-actions mt-16 flex gap-12">
                        <button className="btn btn-primary flex-1" onClick={() => handleUpdateReport(report._id, 'resolved')}>
                          Resolve
                        </button>
                        <button className="btn btn-outline flex-1" onClick={() => handleUpdateReport(report._id, 'dismissed')}>
                          Dismiss
                        </button>
                        <button className="btn btn-danger btn-icon" title="Block User" onClick={() => handleBlockUser(report.reportedUser._id, false)}>
                          <UserX size={18} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </motion.div>
            )}

            {activeTab === 'verifications' && (
              <motion.div 
                key="verifications"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="verifications-container glass p-24"
              >
                <h3>Pending Identity Verifications</h3>
                <p className="text-muted text-sm mb-24">Review government IDs and verify users to keep RentMe safe and compliant.</p>
                
                {verifications.length === 0 ? (
                  <div className="empty-state card glass">
                    <CheckCircle size={48} className="text-success" />
                    <h3>No pending requests</h3>
                    <p>Great job! All identity verification requests are settled.</p>
                  </div>
                ) : (
                  <div className="verification-cards">
                    {verifications.map(u => (
                      <div key={u._id} className="verification-card card glass mb-16">
                        <div className="flex justify-between items-start">
                          <div className="user-profile-summary">
                            <div className="flex gap-12 items-center mb-12">
                              <img src={u.profilePhoto || `https://avatar.iran.liara.run/public?username=${u.name}`} alt="User" className="avatar avatar-md" />
                              <div className="ml-16">
                                <h4 className="font-bold">{u.name}</h4>
                                <span className="text-xs text-muted">Phone: {u.phoneNumber}</span>
                              </div>
                            </div>
                            <div className="id-photo-preview mb-16">
                              <p className="text-xs font-semibold mb-4">Submitted ID Photo:</p>
                              <img 
                                src={u.idPhotoUrl || 'https://via.placeholder.com/400x250?text=No+ID+Photo'} 
                                alt="Government ID" 
                                className="id-img"
                                onClick={() => window.open(u.idPhotoUrl, '_blank')}
                                style={{ cursor: 'pointer', borderRadius: '8px', border: '1px solid var(--border-subtle)', maxWidth: '100%' }}
                              />
                            </div>
                          </div>
                          
                          <div className="verification-actions flex flex-col gap-12">
                            <button className="btn btn-success" onClick={() => handleVerifyUser(u._id, 'verified')}>
                              <ShieldCheck size={16} /> Approve & Verify
                            </button>
                            <button className="btn btn-danger" onClick={() => handleVerifyUser(u._id, 'rejected')}>
                              <UserX size={16} /> Reject ID
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
};

export default AdminPage;
