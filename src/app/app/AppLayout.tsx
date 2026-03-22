import React, { useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../../features/auth/useAuth';
import { VoiceProvider, useVoice } from '../../features/voice/VoiceContext';
import LeftRail from '../../components/layout/LeftRail';
import RightRail from '../../components/layout/RightRail';
import UserPanel from '../../components/layout/UserPanel';
import VoicePanel from '../../components/voice/VoicePanel';
import ChannelPage from './channel/ChannelPage';
import VoiceChannelPage from './voice/VoiceChannelPage';
import DMPage from './dm/DMPage';
import ProfileSettings from './settings/ProfileSettings';
import './App.css';

type MobileTab = 'channels' | 'chat' | 'members' | 'call';

const AppInner: React.FC = () => {
  const { user } = useAuth();
  const { activeVoice, leaveVoice, isExpanded, setExpanded, localIsSpeaking } = useVoice();
  const [mobileTab, setMobileTab] = useState<MobileTab>('chat');

  if (!user) return <Navigate to="/login" />;

  const handleNavigate = () => setMobileTab('chat');

  // When joining a call on mobile, switch to the call tab automatically
  const handleJoinVoice = () => setMobileTab('call');

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
          <Route path="/voice/:channelId" element={<VoiceChannelPage onJoin={handleJoinVoice} />} />
          <Route path="/dm/:userId" element={<DMPage />} />
          <Route path="/settings/profile" element={<ProfileSettings />} />
        </Routes>

        {/* Desktop: persistent overlay at bottom of main section.
            On mobile this whole overlay is hidden by CSS — the mobile-call-section
            below renders a single VoicePanel for mobile. */}
        {activeVoice && (
          <div className={`voice-call-overlay ${isExpanded ? 'expanded' : 'collapsed'}`}>
            {/* Title bar — only visible when expanded */}
            <div className="voice-call-expanded panel" style={{ display: isExpanded ? 'flex' : 'none' }}>
              <div className="voice-call-expanded-header panel-outset">
                <span className="pixel-font" style={{ fontSize: '8px' }}>
                  🔊 {activeVoice.channelName.toUpperCase()}
                </span>
                <button
                  className="button-95 voice-minimize-btn"
                  onClick={() => setExpanded(false)}
                  title="Minimise"
                >─</button>
              </div>
            </div>

            {/* Desktop VoicePanel — always mounted, zero-size when collapsed.
                Hidden on mobile via CSS so only one VoicePanel instance runs. */}
            <div className={`${isExpanded ? 'voice-panel-mount-expanded' : 'voice-panel-mount-collapsed'} desktop-voice-panel`}>
              <VoicePanel
                channelId={activeVoice.channelId}
                channelName={activeVoice.channelName}
                onLeave={leaveVoice}
              />
            </div>

            {/* Collapsed status bar — tapping on mobile switches to call tab */}
            <div
              className="voice-call-bar panel-outset"
              style={{ display: isExpanded ? 'none' : 'flex' }}
              onClick={() => { setExpanded(true); setMobileTab('call'); }}
            >
              <span className={`voice-call-bar-icon ${localIsSpeaking ? 'speaking-pulse' : ''}`}>🔊</span>
              <span className="voice-call-bar-name">{activeVoice.channelName}</span>
              <span className="voice-call-bar-status" style={{ color: localIsSpeaking ? 'var(--status-online)' : undefined }}>
                {localIsSpeaking ? '● Speaking' : 'Voice Connected'}
              </span>
              <button
                className="button-95 voice-leave-btn"
                onClick={(e) => { e.stopPropagation(); leaveVoice(); }}
                title="Leave voice"
              >✕</button>
            </div>
          </div>
        )}
      </div>

      {/* Mobile: full-screen call view — shown when call tab is active */}
      {activeVoice && (
        <div className="mobile-call-section">
          {/* On mobile the VoicePanel is rendered here in its own full section.
              On desktop this section is hidden (display:none) and the overlay above is used. */}
          <VoicePanel
            channelId={activeVoice.channelId}
            channelName={activeVoice.channelName}
            onLeave={() => { leaveVoice(); setMobileTab('chat'); }}
          />
        </div>
      )}

      <div className="right-section">
        <RightRail />
      </div>

      {/* Mobile bottom nav */}
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
        {/* Call tab — only shown when in a voice call */}
        {activeVoice && (
          <button
            className={`mobile-nav-btn ${mobileTab === 'call' ? 'active' : ''} call-active ${localIsSpeaking ? 'call-speaking' : ''}`}
            onClick={() => setMobileTab('call')}
            aria-label="Voice call"
          >
            <span>📞</span>
            <span className="mobile-nav-label">Call</span>
          </button>
        )}
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

const AppLayout: React.FC = () => (
  <VoiceProvider>
    <AppInner />
  </VoiceProvider>
);

export default AppLayout;
