import { sendSignal } from './api';

// Pure P2P WebRTC mesh following the Perfect Negotiation pattern.
//
// Each peer gets a polarity: the peer with the lexicographically SMALLER userId
// is "polite" — it rolls back and defers to the remote peer on offer collision.
// The peer with the LARGER userId is "impolite" — its offer wins on collision.
// This eliminates the race condition where both sides send offers simultaneously.
//
// ICE candidates are queued when they arrive before the remote description is set,
// then drained immediately after setRemoteDescription completes.

export class WebRTCManager {
  private peerConnections: Map<string, RTCPeerConnection> = new Map();
  private iceCandidateQueue: Map<string, RTCIceCandidateInit[]> = new Map();
  private remoteDescSet: Map<string, boolean> = new Map();
  private makingOffer: Map<string, boolean> = new Map();
  private ignoreOffer: Map<string, boolean> = new Map();

  private localStream: MediaStream | null = null;
  private screenStream: MediaStream | null = null;

  private readonly userId: string;
  private readonly channelId: string;
  private readonly onRemoteStream: (userId: string, stream: MediaStream) => void;
  private readonly onRemoveStream: (userId: string) => void;

  constructor(
    userId: string,
    channelId: string,
    onRemoteStream: (userId: string, stream: MediaStream) => void,
    onRemoveStream: (userId: string) => void
  ) {
    this.userId = userId;
    this.channelId = channelId;
    this.onRemoteStream = onRemoteStream;
    this.onRemoveStream = onRemoveStream;
  }

  // Polite peer = smaller userId. Impolite peer = larger userId.
  private isPolite(remoteUserId: string): boolean {
    return this.userId < remoteUserId;
  }

  // ── Local media ─────────────────────────────────────────────────────────────

  async initializeLocalStream(audio = true, video = false): Promise<MediaStream> {
    this.localStream = await navigator.mediaDevices.getUserMedia({
      audio: audio
        ? { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
        : false,
      video: video ? { width: { ideal: 1280 }, height: { ideal: 720 } } : false
    });
    return this.localStream;
  }

  getLocalStream(): MediaStream | null { return this.localStream; }
  getScreenStream(): MediaStream | null { return this.screenStream; }

  async toggleAudio(enabled: boolean): Promise<void> {
    this.localStream?.getAudioTracks().forEach((t) => (t.enabled = enabled));
  }

  async toggleVideo(enabled: boolean): Promise<void> {
    if (enabled) {
      // Re-enable live track if we still have one
      const live = this.localStream?.getVideoTracks().find((t) => t.readyState === 'live');
      if (live) {
        live.enabled = true;
        this.peerConnections.forEach((pc) => {
          pc.getSenders().find((s) => s.track?.kind === 'video')?.replaceTrack(live);
        });
        return;
      }

      // Acquire a new video-only stream — do NOT request audio again
      const vs = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      const track = vs.getVideoTracks()[0];

      if (!this.localStream) this.localStream = new MediaStream();
      // Remove any dead video tracks first
      this.localStream.getVideoTracks().forEach((t) => {
        t.stop();
        this.localStream!.removeTrack(t);
      });
      this.localStream.addTrack(track);

      this.peerConnections.forEach((pc) => {
        const sender = pc.getSenders().find((s) => s.track?.kind === 'video');
        if (sender) {
          sender.replaceTrack(track); // no renegotiation needed
        } else {
          pc.addTrack(track, this.localStream!); // triggers onnegotiationneeded
        }
      });
    } else {
      this.localStream?.getVideoTracks().forEach((track) => {
        track.enabled = false;
        track.stop();
        this.localStream!.removeTrack(track);
        this.peerConnections.forEach((pc) => {
          const sender = pc.getSenders().find((s) => s.track === track);
          if (sender) sender.replaceTrack(null).catch(() => pc.removeTrack(sender));
        });
      });
    }
  }

  async startScreenShare(): Promise<void> {
    this.screenStream = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: true  // captured locally so user hears tab audio; NOT forwarded as second track
    });

    const videoTrack = this.screenStream.getVideoTracks()[0];
    if (!videoTrack) return;

    this.peerConnections.forEach((pc) => {
      const sender = pc.getSenders().find((s) => s.track?.kind === 'video');
      if (sender) {
        // replaceTrack keeps the existing stream association — remote keeps audio ✓
        sender.replaceTrack(videoTrack);
      } else {
        // IMPORTANT: associate with localStream, NOT screenStream.
        // If we pass screenStream here the remote's ontrack fires with a stream
        // that has NO audio tracks, so their audioRef goes silent. Passing
        // localStream means the remote's video track arrives in the same stream
        // as the audio track, so audio is preserved.
        pc.addTrack(videoTrack, this.localStream!);
      }
    });

