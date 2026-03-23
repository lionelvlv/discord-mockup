import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../../features/auth/useAuth';
import { VoiceProvider, useVoice } from '../../features/voice/VoiceContext';
import LeftRail from '../../components/layout/LeftRail';
import RightRail from '../../components/layout/RightRail';
import UserPanel from '../../components/layout/UserPanel';
import VoicePanel from '../../components/voice/VoicePanel';
import GlobalUnreadWatcher from '../../components/chat/GlobalUnreadWatcher';
import VoiceMiniPanel from '../../components/voice/VoiceMiniPanel';
import ChannelPage from './channel/ChannelPage';
import VoiceChannelPage from './voice/VoiceChannelPage';
import DMPage from './dm/DMPage';
import ProfileSettings from './settings/ProfileSettings';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../../config/firebase';
import './App.css';

type MobileTab = 'channels' | 'chat' | 'members' | 'call';

const AppInner: React.FC = () => {
  const { user } = useAuth();
  const { activeVoice, leaveVoice, isExpanded, setExpanded } = useVoice();
  const [mobileTab, setMobileTab] = useState<MobileTab>('chat');

  if (!user) return <Navigate to="/login" />;

  // Global unread watcher — invisible, fires on all channels/DMs

  // Navigating to any text channel/DM/settings minimises the full-screen call.
  // Mobile: also switch to chat tab so the call doesn't stay blocking.
  // Global unread watcher data
  const [watchChannels, setWatchChannels] = useState<{ id: string }[]>([]);
  const [watchDMs, setWatchDMs]           = useState<{ id: string; otherUserId: string }[]>([]);

  useEffect(() => {
    if (!user) return;
    const uid = user.id;
    const u1 = onSnapshot(collection(db, 'channels'), snap => {
      setWatchChannels(
        snap.docs.map(d => ({ id: d.id, ...d.data() } as any)).filter((c: any) => !c.isVoiceChannel)
      );
    });
    const u2 = onSnapshot(collection(db, 'directMessages'), snap => {
      setWatchDMs(
        snap.docs
          .map(d => ({ id: d.id, ...d.data() } as any))
          .filter((dm: any) => (dm.userA === uid || dm.userB === uid) && !dm.closedBy?.includes(uid))
          .map((dm: any) => ({ id: dm.id, otherUserId: dm.userA === uid ? dm.userB : dm.userA }))
      );
    });
    return () => { u1(); u2(); };
  }, [user?.id]);

  const handleNavigate = () => {
    if (activeVoice && isExpanded) setExpanded(false);
    setMobileTab('chat');
  };

  const handleJoinVoice = () => {
    setExpanded(true);
    setMobileTab('call');
  };

  // VoicePanel mode:
  //  "fullscreen" — desktop expanded / mobile call tab → position:absolute fills main area
  //  "mini"       — desktop minimised → 0×0 hidden, WebRTC/audio still running
  const isCallTab = mobileTab === 'call';
  const voiceMode = !activeVoice
    ? null
    : (isExpanded || isCallTab) ? 'fullscreen' : 'mini';

  return (
    <>
    <GlobalUnreadWatcher channels={watchChannels} dms={watchDMs} />
    <div className="app-layout" data-mobile-tab={mobileTab}>

      {/* ── Left rail ──────────────────────────────────────────────────────── */}
      <div className="left-section">
        <LeftRail onNavigate={handleNavigate} />
        {activeVoice && voiceMode === 'mini' && <VoiceMiniPanel />}
        <UserPanel user={user} onNavigate={handleNavigate} />
      </div>

      {/* ── Main section ───────────────────────────────────────────────────── */}
      <div className="main-section">

        {/* Single VoicePanel — always mounted while in a call.
            CSS class controls whether it's fullscreen or hidden (0×0).
            Never unmount it — that would leave the channel. */}
        {activeVoice && (
          <div className={`voice-panel-mount voice-panel-mount--${voiceMode}`}>
            {/* Titlebar: shown in fullscreen mode, or on mobile call tab (mini mode) */}
            {(voiceMode === 'fullscreen' || (voiceMode === 'mini' && isCallTab)) && (
              <div className="voice-fullscreen-header panel-outset">
                <span className="pixel-font" style={{ fontSize: '8px' }}>
                  🔊 {activeVoice.channelName.toUpperCase()}
                </span>
                <button
                  className="button-95 voice-minimize-btn"
                  onClick={() => { setExpanded(false); setMobileTab('chat'); }}
                  title="Return to chat"
                >─</button>
              </div>
            )}
            <div className="voice-panel-mount__body">
              <VoicePanel
                channelId={activeVoice.channelId}
                channelName={activeVoice.channelName}
                onLeave={() => { leaveVoice(); setMobileTab('chat'); }}
              />
            </div>
          </div>
        )}

        {/* Text/DM/Settings routes — always mounted, hidden behind fullscreen call */}
        <div className="main-routes" style={{ display: voiceMode === 'fullscreen' ? 'none' : 'flex' }}>
          <Routes>
            <Route path="/" element={<Navigate to="/app/channel/general" />} />
            <Route path="/channel/:channelId" element={<ChannelPage />} />
            <Route path="/voice/:channelId" element={<VoiceChannelPage onJoin={handleJoinVoice} />} />
            <Route path="/dm/:userId" element={<DMPage />} />
            <Route path="/settings/profile" element={<ProfileSettings />} />
          </Routes>
        </div>
      </div>

      {/* ── Right rail ─────────────────────────────────────────────────────── */}
      <div className="right-section">
        <RightRail onNavigate={handleNavigate} />
      </div>

      {/* ── Mobile bottom nav ──────────────────────────────────────────────── */}
      <nav className="mobile-nav" aria-label="App navigation">
        <button className={`mobile-nav-btn ${mobileTab === 'channels' ? 'active' : ''}`}
          onClick={() => { setMobileTab('channels'); if (activeVoice && isExpanded) setExpanded(false); }}
          aria-label="Channels">
          <span>💬</span><span className="mobile-nav-label">Channels</span>
        </button>
        <button className={`mobile-nav-btn ${mobileTab === 'chat' ? 'active' : ''}`}
          onClick={() => { setMobileTab('chat'); if (activeVoice && isExpanded) setExpanded(false); }}
          aria-label="Chat">
          <span>🏠</span><span className="mobile-nav-label">Chat</span>
        </button>
        {activeVoice && (
          <button className={`mobile-nav-btn call-active ${mobileTab === 'call' ? 'active' : ''}`}
            onClick={() => setMobileTab('call')}
            aria-label="Voice call">
            <span>📞</span><span className="mobile-nav-label">Call</span>
          </button>
        )}
        <button className={`mobile-nav-btn ${mobileTab === 'members' ? 'active' : ''}`}
          onClick={() => { setMobileTab('members'); if (activeVoice && isExpanded) setExpanded(false); }}
          aria-label="Members">
          <span>👥</span><span className="mobile-nav-label">Members</span>
        </button>
      </nav>
    </div>
    </>
  );
};

const AppLayout: React.FC = () => (
  <VoiceProvider>
    <AppInner />
  </VoiceProvider>
);

export default AppLayout;
