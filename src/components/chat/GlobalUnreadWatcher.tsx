/**
 * GlobalUnreadWatcher — mounts once in AppLayout, subscribes to the last 50
 * messages of every text channel + every DM the current user has open.
 * Updates the unread store and plays the mention sound.
 * This is the ONLY place unread state is computed; MessageList no longer does it.
 */
import { useEffect, useRef } from 'react';
import {
  collection, onSnapshot, query, where, orderBy, limit
} from 'firebase/firestore';
import { db } from '../../config/firebase';
import { Message } from '../../types/message';
import { updateUnread, markRead } from '../../features/chat/unreadStore';
import { soundManager } from '../../lib/sounds';
import { useAuth } from '../../features/auth/useAuth';

// The currently viewed channel/DM id — set by ChannelPage/DMPage
let _activeId: string | null = null;
export function setGlobalActiveId(id: string | null) { _activeId = id; }

function getLastRead(id: string): number {
  try { return parseInt(localStorage.getItem(`lastRead:${id}`) ?? '0', 10); } catch { return 0; }
}
export function saveLastRead(id: string) {
  try { localStorage.setItem(`lastRead:${id}`, String(Date.now())); } catch {}
}

interface WatcherProps {
  channels: { id: string }[];
  dms: { id: string; otherUserId: string }[];
}

export default function GlobalUnreadWatcher({ channels, dms }: WatcherProps) {
  const { user } = useAuth();
  const initialisedIds = useRef(new Set<string>());
  const prevCounts     = useRef<Record<string, number>>({});

  useEffect(() => {
    if (!user) return;
    const uid      = user.id;
    const username = user.username?.toLowerCase() ?? '';
    const unsubs: (() => void)[] = [];

    const watch = (id: string, q: ReturnType<typeof query>) => {
      const unsub = onSnapshot(q, snap => {
        const msgs: Message[] = snap.docs.map(d => ({ id: d.id, ...(d.data() as Record<string, unknown>) } as Message)).reverse();
        const isInit = !initialisedIds.current.has(id);
        const prev   = prevCounts.current[id] ?? msgs.length;
        initialisedIds.current.add(id);
        prevCounts.current[id] = msgs.length;

        // If this is the active channel, mark it read and skip badge
        if (id === _activeId) {
          saveLastRead(id);
          markRead(id);
          return;
        }

        const lastRead = getLastRead(id);
        let unread = 0, mentions = 0, hasNewMention = false;

        msgs.forEach((m, i) => {
          if (m.senderId === uid || m.deleted || m.timestamp <= lastRead) return;
          unread++;
          const isMention = m.content?.toLowerCase().includes(`@${username}`);
          if (isMention) {
            mentions++;
            if (!isInit && i >= prev) hasNewMention = true;
          }
        });

        updateUnread(id, msgs, uid, user.username ?? '', lastRead);
        if (hasNewMention) soundManager.play('mention', 0.8);
      }, () => {/* ignore permission errors on channels not yet readable */});
      unsubs.push(unsub);
    };

    // Watch all text channels
    channels.forEach(ch => {
      watch(ch.id, query(
        collection(db, 'messages'),
        where('channelId', '==', ch.id),
        where('deleted', '==', false),
        orderBy('timestamp', 'desc'),
        limit(50)
      ));
    });

    // Watch all DMs, keyed by otherUserId (matches DMPage's markRead call)
    dms.forEach(dm => {
      watch(dm.otherUserId, query(
        collection(db, 'messages'),
        where('dmId', '==', dm.id),
        where('deleted', '==', false),
        orderBy('timestamp', 'desc'),
        limit(50)
      ));
    });

    return () => unsubs.forEach(u => u());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, channels.map(c => c.id).join(','), dms.map(d => d.id).join(',')]);

  return null; // renders nothing
}
