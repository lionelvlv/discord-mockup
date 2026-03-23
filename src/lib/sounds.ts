class SoundManager {
  private sounds: Map<string, HTMLAudioElement> = new Map();
  private enabled: boolean = true;

  constructor() {
    // Create sound effects using Web Audio API
    this.initializeSounds();
  }

  private initializeSounds() {
    // Join call sound (rising tone)
    this.sounds.set('join', this.createTone([400, 600], 0.2));
    
    // Leave call sound (falling tone)
    this.sounds.set('leave', this.createTone([600, 400], 0.2));
    
    // Message received (gentle ding) - no longer auto-played, kept for compatibility
    this.sounds.set('message', this.createTone([800], 0.1));
    
    // Mention sound (two-tone ping, more attention-grabbing)
    this.sounds.set('mention', this.createTone([900, 1100], 0.25));
    
    // Video/Screen share on (quick chirp)
    this.sounds.set('video-on', this.createTone([500, 700], 0.15));
    
    // Video/Screen share off (quick descend)
    this.sounds.set('video-off', this.createTone([700, 500], 0.15));
  }

  private createTone(frequencies: number[], duration: number): HTMLAudioElement {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const sampleRate = audioContext.sampleRate;
    const numSamples = sampleRate * duration;
    const buffer = audioContext.createBuffer(1, numSamples, sampleRate);
    const data = buffer.getChannelData(0);

    const segmentLength = numSamples / frequencies.length;

    for (let i = 0; i < numSamples; i++) {
      const segmentIndex = Math.floor(i / segmentLength);
      const frequency = frequencies[Math.min(segmentIndex, frequencies.length - 1)];
      const fade = 1 - (i / numSamples); // Fade out
      data[i] = Math.sin(2 * Math.PI * frequency * i / sampleRate) * 0.3 * fade;
    }

    // Convert buffer to audio element
    const offlineContext = new OfflineAudioContext(1, numSamples, sampleRate);
    const source = offlineContext.createBufferSource();
    source.buffer = buffer;
    source.connect(offlineContext.destination);
    source.start();

    const audio = new Audio();
    
    offlineContext.startRendering().then((renderedBuffer) => {
      const wav = this.bufferToWave(renderedBuffer);
      const blob = new Blob([wav], { type: 'audio/wav' });
      audio.src = URL.createObjectURL(blob);
    });

    return audio;
  }

  private bufferToWave(buffer: AudioBuffer): ArrayBuffer {
    const length = buffer.length * buffer.numberOfChannels * 2 + 44;
    const arrayBuffer = new ArrayBuffer(length);
    const view = new DataView(arrayBuffer);
    const channels: Float32Array[] = [];
    let offset = 0;
    let pos = 0;

    // Write WAV header
    const setUint16 = (data: number) => {
      view.setUint16(pos, data, true);
      pos += 2;
    };
    const setUint32 = (data: number) => {
      view.setUint32(pos, data, true);
      pos += 4;
    };

    setUint32(0x46464952); // "RIFF"
    setUint32(length - 8);
    setUint32(0x45564157); // "WAVE"
    setUint32(0x20746d66); // "fmt "
    setUint32(16);
    setUint16(1);
    setUint16(buffer.numberOfChannels);
    setUint32(buffer.sampleRate);
    setUint32(buffer.sampleRate * 2 * buffer.numberOfChannels);
    setUint16(buffer.numberOfChannels * 2);
    setUint16(16);
    setUint32(0x61746164); // "data"
    setUint32(length - pos - 4);

    // Write audio data
    for (let i = 0; i < buffer.numberOfChannels; i++) {
      channels.push(buffer.getChannelData(i));
    }

    while (pos < length) {
      for (let i = 0; i < buffer.numberOfChannels; i++) {
        const sample = Math.max(-1, Math.min(1, channels[i][offset]));
        view.setInt16(pos, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
        pos += 2;
      }
      offset++;
    }

    return arrayBuffer;
  }

  play(soundName: string, volume: number = 1) {
    if (!this.enabled) return;
    
    const sound = this.sounds.get(soundName);
    if (sound) {
      const clone = sound.cloneNode() as HTMLAudioElement;
      clone.volume = Math.min(1, Math.max(0, volume));
      clone.play().catch(err => console.log('Sound play failed:', err));
    }
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
  }

  isEnabled(): boolean {
    return this.enabled;
  }
}

export const soundManager = new SoundManager();