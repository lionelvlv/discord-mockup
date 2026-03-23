import React, { useRef, useEffect, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { Message } from '../../types/message';
import { User } from '../../types/user';
import { soundManager } from '../../lib/sounds';
import { updateUnread, markRead } from '../../features/chat/unreadStore';
import { useAuth } from '../../features/auth/useAuth';
import MessageItem from './MessageItem';
import './MessageList.css';

interface MessageListProps {
  messages: Message[];
  channelOrDMId?: string;   // used to track unread state
  highlightMessageId?: string;
  onHighlightClear?: () => void;
}

// ── Shared user cache ─────────────────────────────────────────────────────────
// Shared across all MessageList instances (channel + DM).
// Avoids N redundant Firestore subscriptions when switching channels.
let sharedUsersById: Map<string, User> = new Map();
const userCacheListeners = new Set<() => void>();
let userCacheUnsub: (() => void) | null = null;

function ensureUserSubscription() {
  if (userCacheUnsub) return;
  userCacheUnsub = onSnapshot(collection(db, 'users'), (snap) => {
    const map = new Map<string, User>();
    snap.docs.forEach((d) => map.set(d.id, { id: d.id, ...d.data() } as User));
    sharedUsersById = map;
    userCacheListeners.forEach(fn => fn());
  });
}

function useSharedUsers() {
  const [users, setUsers] = useState<Map<string, User>>(sharedUsersById);
  useEffect(() => {
    ensureUserSubscription();
    const notify = () => setUsers(new Map(sharedUsersById));
    userCacheListeners.add(notify);
    return () => { userCacheListeners.delete(notify); };
  }, []);
  return users;
}

// ── Component ─────────────────────────────────────────────────────────────────
function MessageList({ messages, channelOrDMId, highlightMessageId, onHighlightClear }: MessageListProps) {
  const listRef              = useRef<HTMLDivElement>(null);
  const messageRefs          = useRef<Map<string, HTMLDivElement>>(new Map());
  const prevMessageCount     = useRef(messages.length);
  const isInitialLoad        = useRef(true);
  const didScrollToHighlight = useRef(false);
  const [flashId, setFlashId] = useState<string | undefined>(undefined);
  const usersById = useSharedUsers();
  const { user: currentUser } = useAuth();

  // Persist last-read timestamps so unread state survives page reload
  const lastReadRef = useRef<number>(() => {
    if (!channelOrDMId) return 0;
    try { return parseInt(localStorage.getItem(`lastRead:${channelOrDMId}`) ?? '0', 10); } catch { return 0; }
  })();

  // Mark read when viewing this channel — save timestamp to localStorage
  useEffect(() => {
    if (!channelOrDMId) return;
    const now = Date.now();
    lastReadRef.current = now;
    try { localStorage.setItem(`lastRead:${channelOrDMId}`, String(now)); } catch {}
    markRead(channelOrDMId);
  }, [channelOrDMId]);

  // Update unread store and play mention sound immediately when new @mention arrives
  useEffect(() => {
    if (!currentUser || !channelOrDMId) return;

    const prevCount = prevMessageCount.current;
    const isNewMessage = messages.length > prevCount && prevCount > 0;

    if (isNewMessage) {
      // New messages that mention current user → immediate sound
      const newMsgs = messages.slice(prevCount);
      const hasMention = newMsgs.some(m =>
        m.senderId !== currentUser.id &&
        !m.deleted &&
        m.content?.toLowerCase().includes(`@${currentUser.username?.toLowerCase()}`)
      );
      if (hasMention) {
        soundManager.play('mention', 0.8);
      }
    }

    // Always sync unread store — drives badges in sidebar
    updateUnread(channelOrDMId, messages, currentUser.id, currentUser.username ?? '', lastReadRef.current);
    prevMessageCount.current = messages.length;
  }, [messages, currentUser, channelOrDMId]);

  // Scroll handling: instant on first load, smooth only for genuinely new messages
  useEffect(() => {
    if (highlightMessageId) return; // highlight scroll handles this case

    const list = listRef.current;
    if (!list) return;

    const isNewMessage = messages.length > prevMessageCount.current && prevMessageCount.current > 0;

    if (isInitialLoad.current) {
      list.scrollTop = list.scrollHeight;
      isInitialLoad.current = false;
    } else if (isNewMessage) {
      const distFromBottom = list.scrollHeight - list.scrollTop - list.clientHeight;
      if (distFromBottom < 200) {
        list.scrollTop = list.scrollHeight;
      }
    }

  }, [messages, highlightMessageId]);

  // Reset on channel switch
  useEffect(() => {
    isInitialLoad.current = true;
    prevMessageCount.current = 0;
  }, []); // empty dep = per mount; parent remounts on channel change

  // Scroll to highlighted message — scroll within the list container,
  // never use scrollIntoView which moves the browser viewport on mobile
  useEffect(() => {
    if (!highlightMessageId || didScrollToHighlight.current) return;
    const el = messageRefs.current.get(highlightMessageId);
    const list = listRef.current;
    if (!el || !list) return;
    didScrollToHighlight.current = true;

    requestAnimationFrame(() => {
      // Calculate position relative to the scrollable list container
      const listTop  = list.getBoundingClientRect().top;
      const elTop    = el.getBoundingClientRect().top;
      const offset   = elTop - listTop + list.scrollTop;
      const center   = offset - list.clientHeight / 2 + el.clientHeight / 2;
      list.scrollTo({ top: Math.max(0, center), behavior: 'smooth' });

      setFlashId(highlightMessageId);
      setTimeout(() => { setFlashId(undefined); onHighlightClear?.(); }, 3000);
    });
  }, [messages, highlightMessageId, onHighlightClear]);

  useEffect(() => { didScrollToHighlight.current = false; }, [highlightMessageId]);

  const DELETED_PLACEHOLDER: User = {
    id: '', username: 'Deleted User', avatarUrl: '💀',
    email: '', bio: '', presence: 'offline', isDeleted: true,
  };

  return (
    <div className="message-list" ref={listRef}>
      {messages.map((message) => {
        const sender = usersById.get(message.senderId) ?? { ...DELETED_PLACEHOLDER, id: message.senderId };
        return (
          <div
            key={message.id}
            ref={el => { if (el) messageRefs.current.set(message.id, el); else messageRefs.current.delete(message.id); }}
            className={flashId === message.id ? 'message-highlight-flash' : ''}
          >
            <MessageItem message={message} sender={sender} />
          </div>
        );
      })}
      {/* Invisible anchor — kept for programmatic use if needed */}
      <div style={{ height: 1 }} />
    </div>
  );
}

export default MessageList;
