import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../../features/auth/useAuth';
import { useVoice } from '../../features/voice/VoiceContext';
import {
  joinVoiceChannel,
  subscribeToSignals,
  subscribeToVoiceChannel,
  subscribeToVoicePresence,
  kickFromVoiceChannel
} from '../../features/voice/api';
import { WebRTCManager } from '../../features/voice/webrtc';
import { getUser } from '../../features/auth/api';
import { VoiceParticipant } from '../../types/voice';
import { soundManager } from '../../lib/sounds';
import VoiceControls from './VoiceControls';
import VoiceParticipantCard from './VoiceParticipantCard';
import './VoicePanel.css';

interface VoicePanelProps {
  channelId: string;
  channelName: string;
  onLeave: () => void;
}

function VoicePanel({ channelId, channelName, onLeave }: VoicePanelProps) {
  const { user } = useAuth();
  const { setLocalIsSpeaking } = useVoice();
  const [participants, setParticipants] = useState<VoiceParticipant[]>([]);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [contextMenu, setContextMenu] = useState<{
    x: number; y: number; participant: VoiceParticipant;
  } | null>(null);

  const webrtcRef = useRef<WebRTCManager | null>(null);
  const cleanupRef = useRef<(() => Promise<void>) | null>(null);
  const signalUnsubRef = useRef<(() => void) | null>(null);
  const voiceUnsubRef = useRef<(() => void) | null>(null);
  const presenceUnsubRef = useRef<(() => void) | null>(null);
  // Cache user info to avoid a Firestore fetch on every incoming track event
  const userCache = useRef<Map<string, { username: string; avatarUrl: string }>>(new Map());

  const getUserInfo = useCallback(async (uid: string) => {
    if (userCache.current.has(uid)) return userCache.current.get(uid)!;
    try {
      const u = await getUser(uid);
      const info = { username: u.username, avatarUrl: u.avatarUrl };
      userCache.current.set(uid, info);
      return info;
    } catch {
      const fallback = { username: uid.slice(0, 8), avatarUrl: '👤' };
      userCache.current.set(uid, fallback);
      return fallback;
    }
  }, []);

  // Called by WebRTCManager when a remote peer's stream arrives or updates
  const handleRemoteStream = useCallback(async (remoteUserId: string, stream: MediaStream) => {
    const hasVideo = stream.getVideoTracks().some((t) => t.enabled && t.readyState === 'live');
    console.log(`[Voice] Stream from ${remoteUserId} — audio:${stream.getAudioTracks().length} video:${stream.getVideoTracks().length}`);
    const info = await getUserInfo(remoteUserId);

    setParticipants((prev) => {
      const existing = prev.find((p) => p.userId === remoteUserId);
      if (existing) {
        return prev.map((p) => p.userId === remoteUserId ? { ...p, stream, isCameraOn: hasVideo } : p);
      }
      return [...prev, {
        userId: remoteUserId,
        username: info.username,
        avatarUrl: info.avatarUrl,
        isMuted: false,
        isCameraOn: hasVideo,
        isScreenSharing: false,
        stream
      }];
    });

    // Update isCameraOn when the remote user toggles video after joining
    stream.onaddtrack = () => {
      const live = stream.getVideoTracks().some((t) => t.enabled && t.readyState === 'live');
      setParticipants((prev) =>
        prev.map((p) => p.userId === remoteUserId ? { ...p, stream, isCameraOn: live } : p)
      );
    };
    stream.onremovetrack = () => {
      const live = stream.getVideoTracks().some((t) => t.enabled && t.readyState === 'live');
      setParticipants((prev) =>
        prev.map((p) => p.userId === remoteUserId ? { ...p, stream, isCameraOn: live } : p)
      );
    };
  }, [getUserInfo]);

  const handleRemoveStream = useCallback((remoteUserId: string) => {
    setParticipants((prev) => prev.filter((p) => p.userId !== remoteUserId));
  }, []);

  const doCleanup = async () => {
    signalUnsubRef.current?.();
    voiceUnsubRef.current?.();
    presenceUnsubRef.current?.();
    webrtcRef.current?.cleanup();
    if (cleanupRef.current) await cleanupRef.current();
  };

  // Flag: true only when kicked, so the kick handler can call leaveVoiceChannel
  // before onLeave() fires (otherwise the cleanup would be skipped).
  // For normal nav: channelId doesn't change so cleanup never runs anyway.

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    const webrtcInstance = new WebRTCManager(user.id, channelId, handleRemoteStream, handleRemoveStream);
    webrtcRef.current = webrtcInstance;

    let localLeaveCleanup: (() => Promise<void>) | null = null;

    const init = async () => {
      try {
        userCache.current.set(user.id, { username: user.username, avatarUrl: user.avatarUrl });

        const localStream = await webrtcInstance.initializeLocalStream(true, false);
        if (cancelled) return;

        setParticipants([{
          userId: user.id,
          username: user.username,
          avatarUrl: user.avatarUrl,
          isMuted: false,
          isCameraOn: false,
          isScreenSharing: false,
          stream: localStream
        }]);

        const leaveCleanup = await joinVoiceChannel(channelId, user.id);
        localLeaveCleanup = leaveCleanup;
        cleanupRef.current = leaveCleanup;
        soundManager.play('join');

        // ── Signal handler ───────────────────────────────────────────────────
        signalUnsubRef.current = subscribeToSignals(user.id, channelId, async (signal) => {
          if (signal.type === 'kick') {
            alert('You have been removed from the voice channel by an administrator.');
            signalUnsubRef.current?.();
            voiceUnsubRef.current?.();
            presenceUnsubRef.current?.();
            webrtcInstance.cleanup();
            // Call leaveCleanup directly and clear the ref so the effect return
            // doesn't call it a second time when the component eventually unmounts.
            const cleanup = localLeaveCleanup;
            localLeaveCleanup = null;
            if (cleanup) await cleanup();
            onLeave();
            return;
          }
          if (signal.type === 'offer' && signal.offer) {
            await webrtcInstance.handleOffer(signal.from, signal.offer);
          } else if (signal.type === 'answer' && signal.answer) {
            await webrtcInstance.handleAnswer(signal.from, signal.answer);
          } else if (signal.type === 'ice-candidate' && signal.candidate) {
            await webrtcInstance.handleIceCandidate(signal.from, signal.candidate);
          }
        });

        // ── Firestore participant list ────────────────────────────────────────
        voiceUnsubRef.current = subscribeToVoiceChannel(channelId, async (ids) => {
          console.log('[Voice] Channel participants updated:', ids);

          setParticipants((prev) => {
            const gone = prev.filter((p) => p.userId !== user.id && !ids.includes(p.userId));
            gone.forEach((p) => {
              console.log(`[Voice] Peer ${p.userId} left — removing connection`);
              webrtcInstance.removePeerConnection(p.userId);
            });
            return prev.filter((p) => p.userId === user.id || ids.includes(p.userId));
          });

          for (const pid of ids) {
            if (pid !== user.id) {
              console.log(`[Voice] Initiating peer connection with ${pid}`);
              await webrtcInstance.initiatePeerConnection(pid);
            }
          }
        });

        // ── RTDB presence — instant hard-disconnect detection ────────────────
        presenceUnsubRef.current = subscribeToVoicePresence(channelId, (connectedIds) => {
          setParticipants((prev) => {
            const gone = prev.filter((p) => p.userId !== user.id && !connectedIds.has(p.userId));
            gone.forEach((p) => webrtcInstance.removePeerConnection(p.userId));
            if (gone.length === 0) return prev;
            return prev.filter((p) => p.userId === user.id || connectedIds.has(p.userId));
          });
        });

      } catch (err) {
        console.error('[Voice] Init failed:', err);
        if (!cancelled) {
          alert('Failed to join voice channel. Please check your microphone permissions.');
          onLeave();
        }
      }
    };

    init();

    const onBeforeUnload = () => webrtcRef.current?.cleanup();
    window.addEventListener('beforeunload', onBeforeUnload);

    return () => {
      cancelled = true;
      window.removeEventListener('beforeunload', onBeforeUnload);
      signalUnsubRef.current?.();
      voiceUnsubRef.current?.();
      presenceUnsubRef.current?.();
      webrtcInstance.cleanup();
      // Always clean up — this runs only when channelId changes (channel switch)
      // or when the component unmounts (activeVoice → null via explicit leave).
      // Text/DM navigation doesn't change channelId, so this won't fire for that.
      if (localLeaveCleanup) localLeaveCleanup().catch(console.error);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelId, user?.id]);

  useEffect(() => {
    const h = () => setContextMenu(null);
    document.addEventListener('click', h);
    return () => document.removeEventListener('click', h);
  }, []);

  // ── Controls ─────────────────────────────────────────────────────────────────

  const handleToggleMute = async () => {
    if (!webrtcRef.current) return;
    const next = !isMuted;
    await webrtcRef.current.toggleAudio(!next); // !next = enabled
    setIsMuted(next);
    setParticipants((prev) =>
      prev.map((p) => p.userId === user?.id ? { ...p, isMuted: next } : p)
    );
  };

  const handleToggleCamera = async () => {
    if (!webrtcRef.current) return;
    try {
      const next = !isCameraOn;
      await webrtcRef.current.toggleVideo(next);
      setIsCameraOn(next);
      soundManager.play(next ? 'video-on' : 'video-off');
      const ls = webrtcRef.current.getLocalStream();
      setParticipants((prev) =>
        prev.map((p) => p.userId === user?.id ? { ...p, isCameraOn: next, stream: ls || p.stream } : p)
      );
    } catch (err) {
      console.error('[Voice] Camera toggle failed:', err);
      alert('Failed to toggle camera. Please check camera permissions.');
    }
  };

  const handleToggleScreenShare = async () => {
    if (!webrtcRef.current) return;
    try {
      if (isScreenSharing) {
        await webrtcRef.current.stopScreenShare();
        setIsScreenSharing(false);
        soundManager.play('video-off');
        const ls = webrtcRef.current.getLocalStream();
        setParticipants((prev) =>
          prev.map((p) => p.userId === user?.id ? { ...p, isScreenSharing: false, stream: ls || p.stream } : p)
        );
      } else {
        await webrtcRef.current.startScreenShare();
        setIsScreenSharing(true);
        soundManager.play('video-on');
        const ss = webrtcRef.current.getScreenStream();
        setParticipants((prev) =>
          prev.map((p) => p.userId === user?.id ? { ...p, isScreenSharing: true, stream: ss || p.stream } : p)
        );
      }
    } catch (err) {
      console.error('[Voice] Screen share toggle failed:', err);
      alert('Failed to toggle screen share.');
    }
  };

  const handleLeave = async () => {
    soundManager.play('leave');
    await doCleanup();
    onLeave();
  };

  const handleContextMenu = (e: React.MouseEvent, participant: VoiceParticipant) => {
    e.preventDefault();
    if (user?.isAdmin && participant.userId !== user.id) {
      setContextMenu({ x: e.clientX, y: e.clientY, participant });
    }
  };

  const handleKickUser = async (participant: VoiceParticipant) => {
    if (!user?.isAdmin) return;
    if (confirm(`Kick ${participant.username} from the voice channel?`)) {
      try {
        await kickFromVoiceChannel(channelId, participant.userId, user.id);
        setContextMenu(null);
      } catch (err) {
        alert(err instanceof Error ? err.message : 'Failed to kick user');
      }
    }
  };

  return (
    <div className="voice-panel">
      <div className="voice-header panel-outset">
        <h2 className="voice-channel-title">🔊 {channelName}</h2>
      </div>

      <div className="participants-grid">
        {participants.map((p) => (
          <div key={p.userId} onContextMenu={(e) => handleContextMenu(e, p)}>
            <VoiceParticipantCard
              participant={p}
              onSpeakingChange={p.userId === user?.id ? setLocalIsSpeaking : undefined}
            />
          </div>
        ))}
      </div>

      {contextMenu && (
        <div className="context-menu panel" style={{ left: contextMenu.x, top: contextMenu.y }}>
          <div className="context-item" onClick={() => handleKickUser(contextMenu.participant)}>
            👢 Kick from Voice
          </div>
        </div>
      )}

      <VoiceControls
        isMuted={isMuted}
        isCameraOn={isCameraOn}
        isScreenSharing={isScreenSharing}
        onToggleMute={handleToggleMute}
        onToggleCamera={handleToggleCamera}
        onToggleScreenShare={handleToggleScreenShare}
        onLeave={handleLeave}
      />
    </div>
  );
}

export default VoicePanel;
