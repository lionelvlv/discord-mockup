import React, { useState, useEffect } from 'react';
import { useAuth } from '../../features/auth/useAuth';
import {
  subscribeToCustomEmojis, deleteCustomEmoji, CustomEmoji
} from '../../features/customEmojis/api';
import {
  subscribeToServerSettings, updateServerSettings
} from '../../features/serverSettings/api';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { User } from '../../types/user';
import Avatar from '../ui/Avatar';
import './ServerSettings.css';

type Tab = 'general' | 'emojis' | 'members';

interface Props { onClose: () => void; }

const ServerSettings: React.FC<Props> = ({ onClose }) => {
  const { user: currentUser } = useAuth();
  const [tab, setTab] = useState<Tab>('general');
  const [serverName, setServerName]   = useState('RETROCHORD');
  const [saving, setSaving]           = useState(false);
  const [savedMsg, setSavedMsg]       = useState('');
  const [emojis, setEmojis]           = useState<CustomEmoji[]>([]);
  const [members, setMembers]         = useState<User[]>([]);

  useEffect(() => {
    const u1 = subscribeToServerSettings(s => setServerName(s.name));
    const u2 = subscribeToCustomEmojis(setEmojis);
    const u3 = onSnapshot(collection(db, 'users'), snap => {
      setMembers(snap.docs.map(d => ({ id: d.id, ...d.data() } as User)).filter(u => !u.isDeleted));
    });
    return () => { u1(); u2(); u3(); };
  }, []);

  const handleSaveName = async () => {
    if (!serverName.trim()) return;
    setSaving(true);
    await updateServerSettings({ name: serverName.trim() });
    setSaving(false);
    setSavedMsg('Saved!');
    setTimeout(() => setSavedMsg(''), 2000);
  };

  const handleDeleteEmoji = async (id: string) => {
    if (confirm('Delete this emoji?')) await deleteCustomEmoji(id);
  };

  // Group emojis by user
  const emojisByUser = emojis.reduce<Record<string, { username: string; emojis: CustomEmoji[] }>>((acc, e) => {
    if (!acc[e.uploadedBy]) acc[e.uploadedBy] = { username: e.username, emojis: [] };
    acc[e.uploadedBy].emojis.push(e);
    return acc;
  }, {});

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="server-settings-modal panel" onClick={e => e.stopPropagation()}>

        {/* Title bar */}
        <div className="server-settings-titlebar">
          <span className="pixel-font" style={{ fontSize: '8px', color: '#fff' }}>⚙️ SERVER SETTINGS</span>
          <button className="button-95 modal-close-btn" onClick={onClose}>✕</button>
        </div>

        {/* Sidebar + content */}
        <div className="server-settings-body">
          <nav className="server-settings-nav">
            <button className={`ss-nav-btn ${tab === 'general' ? 'active' : ''}`} onClick={() => setTab('general')}>📋 General</button>
            <button className={`ss-nav-btn ${tab === 'emojis'  ? 'active' : ''}`} onClick={() => setTab('emojis')}>😊 Emojis</button>
            <button className={`ss-nav-btn ${tab === 'members' ? 'active' : ''}`} onClick={() => setTab('members')}>👥 Members</button>
          </nav>

          <div className="server-settings-content">

            {tab === 'general' && (
              <div className="ss-section">
                <h2 className="ss-section-title">GENERAL</h2>
                <div className="form-group">
                  <label>SERVER NAME:</label>
                  <input
                    className="input-95"
                    value={serverName}
                    onChange={e => setServerName(e.target.value)}
                    maxLength={40}
                  />
                </div>
                <div className="ss-actions">
                  <button className="button-95" onClick={handleSaveName} disabled={saving}>
                    {saving ? 'Saving…' : 'Save'}
                  </button>
                  {savedMsg && <span className="ss-saved">{savedMsg}</span>}
                </div>
              </div>
            )}

            {tab === 'emojis' && (
              <div className="ss-section">
                <h2 className="ss-section-title">CUSTOM EMOJIS</h2>
                <p className="ss-hint">Each user can upload up to 10 custom emojis (max 256 KB each).</p>

                {Object.keys(emojisByUser).length === 0 && (
                  <div className="ss-empty">No custom emojis yet.</div>
                )}

                {Object.entries(emojisByUser).map(([uid, { username, emojis: ues }]) => (
                  <div key={uid} className="ss-emoji-user-group">
                    <div className="ss-emoji-user-label">
                      <strong>{username}</strong>
                      <span className="ss-hint-small">({ues.length}/10)</span>
                    </div>
                    <div className="ss-emoji-grid">
                      {ues.map(e => (
                        <div key={e.id} className="ss-emoji-item">
                          <img src={e.url} alt={e.name} className="ss-emoji-img" title={`:${e.name}:`} />
                          <div className="ss-emoji-name">:{e.name}:</div>
                          <button
                            className="ss-emoji-del button-95"
                            onClick={() => handleDeleteEmoji(e.id)}
                            title="Delete emoji"
                          >🗑️</button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {tab === 'members' && (
              <div className="ss-section">
                <h2 className="ss-section-title">MEMBERS ({members.length})</h2>
                <div className="ss-member-list">
                  {members.map(m => (
                    <div key={m.id} className="ss-member-row">
                      <Avatar src={m.avatarUrl} size={28} />
                      <div className="ss-member-info">
                        <span className="ss-member-name">{m.username}</span>
                        {m.isAdmin && <span className="ss-admin-badge">👑 Admin</span>}
                      </div>
                      <span className={`ss-presence ss-presence--${m.presence ?? 'offline'}`}>
                        {m.presence ?? 'offline'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ServerSettings;