    videoTrack.onended = () => this.stopScreenShare();
  }

  async stopScreenShare(): Promise<void> {
    if (!this.screenStream) return;
    this.screenStream.getTracks().forEach((track) => {
      track.stop();
      this.peerConnections.forEach((pc) => {
        const sender = pc.getSenders().find((s) => s.track === track);
        if (sender) sender.replaceTrack(null).catch(() => pc.removeTrack(sender));
      });
    });
    this.screenStream = null;
  }

  // ── Peer connection lifecycle ────────────────────────────────────────────────

  async createPeerConnection(remoteUserId: string): Promise<RTCPeerConnection> {
    // Tear down any stale connection
    if (this.peerConnections.has(remoteUserId)) {
      console.log(`[RTC] Tearing down stale connection with ${remoteUserId}`);
      this.peerConnections.get(remoteUserId)?.close();
    }
    this.remoteDescSet.set(remoteUserId, false);
    this.iceCandidateQueue.set(remoteUserId, []);
    this.makingOffer.set(remoteUserId, false);
    this.ignoreOffer.set(remoteUserId, false);

    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        // Free TURN relay for peers behind symmetric NAT (no credentials required)
        {
          urls: 'turn:openrelay.metered.ca:80',
          username: 'openrelayproject',
          credential: 'openrelayproject'
        },
        {
          urls: 'turn:openrelay.metered.ca:443',
          username: 'openrelayproject',
          credential: 'openrelayproject'
        },
        {
          urls: 'turn:openrelay.metered.ca:443?transport=tcp',
          username: 'openrelayproject',
          credential: 'openrelayproject'
        }
      ]
    });

    const polarity = this.isPolite(remoteUserId) ? 'polite' : 'impolite';
    console.log(`[RTC] Created peer connection with ${remoteUserId} (we are ${polarity})`);

    // Add all local mic/camera tracks
    const localTracks = this.localStream?.getTracks() ?? [];
    console.log(`[RTC] Adding ${localTracks.length} local track(s) to connection with ${remoteUserId}`);
    localTracks.forEach((t) => pc.addTrack(t, this.localStream!));
    // Add screen video track if active — associate with localStream (not screenStream!)
    // so the remote receives it in the same stream as the audio track.
    this.screenStream?.getVideoTracks().forEach((t) => pc.addTrack(t, this.localStream!));

    // Surface incoming tracks to the UI.
    // Fire onRemoteStream for every individual track event so callers always
    // get notified even if the MediaStream reference is reused.
    pc.ontrack = (event) => {
      const stream = event.streams[0] ?? new MediaStream([event.track]);
      console.log(`[RTC] Received ${event.track.kind} track from ${remoteUserId} — stream id: ${stream.id}`);
      this.onRemoteStream(remoteUserId, stream);
    };

    // Send ICE candidates to remote peer via Firestore signaling
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        console.log(`[RTC] Sending ICE candidate → ${remoteUserId}`);
        sendSignal(this.userId, remoteUserId, this.channelId, {
          type: 'ice-candidate',
          candidate: event.candidate.toJSON()
        });
      }
    };

    pc.onicegatheringstatechange = () => {
      console.log(`[RTC] ICE gathering state with ${remoteUserId}: ${pc.iceGatheringState}`);
    };

    pc.oniceconnectionstatechange = () => {
      console.log(`[RTC] ICE connection state with ${remoteUserId}: ${pc.iceConnectionState}`);
    };

    pc.onconnectionstatechange = () => {
      console.log(`[RTC] Connection state with ${remoteUserId}: ${pc.connectionState}`);
      if (pc.connectionState === 'failed') {
        console.warn(`[RTC] Connection failed with ${remoteUserId} — restarting ICE`);
        pc.restartIce();
      }
      if (pc.connectionState === 'closed') this.removePeerConnection(remoteUserId);
    };

    pc.onsignalingstatechange = () => {
      console.log(`[RTC] Signaling state with ${remoteUserId}: ${pc.signalingState}`);
    };

    // Perfect Negotiation: BOTH peers respond to onnegotiationneeded by sending offers.
    // The polite/impolite distinction only matters when BOTH peers send offers
    // simultaneously (collision) — handled in handleOffer below.
    // Previously the polite peer skipped this entirely, which meant camera/screenshare
    // toggled by the polite peer was never sent to the remote side.
    pc.onnegotiationneeded = async () => {
      try {
        this.makingOffer.set(remoteUserId, true);
        console.log(`[RTC] onnegotiationneeded with ${remoteUserId} — creating offer (${this.isPolite(remoteUserId) ? 'polite' : 'impolite'})`);
        await pc.setLocalDescription();
        await sendSignal(this.userId, remoteUserId, this.channelId, {
          type: 'offer',
          offer: pc.localDescription!
        });
        console.log(`[RTC] Sent offer → ${remoteUserId}`);
      } catch (err) {
        console.error('[RTC] onnegotiationneeded error:', err);
      } finally {
        this.makingOffer.set(remoteUserId, false);
      }
    };

    this.peerConnections.set(remoteUserId, pc);
    return pc;
  }

  // Create connection if one doesn't already exist.
  // Called when a new participant appears in the channel.
  // If a connection already exists, ensures all local tracks are attached
  // (guards against the case where tracks were acquired after the connection was created).
  async initiatePeerConnection(remoteUserId: string): Promise<void> {
    if (this.peerConnections.has(remoteUserId)) {
      // Connection already exists — make sure all local tracks are present.
      // This handles the race where createPeerConnection ran before getUserMedia finished.
      const pc = this.peerConnections.get(remoteUserId)!;
      const existingSenderKinds = new Set(
        pc.getSenders().map((s) => s.track?.kind).filter(Boolean)
      );
      let tracksAdded = false;
      this.localStream?.getTracks().forEach((t) => {
        if (!existingSenderKinds.has(t.kind)) {
          console.log(`[RTC] Late-adding local ${t.kind} track to existing connection with ${remoteUserId}`);
          pc.addTrack(t, this.localStream!);
          tracksAdded = true;
        }
      });
      if (tracksAdded) {
        console.log(`[RTC] Tracks added to existing connection — renegotiation will be triggered for ${remoteUserId}`);
      }
      return;
    }
    console.log(`[RTC] Creating new peer connection with ${remoteUserId}`);
    await this.createPeerConnection(remoteUserId);
  }

  // ── Signal handlers ──────────────────────────────────────────────────────────

  async handleOffer(remoteUserId: string, offer: { type: RTCSdpType; sdp: string }): Promise<void> {
    let pc = this.peerConnections.get(remoteUserId);
    if (!pc) pc = await this.createPeerConnection(remoteUserId);

    const collision =
      offer.type === 'offer' &&
      (this.makingOffer.get(remoteUserId) || pc.signalingState !== 'stable');

    // Impolite peer ignores colliding offers; polite peer rolls back and accepts
    this.ignoreOffer.set(remoteUserId, !this.isPolite(remoteUserId) && collision);
    if (this.ignoreOffer.get(remoteUserId)) {
      console.log(`[RTC] Ignoring colliding offer from ${remoteUserId} (impolite)`);
      return;
    }

    try {
      if (collision) await pc.setLocalDescription({ type: 'rollback' });
      await pc.setRemoteDescription(offer);
      this.remoteDescSet.set(remoteUserId, true);

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await sendSignal(this.userId, remoteUserId, this.channelId, {
        type: 'answer',
        answer: pc.localDescription!
      });
      console.log(`[RTC] Sent answer → ${remoteUserId}`);

      await this.drainQueue(remoteUserId);
    } catch (err) {
      console.error('[RTC] handleOffer error:', err);
    }
  }

  async handleAnswer(remoteUserId: string, answer: { type: RTCSdpType; sdp: string }): Promise<void> {
    const pc = this.peerConnections.get(remoteUserId);
    if (!pc || pc.signalingState === 'stable') return;
    try {
      await pc.setRemoteDescription(answer);
      this.remoteDescSet.set(remoteUserId, true);
      console.log(`[RTC] Set answer from ${remoteUserId}`);
      await this.drainQueue(remoteUserId);
    } catch (err) {
      console.error('[RTC] handleAnswer error:', err);
    }
  }

  async handleIceCandidate(remoteUserId: string, candidate: RTCIceCandidateInit): Promise<void> {
    const pc = this.peerConnections.get(remoteUserId);
    if (!pc) return;

    // Queue candidates that arrive before the remote description is set
    if (!this.remoteDescSet.get(remoteUserId)) {
      this.iceCandidateQueue.get(remoteUserId)?.push(candidate);
      console.log(`[RTC] Queued ICE candidate for ${remoteUserId}`);
      return;
    }

    try {
      await pc.addIceCandidate(candidate);
    } catch (err) {
      if (!this.ignoreOffer.get(remoteUserId)) {
        console.error('[RTC] addIceCandidate error:', err);
      }
    }
  }

  private async drainQueue(remoteUserId: string): Promise<void> {
    const pc = this.peerConnections.get(remoteUserId);
    const queue = this.iceCandidateQueue.get(remoteUserId) ?? [];
    if (!pc || queue.length === 0) return;
    console.log(`[RTC] Draining ${queue.length} queued candidates for ${remoteUserId}`);
    for (const c of queue) {
      try { await pc.addIceCandidate(c); } catch (e) { console.error('[RTC] drain error:', e); }
    }
    this.iceCandidateQueue.set(remoteUserId, []);
  }

  // ── Teardown ─────────────────────────────────────────────────────────────────

  removePeerConnection(remoteUserId: string): void {
    const pc = this.peerConnections.get(remoteUserId);
    if (!pc) return;
    pc.close();
    this.peerConnections.delete(remoteUserId);
    this.iceCandidateQueue.delete(remoteUserId);
    this.remoteDescSet.delete(remoteUserId);
    this.makingOffer.delete(remoteUserId);
    this.ignoreOffer.delete(remoteUserId);
    this.onRemoveStream(remoteUserId);
  }

  cleanup(): void {
    this.peerConnections.forEach((pc, uid) => { pc.close(); this.onRemoveStream(uid); });
    this.peerConnections.clear();
    this.iceCandidateQueue.clear();
    this.remoteDescSet.clear();
    this.makingOffer.clear();
    this.ignoreOffer.clear();
    this.localStream?.getTracks().forEach((t) => t.stop());
    this.localStream = null;
    this.screenStream?.getTracks().forEach((t) => t.stop());
    this.screenStream = null;
  }
}
