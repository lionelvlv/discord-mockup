import { useEffect } from 'react';
import {
  collection, onSnapshot, query, where, orderBy, limit
} from 'firebase/firestore';
import { db } from '../../config/firebase';
import { Message } from '../../types/message';
import { User } from '../../types/user';
import { Channel } from '../../types/channel';
import { updateUnread, markRead } from './unreadStore';
import { soundManager } from '../../lib/sounds';

// Track which channel/DM is currently active so we auto-markRead it
let activeChannelId: string | null = null;
export function setActiveChannelId(id: string | null) { activeChannelId = id; }

// Per-channel last snapshot size — detect truly new messages vs initial load
const prevCounts: Record<string, number> = {};
// First-load flag per channel — don't play sounds on initial subscription
const initialised = new Set<string>();

function getLastRead(id: string): number {
  try { return parseInt(localStorage.getItem(`lastRead:${id}`) ?? '0', 10); } catch { return 0; }
}
function setLastRead(id: string, ts: number) {
  try { localStorage.setItem(`lastRead:${id}`, String(ts)); } catch {}
}

/**
 * Call this once at the AppLayout level.
 * Subscribes to the last 50 messages of every text channel and the user's active DMs,
 * updates the unread store, and plays the mention sound when a new @mention arrives.
 */
export function useGlobalUnread(
  currentUser: User | null,
  channels: Channel[],
  dmList: { id: string; otherUserId: string }[]
) {
  useEffect(() => {
    if (!currentUser) return;
    const uid      = currentUser.id;
    const username = currentUser.username?.toLowerCase() ?? '';
    const unsubs: (() => void)[] = [];

    const processMessages = (id: string, msgs: Message[]) => {
      const lastRead = getLastRead(id);

      // If this is the currently active channel, mark it read immediately
      if (id === activeChannelId) {
        const now = Date.now();
        setLastRead(id, now);
        markRead(id);
        prevCounts[id] = msgs.length;
        initialised.add(id);
        return;
      }

      const prev = prevCounts[id] ?? msgs.length;
      const isInitial = !initialised.has(id);
      initialised.add(id);
      prevCounts[id] = msgs.length;

      let unread = 0;
      let mentions = 0;
      let hasNewMention = false;

      for (let i = 0; i < msgs.length; i++) {
        const m = msgs[i];
        if (m.senderId === uid || m.deleted) continue;
        if (m.timestamp <= lastRead) continue;
        unread++;
        if (m.content?.toLowerCase().includes(`@${username}`)) {
          mentions++;
          // Sound only for genuinely new messages (not initial load)
          if (!isInitial && i >= prev) hasNewMention = true;
        }
      }

      updateUnread(id, msgs, uid, currentUser.username ?? '', lastRead);
      if (hasNewMention) soundManager.play('mention', 0.8);
    };

    // Subscribe to each text channel's last 50 messages
    channels.forEach(ch => {
      const q = query(
        collection(db, 'messages'),
        where('channelId', '==', ch.id),
        where('deleted', '==', false),
        orderBy('timestamp', 'desc'),
        limit(50)
      );
      const unsub = onSnapshot(q, snap => {
        const msgs = snap.docs
          .map(d => ({ id: d.id, ...d.data() } as Message))
          .reverse(); // oldest first
        processMessages(ch.id, msgs);
      }, () => {});
      unsubs.push(unsub);
    });

    // Subscribe to each DM's last 50 messages
    dmList.forEach(dm => {
      const q = query(
        collection(db, 'messages'),
        where('dmId', '==', dm.id),
        where('deleted', '==', false),
        orderBy('timestamp', 'desc'),
        limit(50)
      );
      const unsub = onSnapshot(q, snap => {
        const msgs = snap.docs
          .map(d => ({ id: d.id, ...d.data() } as Message))
          .reverse();
        // Key by otherUserId so markRead(otherUserId) works from DMPage
        processMessages(dm.otherUserId, msgs);
      }, () => {});
      unsubs.push(unsub);
    });

    return () => unsubs.forEach(u => u());
  // Re-subscribe when channels or DMs list changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id, channels.length, dmList.length]);
}
