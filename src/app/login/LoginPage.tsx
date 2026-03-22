import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../features/auth/useAuth';
import './login.css';

const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-bg"></div>
      <div className="login-container window-95">
        <div className="window-titlebar">
          <span>RetroChord - Login</span>
        </div>
        
        <div className="login-content panel">
          <div className="login-header">
            <div className="logo pixel-art">💾</div>
            <h1 className="pixel-font">RETROCHORD</h1>
            <p className="tagline">Connect to the past</p>
          </div>

          <form onSubmit={handleSubmit} className="login-form">
            <div className="form-group">
              <label htmlFor="email">EMAIL ADDRESS:</label>
              <input
                type="email"
                id="email"
                className="input-95"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <label htmlFor="password">PASSWORD:</label>
              <input
                type="password"
                id="password"
                className="input-95"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                disabled={loading}
              />
            </div>

            {error && (
              <div className="error-box panel-inset">
                <span>⚠️ {error}</span>
              </div>
            )}

            <button type="submit" className="button-95 login-button" disabled={loading}>
              {loading ? 'LOGGING IN...' : 'LOGIN'}
            </button>
          </form>

          <div className="login-links">
            <Link to="/forgot-password" className="link-95">Forgot password?</Link>
            <span className="separator">|</span>
            <Link to="/signup" className="link-95">Create account</Link>
          </div>

          <div className="demo-accounts panel-inset">
            <div className="pixel-font" style={{ marginBottom: '8px', fontSize: '7px' }}>DEMO ACCOUNTS:</div>
            <div className="demo-list">
              <div className="demo-item">
                <strong>RetroGamer42:</strong> retro@example.com / password123
              </div>
              <div className="demo-item">
                <strong>VaporwaveFan:</strong> vapor@example.com / password123
              </div>
            </div>
            <div style={{ marginTop: '8px', fontSize: '9px', color: 'var(--text-muted)' }}>
              💡 Open two browser windows to chat between accounts
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
