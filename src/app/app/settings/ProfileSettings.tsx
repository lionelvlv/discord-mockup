import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../features/auth/useAuth';
import { PRESET_AVATARS } from '../../../lib/constants';
import Avatar from '../../../components/ui/Avatar';
import './settings.css';

const ProfileSettings: React.FC = () => {
  const { user, updateProfile } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState(user?.username || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [selectedAvatar, setSelectedAvatar] = useState(user?.avatarUrl || PRESET_AVATARS[0]);
  const [saved, setSaved] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    
    updateProfile({
      username,
      bio,
      avatarUrl: selectedAvatar
    });

    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleCancel = () => {
    navigate(-1);
  };

  return (
    <div className="settings-page">
      <div className="settings-header panel-outset">
        <h1 className="pixel-font">PROFILE SETTINGS</h1>
      </div>

      <div className="settings-content">
        <form onSubmit={handleSave} className="settings-form">
          <div className="form-section panel">
            <h2 className="section-title">AVATAR</h2>
            <div className="current-avatar">
              <Avatar src={selectedAvatar} size={64} />
            </div>
            <div className="avatar-grid">
              {PRESET_AVATARS.map((avatar) => (
                <button
                  key={avatar}
                  type="button"
                  className={`avatar-option ${selectedAvatar === avatar ? 'selected' : ''}`}
                  onClick={() => setSelectedAvatar(avatar)}
                >
                  {avatar}
                </button>
              ))}
            </div>
          </div>

          <div className="form-section panel">
            <h2 className="section-title">PROFILE INFO</h2>
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
              />
            </div>

            <div className="form-group">
              <label htmlFor="bio">BIO:</label>
              <textarea
                id="bio"
                className="textarea-95"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                rows={4}
                maxLength={100}
                placeholder="Tell us about yourself..."
              />
            </div>
          </div>

          <div className="form-actions">
            <button type="submit" className="button-95 save-button">
              SAVE CHANGES
            </button>
            <button type="button" className="button-95" onClick={handleCancel}>
              CANCEL
            </button>
          </div>

          {saved && (
            <div className="save-success panel-inset">
              ✓ Profile updated successfully!
            </div>
          )}
        </form>
      </div>
    </div>
  );
};

export default ProfileSettings;
