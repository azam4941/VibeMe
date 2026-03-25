import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Camera, ArrowLeft } from 'lucide-react';
import api from '../services/api';
import './ProfileSetupPage.css';

const VIBES = ['Gossip', 'Vent Listener', 'Emotional Support', 'Timepass', 'Advice', 'Late Night', 'Deep Talks', 'Comfort', 'Life Coach'];

const ProfileSetupPage = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const { user, refreshUser } = useAuth();
  const [formStep, setFormStep] = useState(1);
  const [name, setName] = useState(user?.name || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [photo, setPhoto] = useState(user?.profilePhoto || '');
  const [selectedVibes, setSelectedVibes] = useState(user?.interests || []);
  const [rentMode, setRentMode] = useState(user?.rentMode || false);
  const [price, setPrice] = useState(user?.pricePerMinute || 5);
  const [loading, setLoading] = useState(false);

  const toggleVibe = (vibe) => {
    setSelectedVibes(prev =>
      prev.includes(vibe) ? prev.filter(v => v !== vibe) : [...prev, vibe]
    );
  };

  const resizeImage = (base64Str) => {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = base64Str;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 400;
        const MAX_HEIGHT = 400;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      };
    });
  };

  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = async () => {
      const resized = await resizeImage(reader.result);
      setPhoto(resized);
    };
    reader.readAsDataURL(file);
  };

  const handleBack = () => {
    if (formStep > 1) {
      setFormStep(formStep - 1);
    } else {
      navigate('/profile');
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      await api.updateProfile({
        name,
        bio,
        profilePhoto: photo,
        interests: selectedVibes,
        rentMode,
        pricePerMinute: price,
      });
      await refreshUser();
      navigate('/profile');
    } catch (err) {
      console.error('Setup failed:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="setup-page">
      <div className="setup-header">
        <div className="setup-top-row">
          <button className="back-btn" onClick={handleBack}><ArrowLeft size={20} /></button>
          <div className="setup-steps">
            {[1, 2, 3, 4].map(s => (
              <div key={s} className={`step-dot ${s < formStep ? 'done' : ''} ${s === formStep ? 'active' : ''}`} />
            ))}
          </div>
        </div>
        <h2 className="setup-title">Set Up Your Profile</h2>
        <p className="setup-sub">Step {formStep} of 4 — {
          formStep === 1 ? 'Basic info' :
          formStep === 2 ? 'Tell us about yourself' :
          formStep === 3 ? 'Pick your vibes' :
          'Earning preferences'
        }</p>
      </div>

      <div className="setup-body">
        {formStep === 1 && (
          <div className="animate-slideUp">
            <div className="setup-avatar-center" onClick={() => fileInputRef.current?.click()}>
              <input type="file" ref={fileInputRef} onChange={handlePhotoChange} style={{ display: 'none' }} accept="image/*" />
              <div className="setup-avatar" style={{ backgroundImage: photo ? `url(${photo})` : 'none', backgroundSize: 'cover', backgroundPosition: 'center', borderStyle: photo ? 'solid' : 'dashed' }}>
                {!photo && <Camera size={28} />}
              </div>
              <span className="setup-avatar-label">{photo ? 'Change Photo' : 'Upload Photo (optional)'}</span>
            </div>
            <div className="input-group">
              <label className="ig-label">YOUR NAME</label>
              <input className="ig-input" placeholder="e.g. Priya Sharma" value={name} onChange={e => setName(e.target.value)} />
            </div>
            <button className="btn btn-primary btn-block setup-next" onClick={() => setFormStep(2)} disabled={!name.trim()}>
              Continue →
            </button>
          </div>
        )}

        {formStep === 2 && (
          <div className="animate-slideUp">
            <div className="input-group">
              <label className="ig-label">BIO</label>
              <textarea className="ig-textarea" value={bio} onChange={e => setBio(e.target.value)} placeholder="Tell people about yourself..." />
            </div>
            <div className="setup-btns-row">
               <button className="btn btn-secondary flex-1" onClick={() => setFormStep(1)}>Back</button>
               <button className="btn btn-primary flex-2" onClick={() => setFormStep(3)}>Continue →</button>
            </div>
          </div>
        )}

        {formStep === 3 && (
          <div className="animate-slideUp">
            <div className="input-group">
              <label className="ig-label">YOUR VIBES (pick your interests)</label>
              <div className="interest-grid">
                {VIBES.map(v => (
                  <div key={v} className={`int-chip ${selectedVibes.includes(v) ? 'sel' : ''}`} onClick={() => toggleVibe(v)}>
                    {v}
                  </div>
                ))}
              </div>
            </div>
            <div className="setup-btns-row">
               <button className="btn btn-secondary flex-1" onClick={() => setFormStep(2)}>Back</button>
               <button className="btn btn-primary flex-2" onClick={() => setFormStep(4)} disabled={selectedVibes.length === 0}>Continue →</button>
            </div>
          </div>
        )}

        {formStep === 4 && (
          <div className="animate-slideUp">
            <div className="toggle-row">
              <div className="tr-left">
                <div className="tr-title">Rent Mode — Earn Money</div>
                <div className="tr-sub">Let others book your time</div>
              </div>
              <div className={`toggle-switch ${!rentMode ? 'off' : ''}`} onClick={() => setRentMode(!rentMode)}>
                <div className="toggle-thumb" />
              </div>
            </div>

            {rentMode && (
              <div className="input-group">
                <label className="ig-label">SET YOUR PRICE</label>
                <div className="price-input-row">
                  <span className="price-sym">₹</span>
                  <input className="price-inp" type="number" value={price} onChange={e => setPrice(Number(e.target.value))} min="1" />
                  <span className="price-unit">per minute</span>
                </div>
              </div>
            )}

            <div className="setup-btns-row">
               <button className="btn btn-secondary flex-1" onClick={() => setFormStep(3)}>Back</button>
               <button className="btn btn-primary flex-2" onClick={handleSubmit} disabled={loading}>
                 {loading ? 'Saving...' : 'Complete Setup →'}
               </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProfileSetupPage;
