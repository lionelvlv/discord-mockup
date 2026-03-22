import {
  collection,
  addDoc,
  doc,
  onSnapshot,
  query,
  where,
  updateDoc,
  arrayUnion,
  arrayRemove,
  getDoc,
  Unsubscribe,
  deleteDoc,
  getDocs,
  limit,
  setDoc
} from 'firebase/firestore';
import { ref as rtdbRef, onValue, off, set, remove, onDisconnect } from 'firebase/database';
import { db, rtdb } from '../../config/firebase';
import { VoiceChannel, SignalingData } from '../../types/voice';

// ─── Participant presence ────────────────────────────────────────────────────

// Join a voice channel. Writes to Firestore and registers an RTDB onDisconnect
// so the user is removed even if the tab is closed or the connection drops.
// Also subscribes to .info/connected to re-register presence on reconnect —
// without this, a brief RTDB disconnect (which happens on every page navigation)
// fires the onDisconnect and removes the user from the channel silently.
// Returns a cleanup function to call on intentional leave.
export const joinVoiceChannel = async (
  channelId: string,
  userId: string
): Promise<() => Promise<void>> => {
  // Firestore participant list — source of truth for the sidebar
  const voiceRef = doc(db, 'voiceChannels', channelId);
  const voiceSnap = await getDoc(voiceRef);
  if (!voiceSnap.exists()) {
    await setDoc(voiceRef, { channelId, participants: [userId] });
  } else {
    await updateDoc(voiceRef, { participants: arrayUnion(userId) });
  }

  const presenceRef = rtdbRef(rtdb, `voicePresence/${channelId}/${userId}`);
  const connectedRef = rtdbRef(rtdb, '.info/connected');

  // Set initial presence
  await set(presenceRef, true);
  await onDisconnect(presenceRef).remove();

  // Re-register presence whenever RTDB reconnects.
  // RTDB briefly disconnects on every page navigation in SPAs; without this
  // the onDisconnect fires and the user silently disappears from the channel.
  const connectedHandler = onValue(connectedRef, async (snap) => {
    if (!snap.val()) return; // disconnected — onDisconnect will handle cleanup
    // Reconnected: re-register server-side cleanup and re-assert presence
    await onDisconnect(presenceRef).remove();
    await set(presenceRef, true);
  });

  return async () => {
    // Tear down the reconnect listener first
    off(connectedRef, 'value', connectedHandler);
    await onDisconnect(presenceRef).cancel();
    await remove(presenceRef);
    await leaveVoiceChannel(channelId, userId);
  };
};

export const leaveVoiceChannel = async (channelId: string, userId: string): Promise<void> => {
  const voiceRef = doc(db, 'voiceChannels', channelId);
  const voiceSnap = await getDoc(voiceRef);
  if (voiceSnap.exists()) {
    await updateDoc(voiceRef, { participants: arrayRemove(userId) });
  }
};

// Subscribe to Firestore participant list (sidebar + peer connection management)
export const subscribeToVoiceChannel = (
  channelId: string,
  callback: (participants: string[]) => void
): Unsubscribe => {
  const voiceRef = doc(db, 'voiceChannels', channelId);
  return onSnapshot(voiceRef, (snap) => {
    callback(snap.exists() ? (snap.data() as VoiceChannel).participants || [] : []);
  });
};

// Subscribe to RTDB presence — detects hard disconnects (tab close, crash)
// faster than waiting for Firestore to catch up.
export const subscribeToVoicePresence = (
  channelId: string,
  onPresenceChange: (connectedUserIds: Set<string>) => void
): (() => void) => {
  const channelRef = rtdbRef(rtdb, `voicePresence/${channelId}`);
  const handler = onValue(channelRef, (snap) => {
    const data = snap.val() as Record<string, boolean> | null;
    onPresenceChange(new Set(data ? Object.keys(data) : []));
  });
  return () => off(channelRef, 'value', handler);
};

