/**
 * GlobalUnreadWatcher — subscribes to recent messages for every channel + DM.
 * Drives unread badges in the sidebar and plays mention sounds.
 */
import { useEffect, useRef } from 'react';
import { collection, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { Message } from '../../types/message';
import { updateUnread } from '../../features/chat/unreadStore';
import { soundManager } from '../../lib/sounds';
import { useAuth } from '../../features/auth/useAuth';

let _activeId: string | null = null;
export function setGlobalActiveId(id: string | null) { _activeId = id; }

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

  // Stable refs so the effect doesn't need to re-run when lists update
  const channelsRef = useRef(channels);
  const dmsRef      = useRef(dms);
  const userRef     = useRef(user);
  channelsRef.current = channels;
  dmsRef.current      = dms;
  userRef.current     = user;

  // Per-subscription state — stable across re-renders
  const subs       = useRef<Map<string, () => void>>(new Map());  // key → unsub
  const initSet    = useRef<Set<string>>(new Set());              // ids we've loaded once
  const prevCounts = useRef<Record<string, number>>({});

  const processSnapshot = (id: string, isDM: boolean, msgs: Message[]) => {
    const cur  = userRef.current;
    if (!cur) return;

    const isInit  = !initSet.current.has(id);
    const prev    = prevCounts.current[id] ?? msgs.length;
    initSet.current.add(id);
    prevCounts.current[id] = msgs.length;

    // Active channel: save last-read, compute with now so no badge, keep mention IDs for IO
    if (id === _activeId) {
      saveLastRead(id);
      updateUnread(id, msgs, cur.id, cur.username ?? '', Date.now(), isDM);
      return;
    }

    const lastRead = getLastRead(id);
    let hasNewMention = false;

    if (!isInit && msgs.length > prev) {
      // Only check truly new messages for sound
      const newMsgs = msgs.slice(prev);
      hasNewMention = newMsgs.some(m =>
        m.senderId !== cur.id &&
        !m.deleted &&
        m.timestamp > lastRead &&
        (isDM || m.content?.toLowerCase().includes(`@${cur.username?.toLowerCase()}`))
      );
    }

    updateUnread(id, msgs, cur.id, cur.username ?? '', lastRead, isDM);
    if (hasNewMention) soundManager.play('mention', 0.8);
  };

  const subscribeId = (id: string, firestoreQuery: any, isDM: boolean) => {
    if (subs.current.has(id)) return; // already subscribed
    const unsub = onSnapshot(firestoreQuery, (snap: any) => {
      const msgs: Message[] = snap.docs
        .map((d: any) => ({ id: d.id, ...d.data() } as Message))
        .reverse();
      processSnapshot(id, isDM, msgs);
    }, () => {});
    subs.current.set(id, unsub);
  };

  const unsubscribeId = (id: string) => {
    const unsub = subs.current.get(id);
    if (unsub) { unsub(); subs.current.delete(id); }
  };

  // Reconcile subscriptions when lists change — add new, remove stale
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
      // Key by otherUserId — matches what ChannelPage/DMPage use for setGlobalActiveId + saveLastRead
      const key = dm.otherUserId;
      desired.add(key);
      subscribeId(key, query(
        collection(db, 'messages'),
        where('dmId', '==', dm.id),
        where('deleted', '==', false),
        orderBy('timestamp', 'desc'),
        limit(50)
      ), true);
    });

    // Remove stale subscriptions (closed DMs, deleted channels)
    subs.current.forEach((_, id) => {
      if (!desired.has(id)) unsubscribeId(id);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, channels.length, dms.length,
      channels.map(c => c.id).join(','),
      dms.map(d => d.id).join(',')]);

  // Cleanup on unmount
  useEffect(() => {
    return () => { subs.current.forEach(unsub => unsub()); subs.current.clear(); };
  }, []);

  return null;
}
