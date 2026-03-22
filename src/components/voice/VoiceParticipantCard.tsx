import React, { useRef, useEffect, useState } from 'react';
import { useAuth } from '../../features/auth/useAuth';
import { VoiceParticipant } from '../../types/voice';
import Avatar from '../ui/Avatar';
import './VoiceParticipantCard.css';

interface Props { participant: VoiceParticipant; onSpeakingChange?: (speaking: boolean) => void; }

// Web Audio API speaking detection — measures RMS of the audio signal every
// animation frame. If the level exceeds SPEAK_THRESHOLD the participant is
// marked as speaking; a short debounce prevents rapid flicker on silence.
const SPEAK_THRESHOLD = 0.015;  // 0–1 normalised RMS (tune if too sensitive)
const SILENCE_DEBOUNCE_MS = 400; // how long below threshold before "not speaking"

function useSpeakingDetector(stream: MediaStream | undefined, enabled: boolean) {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const rafRef = useRef<number>(0);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);

  useEffect(() => {
    if (!enabled || !stream || stream.getAudioTracks().length === 0) {
      setIsSpeaking(false);
      return;
    }

    // Lazily create an AudioContext — reuse if one already exists for this card
    if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
      audioCtxRef.current = new AudioContext();
    }
    const ctx = audioCtxRef.current;

    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.4;
    analyserRef.current = analyser;

    const source = ctx.createMediaStreamSource(stream);
    source.connect(analyser);
    sourceRef.current = source;

    const buf = new Float32Array(analyser.fftSize);

    const tick = () => {
      analyser.getFloatTimeDomainData(buf);
      // RMS (root mean square) of the signal
      let sumSq = 0;
      for (let i = 0; i < buf.length; i++) sumSq += buf[i] * buf[i];
      const rms = Math.sqrt(sumSq / buf.length);

      if (rms > SPEAK_THRESHOLD) {
        if (silenceTimerRef.current) {
          clearTimeout(silenceTimerRef.current);
          silenceTimerRef.current = null;
        }
        setIsSpeaking(true);
      } else if (silenceTimerRef.current === null) {
        silenceTimerRef.current = setTimeout(() => {
          setIsSpeaking(false);
          silenceTimerRef.current = null;
        }, SILENCE_DEBOUNCE_MS);
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    // AudioContext requires a user gesture to start on some browsers
    ctx.resume().then(() => { rafRef.current = requestAnimationFrame(tick); });

    return () => {
      cancelAnimationFrame(rafRef.current);
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      source.disconnect();
      analyser.disconnect();
      setIsSpeaking(false);
    };
  }, [stream, enabled]);

  // Tear down AudioContext on component unmount
  useEffect(() => {
    return () => {
      cancelAnimationFrame(rafRef.current);
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      sourceRef.current?.disconnect();
      analyserRef.current?.disconnect();
      audioCtxRef.current?.close().catch(() => {});
    };
  }, []);

  return isSpeaking;
}

function VoiceParticipantCard({ participant, onSpeakingChange }: Props) {
  const { user } = useAuth();
  const audioRef = useRef<HTMLAudioElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const isOwn = user?.id === participant.userId;

  const [trackVersion, setTrackVersion] = useState(0);

  // Detect speaking — for own card use local stream directly;
  // for remote cards use the received stream.
  // Muted participants are never "speaking".
  const isSpeaking = useSpeakingDetector(
    participant.stream,
    !participant.isMuted
  );

  // Propagate speaking state to parent (e.g. VoicePanel → VoiceContext → collapsed bar)
  useEffect(() => {
    onSpeakingChange?.(isSpeaking);
  }, [isSpeaking, onSpeakingChange]);

  useEffect(() => {
    const stream = participant.stream;
    if (!stream) return;

    console.log(`[VoiceCard] Attaching stream for ${participant.username} — audio:${stream.getAudioTracks().length} video:${stream.getVideoTracks().length}`);

    if (audioRef.current && !isOwn) {
      audioRef.current.srcObject = stream;
      audioRef.current.play().catch(() => {});
    }
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(() => {});
    }

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

  const handleFullscreen = () => {
    const el = videoRef.current;
    if (!el) return;
    if (el.requestFullscreen) el.requestFullscreen();
    else if ((el as any).webkitRequestFullscreen) (el as any).webkitRequestFullscreen();
  };

  return (
    <div className={`voice-participant-card panel ${isSpeaking ? 'speaking' : ''} ${participant.isMuted ? 'muted' : ''}`}>
      <div className="participant-media-wrap">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isOwn}
          className="participant-video"
          style={{ display: hasLiveVideo ? 'block' : 'none' }}
        />
        {hasLiveVideo && (
          <button
            className="participant-fullscreen-btn button-95"
            onClick={handleFullscreen}
            title="Full screen"
          >⛶</button>
        )}
        <div
          className="participant-avatar"
          style={{ display: hasLiveVideo ? 'none' : 'flex' }}
        >
          <Avatar src={participant.avatarUrl} size={64} />
        </div>
      </div>

      </div>{/* end participant-media-wrap */}

      {!isOwn && <audio ref={audioRef} autoPlay />}

      <div className="participant-info">
        <div className="participant-name">
          {participant.username}{isOwn && ' (You)'}
          {isSpeaking && !participant.isMuted && (
            <span className="speaking-badge" title="Speaking">🔊</span>
          )}
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
