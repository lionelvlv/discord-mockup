import { useEffect, useRef } from 'react';
import { collection, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { Message } from '../../types/message';
import { updateUnread } from '../../features/chat/unreadStore';
import { soundManager } from '../../lib/sounds';
import { useAuth } from '../../features/auth/useAuth';

let _activeId: string | null = null;
export function setGlobalActiveId(id: string | null) {
  console.log(`[Unread] setGlobalActiveId: ${id}`);
  _activeId = id;
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
  const userRef     = useRef(user);
  userRef.current   = user;

  const subs        = useRef<Map<string, () => void>>(new Map());
  const initSet     = useRef<Set<string>>(new Set());
  const prevCounts  = useRef<Record<string, number>>({});

  const processSnapshot = (id: string, isDM: boolean, label: string, msgs: Message[]) => {
    const cur = userRef.current;
    if (!cur) { console.log(`[Unread] processSnapshot ${label}: no user`); return; }

    const isInit = !initSet.current.has(id);
    const prev   = prevCounts.current[id] ?? msgs.length;
    initSet.current.add(id);
    prevCounts.current[id] = msgs.length;

    console.log(`[Unread] snapshot ${label} id=${id} isDM=${isDM} isInit=${isInit} msgs=${msgs.length} prev=${prev} activeId=${_activeId}`);

    if (id === _activeId) {
      saveLastRead(id);
      updateUnread(id, msgs, cur.id, cur.username ?? '', Date.now(), isDM);
      return;
    }

    const lastRead = getLastRead(id);
    let hasNewMention = false;

    if (!isInit && msgs.length > prev) {
      const newMsgs = msgs.slice(prev);
      console.log(`[Unread] ${label}: ${newMsgs.length} new msgs, checking for mentions (isDM=${isDM})`);
      newMsgs.forEach(m => {
        console.log(`[Unread]   msg from=${m.senderId} cur=${cur.id} deleted=${m.deleted} ts=${m.timestamp} lastRead=${lastRead} content="${m.content}"`);
      });
      hasNewMention = newMsgs.some(m =>
        m.senderId !== cur.id &&
        !m.deleted &&
        m.timestamp > lastRead &&
        (isDM || m.content?.toLowerCase().includes(`@${cur.username?.toLowerCase()}`))
      );
      console.log(`[Unread] ${label}: hasNewMention=${hasNewMention}`);
    }

    updateUnread(id, msgs, cur.id, cur.username ?? '', lastRead, isDM);
    if (hasNewMention) {
      console.log(`[Unread] 🔔 Playing mention sound for ${label}`);
      soundManager.play('mention', 0.8);
    }
  };

  // Watch one channel/DM — skips if already subscribed
  const subscribeId = (id: string, label: string, firestoreQuery: any, isDM: boolean) => {
    if (subs.current.has(id)) {
      console.log(`[Unread] already subscribed to ${label} (${id})`);
      return;
    }
    console.log(`[Unread] subscribing to ${label} (${id}) isDM=${isDM}`);
    const unsub = onSnapshot(
      firestoreQuery,
      (snap: any) => {
        // ASC order → docs are already oldest-first, no reverse needed
        const msgs: Message[] = snap.docs.map((d: any) => ({ id: d.id, ...d.data() } as Message));
        processSnapshot(id, isDM, label, msgs);
      },
      (err: any) => console.error(`[Unread] ❌ snapshot error for ${label}:`, err)
    );
    subs.current.set(id, unsub);
  };

  // Reconcile: add new subscriptions, remove stale ones
  useEffect(() => {
    if (!user) { console.log('[Unread] no user, skipping'); return; }
    console.log(`[Unread] reconcile: ${channels.length} channels, ${dms.length} DMs`);

    const desired = new Set<string>();

    channels.forEach(ch => {
      desired.add(ch.id);
      subscribeId(ch.id, `#${ch.id}`, query(
        collection(db, 'messages'),
        where('channelId', '==', ch.id),
        where('deleted', '==', false),
        orderBy('timestamp', 'asc'),
        limit(50)
      ), false);
    });

    dms.forEach(dm => {
      const key = dm.otherUserId;
      desired.add(key);
      console.log(`[Unread] DM: id=${dm.id} otherUserId=${dm.otherUserId} key=${key}`);
      // Use ASC + limit — the existing (dmId, deleted, timestamp ASC) index covers this.
      // We reverse() after fetching to get newest-last order for processSnapshot.
      subscribeId(key, `DM:${key}`, query(
        collection(db, 'messages'),
        where('dmId', '==', dm.id),
        where('deleted', '==', false),
        orderBy('timestamp', 'asc'),
        limit(50)
      ), true);
    });

    // Remove stale
    subs.current.forEach((_, id) => {
      if (!desired.has(id)) {
        console.log(`[Unread] removing stale subscription ${id}`);
        const unsub = subs.current.get(id);
        if (unsub) { unsub(); subs.current.delete(id); }
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, channels.map(c => c.id).join(','), dms.map(d => d.id + d.otherUserId).join(',')]);

  useEffect(() => {
    return () => { subs.current.forEach(u => u()); subs.current.clear(); };
  }, []);

  return null;
}