// ─── Admin actions ───────────────────────────────────────────────────────────

export const kickFromVoiceChannel = async (
  channelId: string,
  userIdToKick: string,
  adminId: string
): Promise<void> => {
  const adminSnap = await getDoc(doc(db, 'users', adminId));
  if (!adminSnap.exists() || !adminSnap.data().isAdmin) {
    throw new Error('Only admins can kick users from voice channels');
  }
  const voiceRef = doc(db, 'voiceChannels', channelId);
  const voiceSnap = await getDoc(voiceRef);
  if (voiceSnap.exists()) {
    await updateDoc(voiceRef, { participants: arrayRemove(userIdToKick) });
    await addDoc(collection(db, 'signaling'), {
      from: adminId,
      to: userIdToKick,
      channelId,
      type: 'kick',
      timestamp: Date.now()
    });
  }
  await remove(rtdbRef(rtdb, `voicePresence/${channelId}/${userIdToKick}`));
};

export const kickFromAllVoiceChannels = async (userId: string): Promise<void> => {
  const snap = await getDocs(collection(db, 'voiceChannels'));
  await Promise.all(
    snap.docs.map(async (d) => {
      const data = d.data() as VoiceChannel;
      if (data.participants?.includes(userId)) {
        await updateDoc(d.ref, { participants: arrayRemove(userId) });
      }
    })
  );
};

// ─── WebRTC signaling ────────────────────────────────────────────────────────

// Serialize SDP to a plain object before writing to Firestore.
// Firestore rejects RTCSessionDescription class instances.
const serializeSdp = (desc: RTCSessionDescription | RTCSessionDescriptionInit) => ({
  type: desc.type as RTCSdpType,
  sdp: desc.sdp ?? ''
});

export const sendSignal = async (
  from: string,
  to: string,
  channelId: string,
  data: {
    type: 'offer' | 'answer' | 'ice-candidate' | 'kick';
    offer?: RTCSessionDescription | RTCSessionDescriptionInit;
    answer?: RTCSessionDescription | RTCSessionDescriptionInit;
    candidate?: RTCIceCandidateInit;
  }
): Promise<void> => {
  await addDoc(collection(db, 'signaling'), {
    from,
    to,
    channelId,
    type: data.type,
    offer: data.offer ? serializeSdp(data.offer) : null,
    answer: data.answer ? serializeSdp(data.answer) : null,
    candidate: data.candidate ?? null,
    timestamp: Date.now()
  });
};

export const subscribeToSignals = (
  userId: string,
  channelId: string,
  callback: (signal: SignalingData) => void
): Unsubscribe => {
  // NOTE: No orderBy here — adding orderBy(timestamp) requires a composite index
  // (to, channelId, timestamp) in Firestore. We sort client-side instead so the
  // subscription works immediately without waiting for the index to build.
  const q = query(
    collection(db, 'signaling'),
    where('to', '==', userId),
    where('channelId', '==', channelId),
    limit(50)
  );
  return onSnapshot(q, (snap) => {
    // Sort added signals by timestamp ascending before processing
    const added = snap.docChanges()
      .filter((c) => c.type === 'added')
      .sort((a, b) => (a.doc.data().timestamp ?? 0) - (b.doc.data().timestamp ?? 0));

    added.forEach(async (change) => {
      const signal = { id: change.doc.id, ...change.doc.data() } as SignalingData;
      callback(signal);
      // Delete immediately after reading so signals don't replay on reconnect
      await deleteDoc(doc(db, 'signaling', change.doc.id)).catch((err) => {
        console.warn('[Voice] Could not delete signaling doc:', err);
      });
    });
  }, (err) => {
    console.error('[Voice] subscribeToSignals error:', err);
  });
};

export const cleanupSignals = async (channelId: string): Promise<void> => {
  const q = query(collection(db, 'signaling'), where('channelId', '==', channelId));
  const snap = await getDocs(q);
  await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
};