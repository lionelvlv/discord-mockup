import React, { useRef, useEffect, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { Message } from '../../types/message';
import { User } from '../../types/user';
import { soundManager } from '../../lib/sounds';
import MessageItem from './MessageItem';
import './MessageList.css';

interface MessageListProps {
  messages: Message[];
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
function MessageList({ messages, highlightMessageId, onHighlightClear }: MessageListProps) {
  const listRef              = useRef<HTMLDivElement>(null);
  const messageRefs          = useRef<Map<string, HTMLDivElement>>(new Map());
  const prevMessageCount     = useRef(messages.length);
  const isInitialLoad        = useRef(true);
  const didScrollToHighlight = useRef(false);
  const [flashId, setFlashId] = useState<string | undefined>(undefined);
  const usersById = useSharedUsers();

  // Scroll handling: instant on first load, smooth only for genuinely new messages
  useEffect(() => {
    if (highlightMessageId) return; // highlight scroll handles this case

    const list = listRef.current;
    if (!list) return;

    const isNewMessage = messages.length > prevMessageCount.current && prevMessageCount.current > 0;

    if (isInitialLoad.current) {
      // Instant jump to bottom — no animation, feels snappy
      list.scrollTop = list.scrollHeight;
      isInitialLoad.current = false;
    } else if (isNewMessage) {
      // Only smooth-scroll if user is already near the bottom
      const distFromBottom = list.scrollHeight - list.scrollTop - list.clientHeight;
      if (distFromBottom < 200) {
        list.scrollTop = list.scrollHeight;
      }
      soundManager.play('message', 0.5);
    }

    prevMessageCount.current = messages.length;
  }, [messages, highlightMessageId]);

  // Reset on channel switch
  useEffect(() => {
    isInitialLoad.current = true;
    prevMessageCount.current = 0;
  }, []); // empty dep = per mount; parent remounts on channel change

  // Scroll to highlighted message
  useEffect(() => {
    if (!highlightMessageId || didScrollToHighlight.current) return;
    const el = messageRefs.current.get(highlightMessageId);
    if (!el) return;
    didScrollToHighlight.current = true;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setFlashId(highlightMessageId);
    setTimeout(() => { setFlashId(undefined); onHighlightClear?.(); }, 3000);
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
