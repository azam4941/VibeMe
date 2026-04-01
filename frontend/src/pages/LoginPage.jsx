import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useAlert } from '../context/AlertContext';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import { auth, isLocalDev } from '../services/firebase';
import { RecaptchaVerifier, signInWithPhoneNumber } from 'firebase/auth';
import api from '../services/api';
import './LoginPage.css';

const LoginPage = () => {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [step, setStep] = useState(0); // 0: Splash, 1: Phone, 2: OTP
  const [loading, setLoading] = useState(false);
  const [otpTimer, setOtpTimer] = useState(42);
  const [authMode, setAuthMode] = useState(null); // 'firebase' | 'backend'
  const [backendOtp, setBackendOtp] = useState(null); // dev-only: OTP from backend response
  const { login, loginWithFirebase } = useAuth();
  const { showAlert } = useAlert();
  const otpRefs = useRef([]);

  useEffect(() => {
    let interval;
    if (step === 2 && otpTimer > 0) {
      interval = setInterval(() => setOtpTimer(t => t - 1), 1000);
    }
    return () => clearInterval(interval);
  }, [step, otpTimer]);

  // Auto-submit when OTP is complete
  useEffect(() => {
    const otpString = otp.join('');
    if (step === 2 && otpString.length === 6) {
      handleVerifyOtp({ preventDefault: () => {} });
    }
  }, [otp]);

  const setupRecaptcha = () => {
    if (window.recaptchaVerifier) {
      try { window.recaptchaVerifier.clear(); } catch (_) {}
      window.recaptchaVerifier = null;
    }
    window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
      size: 'invisible',
    });
  };

  const sendViaBackend = async () => {
    const res = await api.sendOtp(phoneNumber);
    setAuthMode('backend');
    if (res.otp) {
      setBackendOtp(res.otp);
    }
    showAlert(res.message || 'OTP sent successfully!', 'success');
    setStep(2);
    setOtpTimer(42);
  };

  const handleSendOtp = async (e) => {
    if (e) e.preventDefault();
    if (!phoneNumber || phoneNumber.length < 10) {
      showAlert('Please enter a valid phone number', 'warning');
      return;
    }
    setLoading(true);
    setBackendOtp(null);

    // On localhost, skip Firebase entirely — use backend OTP for reliable dev experience
    if (isLocalDev) {
      try {
        await sendViaBackend();
      } catch (err) {
        showAlert(err.message || 'Failed to send OTP. Is the backend running?', 'error');
      } finally {
        setLoading(false);
      }
      return;
    }

    // ─── Production: try Firebase first, fall back to backend ───
    try {
      setupRecaptcha();
      const formatPhone = phoneNumber.startsWith('+') ? phoneNumber : `+91${phoneNumber}`;
      const confirmationResult = await signInWithPhoneNumber(auth, formatPhone, window.recaptchaVerifier);
      window.confirmationResult = confirmationResult;
      setAuthMode('firebase');
      showAlert('OTP sent successfully!', 'success');
      setStep(2);
      setOtpTimer(42);
      setLoading(false);
      return;
    } catch (firebaseErr) {
      console.warn('Firebase phone auth failed, falling back to backend OTP:', firebaseErr.code || firebaseErr.message);
      if (window.recaptchaVerifier) {
        try { window.recaptchaVerifier.clear(); } catch (_) {}
        window.recaptchaVerifier = null;
      }
      window.confirmationResult = null;
    }

    try {
      await sendViaBackend();
    } catch (backendErr) {
      showAlert(backendErr.message || 'Failed to send OTP. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (index, value) => {
    if (!/^\d*$/.test(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value.slice(-1);
    setOtp(newOtp);
    if (value && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const handleVerifyOtp = async (e) => {
    if (e) e.preventDefault();
    const otpString = otp.join('');
    if (otpString.length < 6) {
      showAlert('Please enter the complete 6-digit OTP', 'warning');
      return;
    }
    setLoading(true);
    try {
      if (authMode === 'firebase' && window.confirmationResult) {
        const result = await window.confirmationResult.confirm(otpString);
        const idToken = await result.user.getIdToken();
        await loginWithFirebase(idToken);
      } else {
        await login(phoneNumber, otpString);
      }
      showAlert('Logged in successfully!', 'success');
    } catch (err) {
      console.error(err);
      showAlert(err.message || 'Invalid OTP', 'error');
    } finally {
      setLoading(false);
    }
  };

  // ===== SPLASH SCREEN =====
  if (step === 0) {
    return (
      <div className="vibe-splash page-dark">
        <div className="splash-circles">
          <div className="sc sc1" />
          <div className="sc sc2" />
          <div className="sc sc3" />
        </div>
        <div className="splash-content">
          <div className="splash-icon">
            <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
              <circle cx="20" cy="20" r="18" stroke="#7F77DD" strokeWidth="2"/>
              <path d="M12 20c0-4.4 3.6-8 8-8s8 3.6 8 8-3.6 8-8 8" stroke="#AFA9EC" strokeWidth="2.5" strokeLinecap="round"/>
              <circle cx="20" cy="20" r="3" fill="#7F77DD"/>
            </svg>
          </div>
          <h1 className="splash-logo">Vibe<span>Me</span></h1>
          <p className="splash-tag">find your person, your vibe</p>

          <div className="splash-dots">
            <div className="sdot active" />
            <div className="sdot" />
            <div className="sdot" />
          </div>

          <button className="btn btn-primary btn-lg splash-cta" onClick={() => setStep(1)}>
            Get Started
          </button>
          <p className="splash-signin" onClick={() => setStep(1)}>
            Already have account? <span style={{color:'var(--purple-light)', fontWeight:700}}>Sign In</span>
          </p>
        </div>
        <div className="splash-footer">
          <p>By continuing you agree to our Terms & Privacy Policy</p>
        </div>
      </div>
    );
  }

  // ===== LOGIN SCREEN (Phone Input) =====
  if (step === 1) {
    return (
      <div className="vibe-login page-dark">
        <div className="login-hero">
          <div className="login-back" onClick={() => setStep(0)}>
            <ArrowLeft size={20} />
          </div>
          <h1 className="login-title">Welcome to<br /><span>VibeMe</span> 👋</h1>
          <p className="login-sub">Enter your mobile number to continue</p>
        </div>
        <div className="login-form-card">
          <div id="recaptcha-container"></div>
          <label className="ig-label">MOBILE NUMBER</label>
          <div className="phone-input-row">
            <span className="phone-flag">🇮🇳</span>
            <div className="phone-sep" />
            <span className="phone-code">+91</span>
            <input
              type="tel"
              className="phone-input"
              placeholder="98765 43210"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, '').slice(0, 10))}
            />
          </div>

          <button
            className={`btn btn-primary btn-block login-submit ${loading ? 'btn-loading' : ''}`}
            onClick={handleSendOtp}
            disabled={loading}
          >
            {loading ? 'Sending...' : 'Send OTP →'}
          </button>

          <p className="login-terms">
            By continuing, you agree to our <span>Terms of Service</span> and <span>Privacy Policy</span>
          </p>

          <div className="social-sep">
            <div className="sep-line" />
            <span className="sep-text">or continue with</span>
            <div className="sep-line" />
          </div>
          <div className="social-row">
            <div className="social-btn">🌐 Google</div>
            <div className="social-btn">📱 WhatsApp</div>
          </div>

          <div className="login-secure">
            <ShieldCheck size={14} />
            <span>Encrypted & Secure Login</span>
          </div>
        </div>
      </div>
    );
  }

  // ===== OTP SCREEN =====
  return (
    <div className="vibe-login page-dark">
      <div className="login-hero">
        <div className="login-back" onClick={() => { setStep(1); setOtp(['', '', '', '', '', '']); setBackendOtp(null); }}>
          <ArrowLeft size={20} />
        </div>
        <h1 className="otp-title">Verify OTP</h1>
        <p className="otp-sub">Sent to <span>+91 {phoneNumber}</span></p>
      </div>
      <div className="login-form-card">
        <label className="ig-label" style={{ textAlign: 'center', display: 'block' }}>ENTER 6-DIGIT CODE</label>

        {backendOtp && (
          <div style={{
            textAlign: 'center', padding: '8px 16px', marginBottom: 12,
            background: 'rgba(110,86,255,0.12)', borderRadius: 10, fontSize: 13,
            color: 'var(--purple-light)', fontWeight: 600,
          }}>
            Dev OTP: {backendOtp}
          </div>
        )}

        <form onSubmit={handleVerifyOtp}>
          <div className="otp-boxes">
            {otp.map((digit, i) => (
              <input
                key={i}
                ref={el => otpRefs.current[i] = el}
                type="tel"
                maxLength="1"
                className={`otp-box ${digit ? 'filled' : ''}`}
                value={digit}
                onChange={(e) => handleOtpChange(i, e.target.value)}
                onKeyDown={(e) => handleOtpKeyDown(i, e)}
                autoFocus={i === 0}
              />
            ))}
          </div>

          <div className="otp-timer">
            {otpTimer > 0 ? `0:${otpTimer < 10 ? '0' : ''}${otpTimer}` : 'Expired'}
          </div>

          <button
            type="submit"
            className={`btn btn-primary btn-block login-submit ${loading ? 'btn-loading' : ''}`}
            disabled={loading}
          >
            {loading ? 'Verifying...' : 'Verify & Continue →'}
          </button>
        </form>

        <p className="otp-resend">
          Didn't receive? <span onClick={() => { setOtp(['', '', '', '', '', '']); handleSendOtp(); }}>Resend OTP</span>
        </p>

        <div className="otp-note">
          <div className="otp-note-dot" />
          <p>Your number is never shared with anyone. We use it only for secure login.</p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
