import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useAlert } from '../context/AlertContext';
import { ArrowLeft, CreditCard, Check, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import './WalletPage.css';

const PAYMENT_METHODS = [
  { id: 'paytm', name: 'Paytm', desc: 'Pay via Paytm wallet or UPI', icon: '₱', iconClass: 'pm-paytm' },
  { id: 'phonepe', name: 'PhonePe', desc: 'Pay via PhonePe UPI', icon: '₽', iconClass: 'pm-phonepe' },
  { id: 'card', name: 'Credit / Debit Card', desc: 'Visa, Mastercard, RuPay', icon: '💳', iconClass: 'pm-card' },
  { id: 'upi', name: 'Other UPI', desc: 'Google Pay, BHIM, etc.', icon: 'U', iconClass: 'pm-upi' },
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
  const [selectedAmount, setSelectedAmount] = useState(0);
  const [customAmount, setCustomAmount] = useState('');
  const [selectedMethod, setSelectedMethod] = useState('');
  const [processing, setProcessing] = useState(false);

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
    setSelectedAmount(amount);
    setCustomAmount(amount > 0 ? String(amount) : '');
    setSelectedMethod('');
    setShowPaymentSheet(true);
  };

  const closePaymentSheet = () => {
    setShowPaymentSheet(false);
    setSelectedMethod('');
    setCustomAmount('');
    setProcessing(false);
  };

  const handleConfirmPayment = async () => {
    const amount = parseInt(customAmount) || selectedAmount;
    if (!amount || amount <= 0) {
      showAlert('Please enter a valid amount', 'error');
      return;
    }
    if (!selectedMethod) {
      showAlert('Please select a payment method', 'error');
      return;
    }

    setProcessing(true);
    try {
      if (paymentMode === 'add') {
        const updatedUser = await api.addFunds(amount);
        const methodName = PAYMENT_METHODS.find(m => m.id === selectedMethod)?.name || 'wallet';
        showAlert(`₹${amount} added via ${methodName}!`, 'success');
        if (setUser) setUser(updatedUser);
      } else {
        const updatedUser = await api.withdrawFunds(amount);
        const methodName = PAYMENT_METHODS.find(m => m.id === selectedMethod)?.name || 'wallet';
        showAlert(`₹${amount} withdrawn to ${methodName}!`, 'success');
        if (setUser) setUser(updatedUser);
      }
      fetchWallet();
      closePaymentSheet();
    } catch (err) {
      showAlert(err.message || `Failed to ${paymentMode === 'add' ? 'add money' : 'withdraw'}`, 'error');
      setProcessing(false);
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
            wallet.transactions.slice(0, 5).map((t, i) => (
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

      {/* Payment Method Bottom Sheet */}
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

            {/* Payment Methods */}
            <div className="payment-methods-list">
              {PAYMENT_METHODS.map(method => (
                <div
                  key={method.id}
                  className={`payment-method-item ${selectedMethod === method.id ? 'selected' : ''}`}
                  onClick={() => setSelectedMethod(method.id)}
                >
                  <div className={`payment-method-icon ${method.iconClass}`}>
                    {method.id === 'card' ? <CreditCard size={22} /> : method.icon}
                  </div>
                  <div className="payment-method-info">
                    <div className="payment-method-name">{method.name}</div>
                    <div className="payment-method-desc">{method.desc}</div>
                  </div>
                  <div className="payment-method-check">
                    {selectedMethod === method.id && <Check size={14} />}
                  </div>
                </div>
              ))}
            </div>

            <button
              className="payment-confirm-btn"
              disabled={processing || !selectedMethod || !(parseInt(customAmount) > 0)}
              onClick={handleConfirmPayment}
            >
              {processing
                ? 'Processing...'
                : `${paymentMode === 'add' ? 'Add' : 'Withdraw'} ₹${customAmount || '0'}`
              }
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default WalletPage;
