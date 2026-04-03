import React, { useState } from 'react';
import { PauseCircle, Play, Trash2, AlertTriangle, X, ShieldAlert } from 'lucide-react';
import './AccountSettingsModal.css';

const AccountSettingsModal = ({ isOpen, onClose, onPause, onResume, onDelete, isPaused, loading }) => {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteText, setDeleteText] = useState('');

  if (!isOpen) return null;

  const handleDelete = () => {
    if (deleteText === 'DELETE') {
      onDelete();
      setDeleteText('');
      setShowDeleteConfirm(false);
    }
  };

  return (
    <div className="asm-overlay" onClick={onClose}>
      <div className="asm-modal" onClick={e => e.stopPropagation()}>
        <div className="asm-header">
          <h3 className="asm-title">Account Settings</h3>
          <button className="asm-close" onClick={onClose}><X size={20} /></button>
        </div>

        {!showDeleteConfirm ? (
          <div className="asm-body">
            {/* Pause / Resume Section */}
            <div className="asm-section">
              <div className="asm-section-icon pause">
                {isPaused ? <Play size={22} /> : <PauseCircle size={22} />}
              </div>
              <div className="asm-section-content">
                <h4>{isPaused ? 'Resume Account' : 'Pause Account'}</h4>
                <p>{isPaused
                  ? 'Your profile is currently hidden. Resume to appear in discovery again.'
                  : 'Temporarily hide your profile from discovery. You can resume anytime.'
                }</p>
              </div>
            </div>
            <button
              className={`btn btn-block ${isPaused ? 'asm-btn-resume' : 'asm-btn-pause'}`}
              onClick={isPaused ? onResume : onPause}
              disabled={loading}
            >
              {loading ? 'Processing...' : isPaused ? 'Resume My Account' : 'Pause My Account'}
            </button>

            <div className="asm-divider" />

            {/* Delete Section */}
            <div className="asm-section danger">
              <div className="asm-section-icon delete">
                <Trash2 size={22} />
              </div>
              <div className="asm-section-content">
                <h4>Delete Account</h4>
                <p>Permanently delete your account and all associated data. This action cannot be undone.</p>
              </div>
            </div>
            <button
              className="btn btn-danger btn-block asm-btn-delete"
              onClick={() => setShowDeleteConfirm(true)}
            >
              Delete My Account
            </button>
          </div>
        ) : (
          <div className="asm-body asm-confirm-delete">
            <div className="asm-danger-icon">
              <ShieldAlert size={48} />
            </div>
            <h3 className="asm-danger-title">Are you sure?</h3>
            <p className="asm-danger-text">
              This will permanently delete your account, including all your chats, sessions, and wallet balance. This cannot be undone.
            </p>
            <div className="asm-danger-input-group">
              <label className="ig-label">TYPE "DELETE" TO CONFIRM</label>
              <input
                className="asm-danger-input"
                type="text"
                value={deleteText}
                onChange={e => setDeleteText(e.target.value.toUpperCase())}
                placeholder="DELETE"
                autoFocus
              />
            </div>
            <div className="asm-danger-actions">
              <button
                className="btn btn-secondary flex-1"
                onClick={() => { setShowDeleteConfirm(false); setDeleteText(''); }}
              >
                Cancel
              </button>
              <button
                className="btn btn-danger flex-2"
                onClick={handleDelete}
                disabled={deleteText !== 'DELETE' || loading}
              >
                {loading ? 'Deleting...' : 'Permanently Delete'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AccountSettingsModal;
