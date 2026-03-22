import React, { useRef, useEffect, useState } from 'react';
import { useAuth } from '../../features/auth/useAuth';
import { VoiceParticipant } from '../../types/voice';
import Avatar from '../ui/Avatar';
import './VoiceParticipantCard.css';

interface Props { participant: VoiceParticipant; }

function VoiceParticipantCard({ participant }: Props) {
  const { user } = useAuth();
  const audioRef = useRef<HTMLAudioElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const isOwn = user?.id === participant.userId;

  // Track version counter so we can force re-attach when tracks change.
  // The stream object reference often stays the same even when tracks are added/removed.
  const [trackVersion, setTrackVersion] = useState(0);

  // Attach/re-attach media elements whenever the stream or tracks change.
  // Also subscribe to track events on the stream to catch mid-call camera toggles.
  useEffect(() => {
    const stream = participant.stream;
    if (!stream) return;

    console.log(`[VoiceCard] Attaching stream for ${participant.username} — audio:${stream.getAudioTracks().length} video:${stream.getVideoTracks().length}`);

    if (audioRef.current && !isOwn) {
      audioRef.current.srcObject = stream;
      audioRef.current.play().catch(() => {/* autoplay policy — unlocked on user gesture */});
    }
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(() => {});
    }

    // Force a re-render (and srcObject re-attach) whenever a track is added or removed
    // mid-call (e.g. remote user toggles camera on/off).
    const onTrackChange = () => {
      console.log(`[VoiceCard] Track change on stream for ${participant.username}`);
      setTrackVersion((v) => v + 1);
    };
    stream.addEventListener('addtrack', onTrackChange);
    stream.addEventListener('removetrack', onTrackChange);

    return () => {
      stream.removeEventListener('addtrack', onTrackChange);
      stream.removeEventListener('removetrack', onTrackChange);
    };
  }, [participant.stream, participant.userId, isOwn, trackVersion]);

  const hasLiveVideo =
    !!participant.stream &&
    (participant.isCameraOn || participant.isScreenSharing) &&
    participant.stream.getVideoTracks().some((t) => t.readyState === 'live' && t.enabled);

  return (
    <div className="voice-participant-card panel">
      {/* Always render both elements — toggle visibility with CSS so the ref
          is never null when a stream first arrives. */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isOwn}
        className="participant-video"
        style={{ display: hasLiveVideo ? 'block' : 'none' }}
      />
      <div
        className="participant-avatar"
        style={{ display: hasLiveVideo ? 'none' : 'flex' }}
      >
        <Avatar src={participant.avatarUrl} size={64} />
      </div>

      {!isOwn && <audio ref={audioRef} autoPlay />}

      <div className="participant-info">
        <div className="participant-name">
          {participant.username}{isOwn && ' (You)'}
        </div>
        <div className="participant-status">
          {participant.isMuted && <span className="status-icon">🔇</span>}
          {participant.isCameraOn && <span className="status-icon">📹</span>}
          {participant.isScreenSharing && <span className="status-icon">🖥️</span>}
        </div>
      </div>
    </div>
  );
}

export default VoiceParticipantCard;