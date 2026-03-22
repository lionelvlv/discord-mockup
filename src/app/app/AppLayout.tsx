import React, { useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../../features/auth/useAuth';
import { VoiceProvider, useVoice } from '../../features/voice/VoiceContext';
import LeftRail from '../../components/layout/LeftRail';
import RightRail from '../../components/layout/RightRail';
import UserPanel from '../../components/layout/UserPanel';
import VoicePanel from '../../components/voice/VoicePanel';
import VoiceMiniPanel from '../../components/voice/VoiceMiniPanel';
import ChannelPage from './channel/ChannelPage';
import VoiceChannelPage from './voice/VoiceChannelPage';
import DMPage from './dm/DMPage';
import ProfileSettings from './settings/ProfileSettings';
import './App.css';

type MobileTab = 'channels' | 'chat' | 'members' | 'call';

const AppInner: React.FC = () => {
  const { user } = useAuth();
  const { activeVoice, leaveVoice, isExpanded, setExpanded } = useVoice();
  const [mobileTab, setMobileTab] = useState<MobileTab>('chat');

  if (!user) return <Navigate to="/login" />;

  // When a voice channel is joined and expanded, it takes over the full main area.
  // When minimised (isExpanded=false), text/DM routes render normally and
  // VoiceMiniPanel appears at the bottom of the left rail.
  const showFullscreenCall = !!activeVoice && isExpanded;

  const handleNavigate = () => setMobileTab('chat');
  const handleJoinVoice = () => setMobileTab('call');

  return (
    <div className="app-layout" data-mobile-tab={mobileTab}>
      {/* ── Left section: channels + mini voice panel + user ───────────────── */}
      <div className="left-section">
        <LeftRail onNavigate={handleNavigate} />
        {/* Mini panel shows when in a call but not viewing it full-screen */}
        {activeVoice && !isExpanded && <VoiceMiniPanel />}
        <UserPanel user={user} />
      </div>

      {/* ── Main section ────────────────────────────────────────────────────── */}
      <div className="main-section">
        {/* Full-screen call — hides text content entirely */}
        {showFullscreenCall && (
          <div className="voice-fullscreen">
            {/* Title bar */}
            <div className="voice-fullscreen-header panel-outset">
              <span className="pixel-font" style={{ fontSize: '8px' }}>
                🔊 {activeVoice.channelName.toUpperCase()}
              </span>
              <button
                className="button-95 voice-minimize-btn"
                onClick={() => setExpanded(false)}
                title="Minimise — return to chat"
              >─</button>
            </div>
            {/* VoicePanel fills the rest */}
            <div className="voice-fullscreen-body">
              <VoicePanel
                channelId={activeVoice.channelId}
                channelName={activeVoice.channelName}
                onLeave={leaveVoice}
              />
            </div>
          </div>
        )}

        {/* Text/DM/Settings routes — shown when not full-screen */}
        <div style={{ display: showFullscreenCall ? 'none' : 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
          <Routes>
            <Route path="/" element={<Navigate to="/app/channel/general" />} />
            <Route path="/channel/:channelId" element={<ChannelPage />} />
            <Route path="/voice/:channelId" element={<VoiceChannelPage onJoin={handleJoinVoice} />} />
            <Route path="/dm/:userId" element={<DMPage />} />
            <Route path="/settings/profile" element={<ProfileSettings />} />
          </Routes>
        </div>

        {/* When VoicePanel is minimised it must stay mounted so WebRTC keeps running.
            Render it hidden (zero size, pointer-events off) so audio elements still play. */}
        {activeVoice && !isExpanded && (
          <div className="voice-hidden-mount" aria-hidden="true">
            <VoicePanel
              channelId={activeVoice.channelId}
              channelName={activeVoice.channelName}
              onLeave={leaveVoice}
            />
          </div>
        )}
      </div>

      {/* ── Right section ────────────────────────────────────────────────────── */}
      <div className="right-section">
        <RightRail />
      </div>

      {/* ── Mobile call tab — full screen without a second WebRTC instance ──── */}
      {activeVoice && (
        <div className="mobile-call-section">
          {/* Show the full-screen call by toggling the hidden mount to be visible.
              No second VoicePanel — the hidden-mount instance provides all WebRTC
              and audio. On mobile the call tab just makes it visible. */}
        </div>
      )}

      {/* ── Mobile bottom navigation ────────────────────────────────────────── */}
      <nav className="mobile-nav" aria-label="App navigation">
        <button className={`mobile-nav-btn ${mobileTab === 'channels' ? 'active' : ''}`} onClick={() => setMobileTab('channels')} aria-label="Channels">
          <span>💬</span><span className="mobile-nav-label">Channels</span>
        </button>
        <button className={`mobile-nav-btn ${mobileTab === 'chat' ? 'active' : ''}`} onClick={() => setMobileTab('chat')} aria-label="Chat">
          <span>🏠</span><span className="mobile-nav-label">Chat</span>
        </button>
        {activeVoice && (
          <button className={`mobile-nav-btn call-active ${mobileTab === 'call' ? 'active' : ''}`} onClick={() => setMobileTab('call')} aria-label="Voice call">
            <span>📞</span><span className="mobile-nav-label">Call</span>
          </button>
        )}
        <button className={`mobile-nav-btn ${mobileTab === 'members' ? 'active' : ''}`} onClick={() => setMobileTab('members')} aria-label="Members">
          <span>👥</span><span className="mobile-nav-label">Members</span>
        </button>
      </nav>
    </div>
  );
};

const AppLayout: React.FC = () => (
  <VoiceProvider>
    <AppInner />
  </VoiceProvider>
);

export default AppLayout;
