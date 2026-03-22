import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import './forgot.css';

const ForgotPasswordPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  return (
    <div className="forgot-page">
      <div className="forgot-bg"></div>
      <div className="forgot-container window-95">
        <div className="window-titlebar">
          <span>RetroChord - Forgot Password</span>
        </div>
        
        <div className="forgot-content panel">
          <div className="forgot-header">
            <div className="logo pixel-art">🔑</div>
            <h1 className="pixel-font">RESET PASSWORD</h1>
          </div>

          {!submitted ? (
            <form onSubmit={handleSubmit} className="forgot-form">
              <p className="forgot-description">
                Enter your email address and we'll send you a reset link.
              </p>

              <div className="form-group">
                <label htmlFor="email">EMAIL ADDRESS:</label>
                <input
                  type="email"
                  id="email"
                  className="input-95"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <button type="submit" className="button-95 forgot-button">
                SEND RESET LINK
              </button>
            </form>
          ) : (
            <div className="success-message panel-inset">
              <div className="success-icon">✓</div>
              <p>
                If an account exists with <strong>{email}</strong>, you will receive
                a password reset link shortly.
              </p>
            </div>
          )}

          <div className="forgot-links">
            <Link to="/login" className="link-95">← Back to login</Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ForgotPasswordPage;
