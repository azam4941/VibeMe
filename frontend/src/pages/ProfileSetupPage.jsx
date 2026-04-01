import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Camera, ArrowLeft, MapPin, AlertCircle, CheckCircle } from 'lucide-react';
import api from '../services/api';
import './ProfileSetupPage.css';

const VIBES = [
  'Gossip', 'Vent Listener', 'Emotional Support', 'Timepass', 'Advice',
  'Late Night', 'Deep Talks', 'Comfort', 'Life Coach', 'Gaming',
  'Study Buddy', 'Career Guidance', 'Relationship Talk',
];

const ProfileSetupPage = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const { user, refreshUser } = useAuth();
  const [formStep, setFormStep] = useState(1);
  const [name, setName] = useState(user?.name || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [location, setLocation] = useState(user?.location || '');
  const [photo, setPhoto] = useState(user?.profilePhoto || '');
  const [selectedVibes, setSelectedVibes] = useState(user?.interests || []);
  const [rentMode, setRentMode] = useState(user?.rentMode || false);
  const [price, setPrice] = useState(user?.pricePerMinute || 5);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [saveError, setSaveError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);

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
        const MAX = 400;
        let width = img.width;
        let height = img.height;
        if (width > height) {
          if (width > MAX) { height *= MAX / width; width = MAX; }
        } else {
          if (height > MAX) { width *= MAX / height; height = MAX; }
        }
        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      };
    });
  };

  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setErrors(prev => ({ ...prev, photo: 'Image must be under 5MB' }));
      return;
    }
    setErrors(prev => ({ ...prev, photo: '' }));
    const reader = new FileReader();
    reader.onloadend = async () => {
      const resized = await resizeImage(reader.result);
      setPhoto(resized);
    };
    reader.readAsDataURL(file);
  };

  const handleBack = () => {
    if (formStep > 1) setFormStep(formStep - 1);
    else navigate('/profile');
  };

  const validateStep1 = () => {
    const errs = {};
    if (!name.trim()) errs.name = 'Name is required';
    else if (name.trim().length < 2) errs.name = 'Name must be at least 2 characters';
    else if (name.trim().length > 50) errs.name = 'Name must be under 50 characters';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const validateStep2 = () => {
    const errs = {};
    if (bio.length > 500) errs.bio = 'Bio must be under 500 characters';
    if (location.length > 100) errs.location = 'Location must be under 100 characters';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const validateStep4 = () => {
    const errs = {};
    if (rentMode && (price < 0 || price > 100000)) {
      errs.price = 'Price must be between ₹0 and ₹1,00,000';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const goToStep = (step) => {
    if (step === 2 && !validateStep1()) return;
    if (step === 3 && !validateStep2()) return;
    setFormStep(step);
  };

  const handleSubmit = async () => {
    if (!validateStep4()) return;
    setLoading(true);
    setSaveError('');
    setSaveSuccess(false);
    try {
      await api.updateProfile({
        name: name.trim(),
        bio: bio.trim(),
        location: location.trim(),
        profilePhoto: photo,
        interests: selectedVibes,
        rentMode,
        pricePerMinute: price,
      });
      await refreshUser();
      setSaveSuccess(true);
      setTimeout(() => navigate('/profile'), 1000);
    } catch (err) {
      setSaveError(err.message || 'Failed to save profile. Please try again.');
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
        {saveError && (
          <div className="setup-error-banner">
            <AlertCircle size={16} />
            <span>{saveError}</span>
          </div>
        )}
        {saveSuccess && (
          <div className="setup-success-banner">
            <CheckCircle size={16} />
            <span>Profile saved successfully!</span>
          </div>
        )}

        {formStep === 1 && (
          <div className="animate-slideUp">
            <div className="setup-avatar-center" onClick={() => fileInputRef.current?.click()}>
              <input type="file" ref={fileInputRef} onChange={handlePhotoChange} style={{ display: 'none' }} accept="image/*" />
              <div className="setup-avatar" style={{
                backgroundImage: photo ? `url(${photo})` : 'none',
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                borderStyle: photo ? 'solid' : 'dashed',
              }}>
                {!photo && <Camera size={28} />}
              </div>
              <span className="setup-avatar-label">{photo ? 'Change Photo' : 'Upload Photo (optional)'}</span>
            </div>
            {errors.photo && <div className="field-error"><AlertCircle size={12} /> {errors.photo}</div>}

            <div className="input-group">
              <label className="ig-label">YOUR NAME *</label>
              <input
                className={`ig-input ${errors.name ? 'ig-input-error' : ''}`}
                placeholder="e.g. Priya Sharma"
                value={name}
                onChange={e => { setName(e.target.value); setErrors(prev => ({ ...prev, name: '' })); }}
                maxLength={50}
              />
              {errors.name && <div className="field-error"><AlertCircle size={12} /> {errors.name}</div>}
              <div className="field-hint">{name.length}/50 characters</div>
            </div>
            <button className="btn btn-primary btn-block setup-next" onClick={() => goToStep(2)} disabled={!name.trim()}>
              Continue
            </button>
          </div>
        )}

        {formStep === 2 && (
          <div className="animate-slideUp">
            <div className="input-group">
              <label className="ig-label">BIO</label>
              <textarea
                className={`ig-textarea ${errors.bio ? 'ig-input-error' : ''}`}
                value={bio}
                onChange={e => { setBio(e.target.value); setErrors(prev => ({ ...prev, bio: '' })); }}
                placeholder="Tell people about yourself..."
                maxLength={500}
              />
              {errors.bio && <div className="field-error"><AlertCircle size={12} /> {errors.bio}</div>}
              <div className="field-hint">{bio.length}/500 characters</div>
            </div>
            <div className="input-group">
              <label className="ig-label">LOCATION</label>
              <div className="ig-input-with-icon">
                <MapPin size={16} className="ig-icon" />
                <input
                  className={`ig-input ig-input-icon ${errors.location ? 'ig-input-error' : ''}`}
                  placeholder="e.g. Mumbai, India"
                  value={location}
                  onChange={e => { setLocation(e.target.value); setErrors(prev => ({ ...prev, location: '' })); }}
                  maxLength={100}
                />
              </div>
              {errors.location && <div className="field-error"><AlertCircle size={12} /> {errors.location}</div>}
            </div>
            <div className="setup-btns-row">
              <button className="btn btn-secondary flex-1" onClick={() => setFormStep(1)}>Back</button>
              <button className="btn btn-primary flex-2" onClick={() => goToStep(3)}>Continue</button>
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
              <div className="field-hint">{selectedVibes.length} selected — pick at least 1</div>
            </div>
            <div className="setup-btns-row">
              <button className="btn btn-secondary flex-1" onClick={() => setFormStep(2)}>Back</button>
              <button className="btn btn-primary flex-2" onClick={() => goToStep(4)} disabled={selectedVibes.length === 0}>Continue</button>
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
                  <input
                    className={`price-inp ${errors.price ? 'ig-input-error' : ''}`}
                    type="number"
                    value={price}
                    onChange={e => { setPrice(Number(e.target.value)); setErrors(prev => ({ ...prev, price: '' })); }}
                    min="0"
                    max="100000"
                  />
                  <span className="price-unit">per minute</span>
                </div>
                {errors.price && <div className="field-error"><AlertCircle size={12} /> {errors.price}</div>}
              </div>
            )}

            <div className="setup-btns-row">
              <button className="btn btn-secondary flex-1" onClick={() => setFormStep(3)}>Back</button>
              <button className="btn btn-primary flex-2" onClick={handleSubmit} disabled={loading}>
                {loading ? 'Saving...' : 'Complete Setup'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProfileSetupPage;
