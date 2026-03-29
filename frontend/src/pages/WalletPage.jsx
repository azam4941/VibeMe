import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useAlert } from '../context/AlertContext';
import { ArrowLeft, CreditCard, Check, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import './WalletPage.css';

const PAYMENT_METHODS = [
  { id: 'razorpay', name: 'Pay Online', desc: 'UPI, Cards, Net Banking via Razorpay', icon: '💳', iconClass: 'pm-card' },
  { id: 'wallet', name: 'Wallet Balance', desc: 'Use existing wallet balance', icon: '💰', iconClass: 'pm-upi' },
];

const WalletPage = () => {
  const navigate = useNavigate();
  const { user, setUser } = useAuth();
  const { showAlert } = useAlert();
  const [wallet, setWallet] = useState({
    balance: 0,
    totalEarnings: 0,
    totalSpent: 0,
    transactions: []
  });
  const [loading, setLoading] = useState(true);

  // Payment sheet state
  const [showPaymentSheet, setShowPaymentSheet] = useState(false);
  const [paymentMode, setPaymentMode] = useState('add'); // 'add' or 'withdraw'
  const [customAmount, setCustomAmount] = useState('');
  const [selectedMethod, setSelectedMethod] = useState('');
  const [processing, setProcessing] = useState(false);
  const [upiId, setUpiId] = useState('');

  const fetchWallet = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.getWallet();
      setWallet(data);
    } catch (err) {
      showAlert(err.message || 'Failed to fetch wallet data', 'error');
    } finally {
      setLoading(false);
    }
  }, [showAlert]);

  useEffect(() => {
    fetchWallet();
  }, [fetchWallet]);

  const openPaymentSheet = (mode, amount = 0) => {
    setPaymentMode(mode);
    setCustomAmount(amount > 0 ? String(amount) : '');
    setSelectedMethod(mode === 'add' ? 'razorpay' : 'wallet');
    setUpiId('');
    setShowPaymentSheet(true);
  };

  const closePaymentSheet = () => {
    setShowPaymentSheet(false);
    setSelectedMethod('');
    setCustomAmount('');
    setProcessing(false);
    setUpiId('');
  };

  // Razorpay Add Money flow
  const handleRazorpayPayment = async (amount) => {
    try {
      setProcessing(true);

      // Step 1: Create order from backend
      const orderData = await api.request('/payments/create-order', {
        method: 'POST',
        body: JSON.stringify({ amount }),
      });

      // Step 2: Real Razorpay checkout
      if (typeof window.Razorpay === 'undefined') {
        showAlert('Payment gateway loading. Please try again.', 'error');
        setProcessing(false);
        return;
      }

      const options = {
        key: orderData.keyId,
        amount: amount * 100,
        currency: 'INR',
        name: 'VibeMe',
        description: 'Wallet Top-up',
        order_id: orderData.orderId,
        prefill: {
          contact: user?.phoneNumber || '',
        },
        theme: { color: '#534AB7' },
        handler: async (response) => {
          try {
            const result = await api.request('/payments/verify', {
              method: 'POST',
              body: JSON.stringify({
                razorpayOrderId: response.razorpay_order_id,
                razorpayPaymentId: response.razorpay_payment_id,
                razorpaySignature: response.razorpay_signature,
                amount,
              }),
            });

            if (result.success) {
              showAlert(`₹${amount} added successfully! 🎉`, 'success');
              if (setUser && result.user) setUser(result.user);
              fetchWallet();
              closePaymentSheet();
            }
          } catch (err) {
            showAlert('Payment verification failed: ' + err.message, 'error');
          }
        },
        modal: {
          ondismiss: () => {
            showAlert('Payment cancelled', 'info');
            setProcessing(false);
          },
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (err) {
      showAlert('Failed to initiate payment: ' + err.message, 'error');
    } finally {
      setProcessing(false);
    }
  };

  // Withdraw flow
  const handleWithdraw = async (amount) => {
    try {
      setProcessing(true);

      const result = await api.request('/payments/withdraw', {
        method: 'POST',
        body: JSON.stringify({ amount, upiId: upiId || undefined }),
      });

      if (result.success) {
        showAlert(`₹${amount} withdrawal initiated! Will be credited in 2-3 hours.`, 'success');
        if (setUser && result.user) setUser(result.user);
        fetchWallet();
        closePaymentSheet();
      }
    } catch (err) {
      showAlert(err.message || 'Withdrawal failed', 'error');
    } finally {
      setProcessing(false);
    }
  };

  const handleConfirmPayment = async () => {
    const amount = parseInt(customAmount);
    if (!amount || amount <= 0) {
      showAlert('Please enter a valid amount', 'error');
      return;
    }

    if (paymentMode === 'add') {
      await handleRazorpayPayment(amount);
    } else {
      await handleWithdraw(amount);
    }
  };

  const balance = wallet.balance || 0;
  const spent = wallet.totalSpent || 0;

  if (loading) return <div className="page" style={{display:'flex', alignItems:'center', justifyContent:'center'}}><div className="spinner"></div></div>;

  return (
    <div className="wallet-page page">
      <div className="wallet-header dark-header">
        <div className="wh-top-row">
           <button className="back-btn" onClick={() => navigate('/profile')}><ArrowLeft size={20} /></button>
           <h2 className="wh-title">My Wallet</h2>
           <span className="wh-history" onClick={() => showAlert('History coming soon!', 'info')}>History →</span>
        </div>
        <div className="wallet-card">
          <div className="wc-label">Available Balance</div>
          <div className="wc-balance">₹{balance.toFixed(2)}</div>
          <div className="wc-frozen">💰 Total Spent: ₹{spent}</div>
          <div className="wc-btns">
            <div className="wcb-add" onClick={() => openPaymentSheet('add', 500)}>+ Add Money</div>
            <div className="wcb-withdraw" onClick={() => openPaymentSheet('withdraw', 100)}>Withdraw</div>
          </div>
          <div className="quick-add-row">
            {[100, 250, 500, 1000].map(amt => (
              <div key={amt} className="qa" onClick={() => openPaymentSheet('add', amt)}>+₹{amt}</div>
            ))}
          </div>
        </div>
      </div>

      <div className="wallet-body">
        <div className="section-title">RECENT TRANSACTIONS</div>
        <div className="txn-list card">
          {wallet.transactions && wallet.transactions.length > 0 ? (
            wallet.transactions.slice(0, 10).map((t, i) => (
              <div key={i} className="txn">
                <div className={`txn-icon ${t.type === 'credit' ? 'ti-green' : 'ti-red'}`}>
                  {t.type === 'credit' ? '➕' : '➖'}
                </div>
                <div className="txn-meta">
                  <div className="txn-title">{t.description}</div>
                  <div className="txn-sub">{new Date(t.createdAt).toLocaleDateString()}</div>
                </div>
                <div className={`txn-amount ${t.type === 'credit' ? 'txn-plus' : 'txn-minus'}`}>
                  {t.type === 'credit' ? '+' : '−'}₹{t.amount}
                </div>
              </div>
            ))
          ) : (
            <div className="txn" style={{justifyContent:'center', color:'var(--text3)'}}>No transactions yet</div>
          )}
        </div>

        <div className="section-title" style={{ marginTop: '16px' }}>RENT MODE STATUS</div>
        <div className="txn-list card">
          <div className="txn">
            <div className="txn-icon ti-green">{user?.rentMode ? '🟢' : '🔴'}</div>
            <div className="txn-meta">
              <div className="txn-title">Rent Mode is {user?.rentMode ? 'Active' : 'Off'}</div>
              <div className="txn-sub">₹{user?.pricePerMinute || 0}/min</div>
            </div>
            <div className="txn-amount txn-plus">{user?.rentMode ? 'LIVE' : 'OFF'}</div>
          </div>
        </div>
      </div>

      {/* Payment Bottom Sheet */}
      {showPaymentSheet && (
        <div className="payment-overlay" onClick={closePaymentSheet}>
          <div className="payment-sheet" onClick={e => e.stopPropagation()}>
            <div className="payment-sheet-header">
              <div className="payment-sheet-title">
                {paymentMode === 'add' ? 'Add Money' : 'Withdraw Money'}
              </div>
              <button className="payment-sheet-close" onClick={closePaymentSheet}>
                <X size={20} />
              </button>
            </div>

            {/* Amount Input */}
            <div className="custom-amount-section">
              <div className="custom-amount-input-wrap">
                <span className="custom-amount-prefix">₹</span>
                <input
                  type="number"
                  className="custom-amount-input"
                  placeholder="Enter amount"
                  value={customAmount}
                  onChange={(e) => setCustomAmount(e.target.value)}
                  min="1"
                />
              </div>
            </div>

            {/* Quick Amount Buttons */}
            <div className="quick-add-row" style={{ marginBottom: '16px' }}>
              {[100, 250, 500, 1000, 2000].map(amt => (
                <div
                  key={amt}
                  className="qa"
                  style={{
                    background: parseInt(customAmount) === amt ? 'var(--purple-pale)' : undefined,
                    borderColor: parseInt(customAmount) === amt ? 'var(--purple)' : undefined,
                    border: parseInt(customAmount) === amt ? '1.5px solid var(--purple)' : undefined,
                  }}
                  onClick={() => setCustomAmount(String(amt))}
                >
                  ₹{amt}
                </div>
              ))}
            </div>

            {/* UPI ID for withdrawal */}
            {paymentMode === 'withdraw' && (
              <div className="custom-amount-section" style={{ marginBottom: '12px' }}>
                <div className="custom-amount-input-wrap">
                  <span className="custom-amount-prefix" style={{ fontSize: '12px' }}>UPI</span>
                  <input
                    type="text"
                    className="custom-amount-input"
                    placeholder="Enter UPI ID (optional)"
                    value={upiId}
                    onChange={(e) => setUpiId(e.target.value)}
                    style={{ fontSize: '13px' }}
                  />
                </div>
              </div>
            )}

            <button
              className="payment-confirm-btn"
              disabled={processing || !(parseInt(customAmount) > 0)}
              onClick={handleConfirmPayment}
            >
              {processing
                ? 'Processing...'
                : `${paymentMode === 'add' ? 'Pay' : 'Withdraw'} ₹${customAmount || '0'}`
              }
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default WalletPage;
