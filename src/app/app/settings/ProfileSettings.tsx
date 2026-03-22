import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../features/auth/useAuth';
import { PRESET_AVATARS } from '../../../lib/constants';
import Avatar from '../../../components/ui/Avatar';
import './settings.css';

const CLOUD_NAME   = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME as string | undefined;
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET as string | undefined;

// Max 4 MB for profile pictures
const MAX_AVATAR_BYTES = 4 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/avif']);

async function uploadAvatarToCloudinary(file: File): Promise<string> {
  if (!CLOUD_NAME || !UPLOAD_PRESET) {
    throw new Error('Cloudinary is not configured. Add VITE_CLOUDINARY_CLOUD_NAME and VITE_CLOUDINARY_UPLOAD_PRESET to your .env.');
  }
  if (file.size > MAX_AVATAR_BYTES) throw new Error('Image must be under 4 MB.');
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) throw new Error('Only image files are allowed for profile pictures.');

  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', UPLOAD_PRESET);
  formData.append('tags', 'retrochord_avatar');
  // Tell Cloudinary to crop to a square so avatars always look good
  formData.append('transformation', 'c_fill,w_200,h_200,g_face');

  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message ?? `Upload failed (${res.status})`);
  }
  const data = await res.json();
  return data.secure_url as string;
}

const ProfileSettings: React.FC = () => {
  const { user, updateProfile } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [username, setUsername]         = useState(user?.username || '');
  const [bio, setBio]                   = useState(user?.bio || '');
  const [selectedAvatar, setSelectedAvatar] = useState(user?.avatarUrl || PRESET_AVATARS[0]);
  const [uploading, setUploading]       = useState(false);
  const [uploadError, setUploadError]   = useState<string | null>(null);
  const [saved, setSaved]               = useState(false);
  const [saving, setSaving]             = useState(false);

  // Preview an image file before uploading
  const [localPreview, setLocalPreview] = useState<string | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = ''; // reset so same file can be re-selected

    setUploadError(null);

    // Validate client-side first
    if (file.size > MAX_AVATAR_BYTES) { setUploadError('Image must be under 4 MB.'); return; }
    if (!ALLOWED_IMAGE_TYPES.has(file.type)) { setUploadError('Only images are allowed.'); return; }

    // Show local preview immediately
    const preview = URL.createObjectURL(file);
    setLocalPreview(preview);
    setSelectedAvatar(''); // clear while uploading

    setUploading(true);
    try {
      const url = await uploadAvatarToCloudinary(file);
      setSelectedAvatar(url);
      setLocalPreview(null);
      URL.revokeObjectURL(preview);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed');
      setSelectedAvatar(user?.avatarUrl || PRESET_AVATARS[0]);
      setLocalPreview(null);
      URL.revokeObjectURL(preview);
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (uploading) return;
    setSaving(true);
    try {
      await updateProfile({ username, bio, avatarUrl: selectedAvatar });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  // Current displayed avatar: local preview during upload, then selected
  const displayAvatar = localPreview || selectedAvatar;
  const isUrl = displayAvatar?.startsWith('http');

  return (
    <div className="settings-page">
      <div className="settings-header panel-outset">
        <h1 className="pixel-font">PROFILE SETTINGS</h1>
      </div>

      <div className="settings-content">
        <form onSubmit={handleSave} className="settings-form">

          {/* Avatar section */}
          <div className="form-section panel">
            <h2 className="section-title">AVATAR</h2>

            <div className="avatar-preview-row">
              {/* Large preview */}
              <div className="avatar-preview-large">
                <Avatar src={displayAvatar} size={80} />
                {uploading && <div className="avatar-uploading-label">Uploading…</div>}
              </div>

              <div className="avatar-preview-actions">
                <p className="avatar-upload-hint">
                  Upload a custom image (JPG, PNG, GIF, WebP — max 4 MB)
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={handleFileChange}
                />
                <button
                  type="button"
                  className="button-95"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                >
                  {uploading ? '⏳ Uploading…' : '📁 Upload Image'}
                </button>
                {uploadError && <div className="avatar-upload-error">{uploadError}</div>}
              </div>
            </div>

            <div className="avatar-section-divider">— or choose a preset emoji —</div>

            <div className="avatar-grid">
              {PRESET_AVATARS.map((avatar) => (
                <button
                  key={avatar}
                  type="button"
                  className={`avatar-option ${selectedAvatar === avatar ? 'selected' : ''}`}
                  onClick={() => { setSelectedAvatar(avatar); setLocalPreview(null); }}
                >
                  {avatar}
                </button>
              ))}
            </div>
          </div>

          {/* Profile info */}
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
            <button type="submit" className="button-95 save-button" disabled={uploading || saving}>
              {saving ? 'SAVING…' : 'SAVE CHANGES'}
            </button>
            <button type="button" className="button-95" onClick={() => navigate(-1)}>
              CANCEL
            </button>
          </div>

          {saved && (
            <div className="save-success panel-inset">✓ Profile updated!</div>
          )}
        </form>
      </div>
    </div>
  );
};

export default ProfileSettings;
