// SoundManager — all sounds generated via Web Audio API.
// AudioContext is created lazily on first user interaction to satisfy mobile browser policies.

class SoundManager {
  private enabled = true;
  private audioCtx: AudioContext | null = null;
  private soundBuffers = new Map<string, AudioBuffer>();
  private ready = false;

  // Lazily get/create the AudioContext after a user gesture
  private getCtx(): AudioContext | null {
    if (this.audioCtx && this.audioCtx.state !== 'closed') return this.audioCtx;
    try {
      this.audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      if (!this.ready) {
        this.ready = true;
        this.buildBuffers(this.audioCtx);
      }
      return this.audioCtx;
    } catch {
      return null;
    }
  }

  // Pre-build all buffers once we have a context
  private buildBuffers(ctx: AudioContext) {
    const defs: Record<string, { freqs: number[]; duration: number; vol: number }> = {
      join:      { freqs: [400, 600], duration: 0.20, vol: 0.35 },
      leave:     { freqs: [600, 400], duration: 0.20, vol: 0.35 },
      mention:   { freqs: [900, 1200], duration: 0.18, vol: 0.5 },
      'video-on':  { freqs: [500, 700], duration: 0.15, vol: 0.3 },
      'video-off': { freqs: [700, 500], duration: 0.15, vol: 0.3 },
    };
    Object.entries(defs).forEach(([name, { freqs, duration, vol }]) => {
      const sr      = ctx.sampleRate;
      const n       = Math.ceil(sr * duration);
      const buf     = ctx.createBuffer(1, n, sr);
      const data    = buf.getChannelData(0);
      const segLen  = n / freqs.length;
      for (let i = 0; i < n; i++) {
        const seg  = Math.min(Math.floor(i / segLen), freqs.length - 1);
        const fade = 1 - i / n;
        data[i] = Math.sin(2 * Math.PI * freqs[seg] * i / sr) * vol * fade;
      }
      this.soundBuffers.set(name, buf);
    });
  }

  // Must be called from a user-gesture handler (click, keydown, touchend) to
  // unlock audio on iOS/Android. Safe to call multiple times.
  unlock() {
    const ctx = this.getCtx();
    if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
  }

  play(soundName: string, volume = 1) {
    if (!this.enabled) return;
    const ctx = this.getCtx();
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});

    const buf = this.soundBuffers.get(soundName);
    if (!buf) return;
    try {
      const src  = ctx.createBufferSource();
      const gain = ctx.createGain();
      src.buffer = buf;
      gain.gain.value = Math.min(1, Math.max(0, volume));
      src.connect(gain);
      gain.connect(ctx.destination);
      src.start();
    } catch { /* audio unavailable */ }
  }

  setEnabled(enabled: boolean) { this.enabled = enabled; }
  isEnabled() { return this.enabled; }
}

export const soundManager = new SoundManager();

// Unlock audio on first user interaction — call this once in main.tsx or App
export function unlockAudio() {
  soundManager.unlock();
}
