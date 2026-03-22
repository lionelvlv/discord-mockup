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

type MobileTab = 'channels' | 'chat' | 'members';

// Inner layout has access to VoiceContext
const AppInner: React.FC = () => {
  const { user } = useAuth();
  const { activeVoice, leaveVoice, isExpanded, setExpanded, localIsSpeaking } = useVoice();
  const [mobileTab, setMobileTab] = useState<MobileTab>('chat');

  if (!user) return <Navigate to="/login" />;

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

        {/* Persistent voice call panel — renders outside Routes so navigation
            doesn't unmount it. Collapsed to a status bar when minimised.
            CRITICAL: VoicePanel must ALWAYS be mounted while activeVoice is set.
            Never conditionally render VoicePanel inside isExpanded — that would
            unmount it when collapsing, triggering the cleanup effect and leaving
            the voice channel. Use CSS display:none to hide the expanded view. */}
        {activeVoice && (
          <div className={`voice-call-overlay ${isExpanded ? 'expanded' : 'collapsed'}`}>
            {/* Expanded header — only visible when expanded */}
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
              <div className="voice-call-expanded-body">
                {/* VoicePanel is ALWAYS rendered here — never conditionally.
                    Unmounting it would trigger cleanup and leave the channel. */}
              </div>
            </div>

            {/* VoicePanel always mounted — positioned absolutely when collapsed
                so it stays in the DOM but takes no visible space */}
            <div className={isExpanded ? 'voice-panel-mount-expanded' : 'voice-panel-mount-collapsed'}>
              <VoicePanel
                channelId={activeVoice.channelId}
                channelName={activeVoice.channelName}
                onLeave={leaveVoice}
              />
            </div>

            {/* Collapsed status bar — only visible when collapsed */}
            <div
              className="voice-call-bar panel-outset"
              style={{ display: isExpanded ? 'none' : 'flex' }}
              onClick={() => setExpanded(true)}
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

const AppLayout: React.FC = () => (
  <VoiceProvider>
    <AppInner />
  </VoiceProvider>
);

export default AppLayout;
