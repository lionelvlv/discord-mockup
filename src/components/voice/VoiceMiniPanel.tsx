import React, { useRef, useEffect, useState } from 'react';
import { useVoice } from '../../features/voice/VoiceContext';
import { useAuth } from '../../features/auth/useAuth';
import Avatar from '../ui/Avatar';
import './VoiceMiniPanel.css';

// The compact voice widget shown in the left rail while in a call but viewing a text channel.
// Reads participant state and controls from VoiceContext — WebRTC stays in the hidden VoicePanel.
const VoiceMiniPanel: React.FC = () => {
  const { activeVoice, leaveVoice, setExpanded, participants, isMuted, isCameraOn, isScreenSharing, controls, localIsSpeaking } = useVoice();
  const { user } = useAuth();

  // Find the most interesting video to show: remote screenshare > remote camera > own camera
  const videoParticipant = participants.find(p => p.userId !== user?.id && p.stream &&
    p.stream.getVideoTracks().some(t => t.readyState === 'live' && t.enabled))
    ?? participants.find(p => p.stream &&
    p.stream.getVideoTracks().some(t => t.readyState === 'live' && t.enabled));

  const videoRef = useRef<HTMLVideoElement>(null);
  const [hasVideo, setHasVideo] = useState(false);

  useEffect(() => {
    const stream = videoParticipant?.stream;
    const live = !!stream?.getVideoTracks().some(t => t.readyState === 'live' && t.enabled);
    setHasVideo(live);
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(() => {});
    } else if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, [videoParticipant?.stream, videoParticipant?.userId]);

  if (!activeVoice) return null;

  const localParticipant = participants.find(p => p.userId === user?.id);

  return (
    <div className={`voice-mini-panel ${localIsSpeaking ? 'speaking' : ''}`}>
      {/* Video preview — shown when any participant has live video */}
      {hasVideo && (
        <div className="mini-video-wrap" onClick={() => setExpanded(true)} title="Click to expand call">
          <video ref={videoRef} autoPlay playsInline muted className="mini-video" />
          <div className="mini-video-label">
            {videoParticipant?.username ?? ''}
          </div>
        </div>
      )}

      {/* Status row */}
      <div className="mini-status-row" onClick={() => setExpanded(true)}>
        <span className={`mini-speaking-dot ${localIsSpeaking ? 'active' : ''}`} />
        <span className="mini-channel-name">🔊 {activeVoice.channelName}</span>
        <span className="mini-you-label">
          {localParticipant && <Avatar src={localParticipant.avatarUrl} size={18} />}
        </span>
      </div>

      {/* Controls row */}
      <div className="mini-controls-row">
        <button
          className={`mini-btn button-95 ${isMuted ? 'mini-btn-active' : ''}`}
          onClick={(e) => { e.stopPropagation(); controls?.toggleMute(); }}
          title={isMuted ? 'Unmute' : 'Mute'}
        >
          {isMuted ? '🔇' : '🎤'}
        </button>

        <button
          className={`mini-btn button-95 ${isCameraOn ? 'mini-btn-active' : ''}`}
          onClick={(e) => { e.stopPropagation(); controls?.toggleCamera(); }}
          title={isCameraOn ? 'Turn off camera' : 'Turn on camera'}
        >
          {isCameraOn ? '📹' : '📷'}
        </button>

        <button
          className="mini-btn button-95"
          onClick={(e) => { e.stopPropagation(); setExpanded(true); }}
          title="Open call"
        >
          ↗
        </button>

        <button
          className="mini-btn mini-btn-leave button-95"
          onClick={(e) => { e.stopPropagation(); leaveVoice(); }}
          title="Leave call"
        >
          📞
        </button>
      </div>
    </div>
  );
};

export default VoiceMiniPanel;
