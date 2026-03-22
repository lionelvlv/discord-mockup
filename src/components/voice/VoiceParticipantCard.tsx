import React, { useRef, useEffect, useState } from 'react';
import { useAuth } from '../../features/auth/useAuth';
import { VoiceParticipant } from '../../types/voice';
import Avatar from '../ui/Avatar';
import './VoiceParticipantCard.css';

interface Props { participant: VoiceParticipant; onSpeakingChange?: (speaking: boolean) => void; }

const SPEAK_THRESHOLD = 0.015;
const SILENCE_DEBOUNCE_MS = 400;

// ── Speaking detector (unchanged) ────────────────────────────────────────────
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
      let sumSq = 0;
      for (let i = 0; i < buf.length; i++) sumSq += buf[i] * buf[i];
      const rms = Math.sqrt(sumSq / buf.length);
      if (rms > SPEAK_THRESHOLD) {
        if (silenceTimerRef.current) { clearTimeout(silenceTimerRef.current); silenceTimerRef.current = null; }
        setIsSpeaking(true);
      } else if (silenceTimerRef.current === null) {
        silenceTimerRef.current = setTimeout(() => { setIsSpeaking(false); silenceTimerRef.current = null; }, SILENCE_DEBOUNCE_MS);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    ctx.resume().then(() => { rafRef.current = requestAnimationFrame(tick); });
    return () => {
      cancelAnimationFrame(rafRef.current);
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      source.disconnect();
      analyser.disconnect();
      setIsSpeaking(false);
    };
  }, [stream, enabled]);

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

// ── Retro audio processor — McDonald's drive-thru speaker effect ──────────────
// Chain: source → bandpass (300-3400 Hz telephone range) → waveshaper (soft clip/distort)
// → gain → destination. This creates that compressed, tinny, lo-fi walkie-talkie sound.
function useRetroAudio(stream: MediaStream | undefined, audioEl: React.RefObject<HTMLAudioElement>) {
  const audioCtxRef = useRef<AudioContext | null>(null);
  const nodesRef = useRef<AudioNode[]>([]);

  useEffect(() => {
    if (!stream || !audioEl.current) return;
    const tracks = stream.getAudioTracks();
    if (tracks.length === 0) return;

    const ctx = new AudioContext();
    audioCtxRef.current = ctx;

    const source = ctx.createMediaStreamSource(stream);

    // Bandpass: cut everything below 300 Hz and above 3400 Hz (telephone codec range)
    const lowCut = ctx.createBiquadFilter();
    lowCut.type = 'highpass';
    lowCut.frequency.value = 300;
    lowCut.Q.value = 0.7;

    const highCut = ctx.createBiquadFilter();
    highCut.type = 'lowpass';
    highCut.frequency.value = 3400;
    highCut.Q.value = 0.7;

    // Presence boost around 1-2 kHz — that nasal "speakerphone" mid-peak
    const midBoost = ctx.createBiquadFilter();
    midBoost.type = 'peaking';
    midBoost.frequency.value = 1500;
    midBoost.Q.value = 1.2;
    midBoost.gain.value = 8; // +8 dB

    // Waveshaper — soft saturation / gentle clipping for that compressed crunch
    const distortion = ctx.createWaveShaper();
    const makeDistortionCurve = (amount: number) => {
      const n = 256;
      const curve = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        const x = (i * 2) / n - 1;
        // Soft-knee clip with amount controlling drive
        curve[i] = ((Math.PI + amount) * x) / (Math.PI + amount * Math.abs(x));
      }
      return curve;
    };
    distortion.curve = makeDistortionCurve(60); // 60 = moderately crunchy
    distortion.oversample = '2x';

    // Slight gain reduction after distortion (saturation adds volume)
    const gain = ctx.createGain();
    gain.gain.value = 0.75;

    // Chain everything
    source.connect(lowCut);
    lowCut.connect(highCut);
    highCut.connect(midBoost);
    midBoost.connect(distortion);
    distortion.connect(gain);
    gain.connect(ctx.destination);
    nodesRef.current = [source, lowCut, highCut, midBoost, distortion, gain];

    // The audio element is now bypassed — Web Audio handles output to speakers.
    // Mute the element so we don't get double audio.
    audioEl.current.muted = true;

    ctx.resume().catch(() => {});

    return () => {
      nodesRef.current.forEach(n => { try { n.disconnect(); } catch {} });
      ctx.close().catch(() => {});
      audioCtxRef.current = null;
      if (audioEl.current) audioEl.current.muted = false;
    };
  }, [stream]);

  useEffect(() => {
    return () => {
      nodesRef.current.forEach(n => { try { n.disconnect(); } catch {} });
      audioCtxRef.current?.close().catch(() => {});
    };
  }, []);
}

// ── Component ─────────────────────────────────────────────────────────────────
function VoiceParticipantCard({ participant, onSpeakingChange }: Props) {
  const { user } = useAuth();
  const audioRef = useRef<HTMLAudioElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const isOwn = user?.id === participant.userId;

  // trackVersion forces re-render when any video track changes state
  const [trackVersion, setTrackVersion] = useState(0);

  const isSpeaking = useSpeakingDetector(participant.stream, !participant.isMuted);

  // Apply retro audio processing to remote participants
  useRetroAudio(!isOwn ? participant.stream : undefined, audioRef);

  useEffect(() => {
    onSpeakingChange?.(isSpeaking);
  }, [isSpeaking, onSpeakingChange]);

  useEffect(() => {
    const stream = participant.stream;
    if (!stream) return;

    console.log(`[VoiceCard] Attaching stream for ${participant.username} — audio:${stream.getAudioTracks().length} video:${stream.getVideoTracks().length}`);

    if (audioRef.current && !isOwn) {
      audioRef.current.srcObject = stream;
      // Don't call play() here — useRetroAudio handles audio routing.
      // We keep srcObject set so the element stays ready if retro audio isn't available.
    }
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(() => {});
    }

    // Re-render on stream structure changes (addtrack / removetrack)
    const onStreamChange = () => setTrackVersion(v => v + 1);
    stream.addEventListener('addtrack', onStreamChange);
    stream.addEventListener('removetrack', onStreamChange);

    // CRITICAL FIX: subscribe to each video track's 'ended' event.
    // When a user stops screensharing or camera, the track's readyState becomes
    // 'ended' but addtrack/removetrack do NOT fire. We must listen to track.onended
    // directly to trigger a re-render that hides the video and shows the avatar.
    const videoTracks = stream.getVideoTracks();
    videoTracks.forEach(t => { t.addEventListener('ended', onStreamChange); });

    return () => {
      stream.removeEventListener('addtrack', onStreamChange);
      stream.removeEventListener('removetrack', onStreamChange);
      videoTracks.forEach(t => { t.removeEventListener('ended', onStreamChange); });
    };
  }, [participant.stream, participant.userId, isOwn, trackVersion]);

  // hasLiveVideo: check readyState AND enabled on every render (trackVersion bumps trigger this)
  const hasLiveVideo =
    !!participant.stream &&
    participant.stream.getVideoTracks().some(t => t.readyState === 'live' && t.enabled);

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

      {/* Audio element stays in DOM; useRetroAudio mutes it and routes through Web Audio */}
      {!isOwn && <audio ref={audioRef} autoPlay />}

      <div className="participant-info">
        <div className="participant-name">
          {participant.username}{isOwn && ' (You)'}
          {isSpeaking && !participant.isMuted && <span className="speaking-badge" title="Speaking">🔊</span>}
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
