import React, { useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../../features/auth/useAuth';
import LeftRail from '../../components/layout/LeftRail';
import RightRail from '../../components/layout/RightRail';
import UserPanel from '../../components/layout/UserPanel';
import ChannelPage from './channel/ChannelPage';
import VoiceChannelPage from './voice/VoiceChannelPage';
import DMPage from './dm/DMPage';
import ProfileSettings from './settings/ProfileSettings';
import './App.css';

type MobileTab = 'channels' | 'chat' | 'members';

const AppLayout: React.FC = () => {
  const { user } = useAuth();
  const [mobileTab, setMobileTab] = useState<MobileTab>('chat');

  if (!user) {
    return <Navigate to="/login" />;
  }

  const handleNavigate = () => setMobileTab('chat');

  return (
    <div className="app-layout" data-mobile-tab={mobileTab}>
      <div className="left-section">
        <LeftRail onNavigate={handleNavigate} />
        <UserPanel user={user} />
      </div>

      <div className="main-section">
        <Routes>
          <Route path="/" element={<Navigate to="/app/channel/general" />} />
          <Route path="/channel/:channelId" element={<ChannelPage />} />
          <Route path="/voice/:channelId" element={<VoiceChannelPage />} />
          <Route path="/dm/:userId" element={<DMPage />} />
          <Route path="/settings/profile" element={<ProfileSettings />} />
        </Routes>
      </div>

      <div className="right-section">
        <RightRail />
      </div>

      <nav className="mobile-nav" aria-label="App navigation">
        <button
          className={`mobile-nav-btn ${mobileTab === 'channels' ? 'active' : ''}`}
          onClick={() => setMobileTab('channels')}
          aria-label="Channels"
        >
          <span>💬</span>
          <span className="mobile-nav-label">Channels</span>
        </button>
        <button
          className={`mobile-nav-btn ${mobileTab === 'chat' ? 'active' : ''}`}
          onClick={() => setMobileTab('chat')}
          aria-label="Chat"
        >
          <span>🏠</span>
          <span className="mobile-nav-label">Chat</span>
        </button>
        <button
          className={`mobile-nav-btn ${mobileTab === 'members' ? 'active' : ''}`}
          onClick={() => setMobileTab('members')}
          aria-label="Members"
        >
          <span>👥</span>
          <span className="mobile-nav-label">Members</span>
        </button>
      </nav>
    </div>
  );
};

export default AppLayout;
