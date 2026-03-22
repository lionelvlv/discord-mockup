import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../features/auth/useAuth';
import { PRESET_AVATARS } from '../../lib/constants';
import './signup.css';

const SignupPage: React.FC = () => {
  const { signup } = useAuth();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [bio, setBio] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState(PRESET_AVATARS[0]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await signup(username, email, password, bio, selectedAvatar);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Signup failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="signup-page">
      <div className="signup-bg"></div>
      <div className="signup-container window-95">
        <div className="window-titlebar">
          <span>RetroChord - Create Account</span>
        </div>
        
        <div className="signup-content panel">
          <div className="signup-header">
            <div className="logo pixel-art">💾</div>
            <h1 className="pixel-font">JOIN RETROCHORD</h1>
          </div>

          <form onSubmit={handleSubmit} className="signup-form">
            <div className="form-group">
              <label htmlFor="username">USERNAME:</label>
              <input
                type="text"
                id="username"
                className="input-95"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                maxLength={20}
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <label htmlFor="email">EMAIL ADDRESS:</label>
              <input
                type="email"
                id="email"
                className="input-95"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
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
                minLength={6}
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <label htmlFor="bio">BIO (OPTIONAL):</label>
              <textarea
                id="bio"
                className="textarea-95"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                rows={3}
                maxLength={100}
                disabled={loading}
                placeholder="Tell us about yourself..."
              />
            </div>

            <div className="form-group">
              <label>SELECT AVATAR:</label>
              <div className="avatar-grid">
                {PRESET_AVATARS.map((avatar) => (
                  <button
                    key={avatar}
                    type="button"
                    className={`avatar-option ${selectedAvatar === avatar ? 'selected' : ''}`}
                    onClick={() => setSelectedAvatar(avatar)}
                    disabled={loading}
                  >
                    {avatar}
                  </button>
                ))}
              </div>
            </div>

            {error && (
              <div className="error-box panel-inset">
                <span>⚠️ {error}</span>
              </div>
            )}

            <button type="submit" className="button-95 signup-button" disabled={loading}>
              {loading ? 'CREATING ACCOUNT...' : 'CREATE ACCOUNT'}
            </button>
          </form>

          <div className="signup-links">
            <span>Already have an account?</span>
            <Link to="/login" className="link-95">Login here</Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SignupPage;
