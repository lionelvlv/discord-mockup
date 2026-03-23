/**
 * GlobalUnreadWatcher — subscribes to recent messages for every channel + DM.
 * Drives unread badges in the sidebar and plays mention sounds.
 *
 * KEY DESIGN DECISIONS:
 * - Uses orderBy(timestamp DESC) + limit(50) to always get the NEWEST 50 messages
 * - Tracks new messages by comparing max timestamp, not array length
 * - Active channel: save lastRead timestamp → watcher recomputes with 0 unread
 * - markRead() in the store zeroes counts immediately for instant UI response
 */
import { useEffect, useRef } from 'react';
import { collection, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { Message } from '../../types/message';
import { updateUnread, markRead } from '../../features/chat/unreadStore';
import { soundManager } from '../../lib/sounds';
import { useAuth } from '../../features/auth/useAuth';

let _activeId: string | null = null;
export function setGlobalActiveId(id: string | null) {
  _activeId = id;
  if (id) saveLastRead(id); // save immediately when navigating to channel
}

export function saveLastRead(id: string) {
  try { localStorage.setItem(`lastRead:${id}`, String(Date.now())); } catch {}
}
function getLastRead(id: string): number {
  try { return parseInt(localStorage.getItem(`lastRead:${id}`) ?? '0', 10); } catch { return 0; }
}

interface WatcherProps {
  channels: { id: string }[];
  dms: { id: string; otherUserId: string }[];
}

export default function GlobalUnreadWatcher({ channels, dms }: WatcherProps) {
  const { user } = useAuth();
  const channelsRef = useRef(channels);
  const dmsRef      = useRef(dms);
  const userRef     = useRef(user);
  channelsRef.current = channels;
  dmsRef.current      = dms;
  userRef.current     = user;

  const subs       = useRef<Map<string, () => void>>(new Map());
  const initSet    = useRef<Set<string>>(new Set());
  const maxTsCache = useRef<Record<string, number>>({});  // max timestamp seen per id

  const processSnapshot = (id: string, isDM: boolean, msgs: Message[]) => {
    const cur = userRef.current;
    if (!cur) return;

    // msgs are DESC-ordered (newest first), so msgs[0] is the latest
    const latestTs = msgs[0]?.timestamp ?? 0;
    const prevMaxTs = maxTsCache.current[id] ?? 0;
    const isInit = !initSet.current.has(id);
    initSet.current.add(id);

    // Active channel: mark read immediately and clear badge
    if (id === _activeId) {
      saveLastRead(id);
      maxTsCache.current[id] = latestTs;
      markRead(id); // instant badge clear
      return;
    }

    const lastRead = getLastRead(id);

    // Detect genuinely new messages (not first load) for sound
    if (!isInit && latestTs > prevMaxTs && latestTs > lastRead) {
      const newMsgs = msgs.filter(m => m.timestamp > prevMaxTs && m.timestamp > lastRead);
      const hasMention = newMsgs.some(m =>
        m.senderId !== cur.id &&
        !m.deleted &&
        (isDM || m.content?.toLowerCase().includes(`@${cur.username?.toLowerCase()}`))
      );
      if (hasMention) soundManager.play('mention', 0.8);
    }

    maxTsCache.current[id] = Math.max(prevMaxTs, latestTs);
    updateUnread(id, msgs, cur.id, cur.username ?? '', lastRead, isDM);
  };

  const subscribeId = (id: string, firestoreQuery: any, isDM: boolean) => {
    if (subs.current.has(id)) return;
    const unsub = onSnapshot(
      firestoreQuery,
      (snap: any) => {
        // DESC order — msgs[0] is newest
        const msgs: Message[] = snap.docs.map((d: any) => ({ id: d.id, ...d.data() } as Message));
        processSnapshot(id, isDM, msgs);
      },
      (err: any) => console.error(`[Unread] snapshot error ${id}:`, err.code, err.message)
    );
    subs.current.set(id, unsub);
  };

  const unsubscribeId = (id: string) => {
    const unsub = subs.current.get(id);
    if (unsub) { unsub(); subs.current.delete(id); }
  };

  useEffect(() => {
    if (!user) return;
    const desired = new Set<string>();

    channels.forEach(ch => {
      desired.add(ch.id);
      subscribeId(ch.id, query(
        collection(db, 'messages'),
        where('channelId', '==', ch.id),
        where('deleted', '==', false),
        orderBy('timestamp', 'desc'),
        limit(50)
      ), false);
    });

    dms.forEach(dm => {
      desired.add(dm.otherUserId);
      subscribeId(dm.otherUserId, query(
        collection(db, 'messages'),
        where('dmId', '==', dm.id),
        where('deleted', '==', false),
        orderBy('timestamp', 'desc'),
        limit(50)
      ), true);
    });

    // Remove stale subscriptions
    subs.current.forEach((_, id) => {
      if (!desired.has(id)) unsubscribeId(id);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id,
      channels.map(c => c.id).join(','),
      dms.map(d => d.id + d.otherUserId).join(',')]);

  useEffect(() => () => { subs.current.forEach(u => u()); subs.current.clear(); }, []);

  return null;
}
