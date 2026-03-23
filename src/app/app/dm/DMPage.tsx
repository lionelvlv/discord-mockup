import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../../../features/auth/useAuth';
import { getOrCreateDM, markDMSeen } from '../../../features/chat/dmApi';
import { subscribeToDMMessages, sendMessage, getTypingUsers } from '../../../features/chat/api';
import { Message, Attachment } from '../../../types/message';
import { User } from '../../../types/user';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../../config/firebase';
import ChannelHeader from '../../../components/layout/ChannelHeader';
import MessageList from '../../../components/chat/MessageList';
import MessageComposer from '../../../components/chat/MessageComposer';
import TypingIndicator from '../../../components/chat/TypingIndicator';
import './dm.css';

// Module-level DM message cache — same pattern as ChannelPage
const dmMessageCache = new Map<string, Message[]>();

const DMPage: React.FC = () => {
  const { userId } = useParams<{ userId: string }>();
  const { user: currentUser } = useAuth();
  const [messages, setMessages] = useState<Message[]>(() => dmMessageCache.get(userId ?? '') ?? []);
  // Real-time user subscription so deleted/renamed users update live.
  const [otherUser, setOtherUser] = useState<User | null | 'loading'>('loading');
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [dmId, setDmId] = useState<string>('');
  // Ref so the storage event handler always reads the current dmId without
  // needing to be recreated (avoids stale closure over the initial empty string)
  const dmIdRef = useRef<string>('');

  // Subscribe to the other user's Firestore doc in real-time.
  // This handles: user gets deleted mid-conversation, username/avatar changes, etc.
  useEffect(() => {
    if (!userId) return;
    console.log(`[DMPage] Subscribing to user doc ${userId}`);
    const unsub = onSnapshot(doc(db, 'users', userId), (snap) => {
      if (snap.exists()) {
        setOtherUser({ id: snap.id, ...snap.data() } as User);
      } else {
        console.warn(`[DMPage] User ${userId} not found in Firestore`);
        setOtherUser(null);
      }
    });
    return () => unsub();
  }, [userId]);

  useEffect(() => {
    if (!userId || !currentUser) return;

    let unsubMessages: (() => void) | null = null;
    let typingInterval: ReturnType<typeof setInterval> | null = null;

    const init = async () => {
      console.log(`[DMPage] Opening DM with ${userId}`);
      const dm = await getOrCreateDM(currentUser.id, userId);
      // Keep both state and ref in sync so renders and event handlers both work
      setDmId(dm.id);
      dmIdRef.current = dm.id;
      await markDMSeen(dm.id, currentUser.id);

      unsubMessages = subscribeToDMMessages(dm.id, (msgs) => {
        dmMessageCache.set(userId ?? '', msgs);
        setMessages(msgs);
        markDMSeen(dm.id, currentUser.id);
      });

      const loadTyping = () => {
        const typing = getTypingUsers(undefined, dm.id);
        setTypingUsers(typing.filter((id) => id !== currentUser.id));
      };
      loadTyping();
      typingInterval = setInterval(loadTyping, 1000);
    };

    init();

    // Use dmIdRef.current — NOT the dmId state — so this handler is never stale
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'retrochord_typing' && dmIdRef.current) {
        const typing = getTypingUsers(undefined, dmIdRef.current);
        setTypingUsers(typing.filter((id) => id !== currentUser.id));
      }
    };
    window.addEventListener('storage', handleStorage);

    return () => {
      unsubMessages?.();
      if (typingInterval) clearInterval(typingInterval);
      window.removeEventListener('storage', handleStorage);
      dmIdRef.current = '';
    };
  }, [userId, currentUser?.id]);

  const handleSendMessage = async (content: string, attachments?: Attachment[]) => {
    if (currentUser && dmId) {
      await sendMessage(currentUser.id, content, undefined, dmId, attachments, currentUser.username);
      await markDMSeen(dmId, currentUser.id);
    }
  };

  if (otherUser === 'loading') {
    return (
      <div className="dm-page">
        <div className="dm-error">Loading...</div>
      </div>
    );
  }

  // Deleted users: show history but disable composer
  const isDeleted = otherUser?.isDeleted ?? true;
  const displayUser = otherUser ?? {
    id: userId ?? '',
    username: 'Deleted User',
    avatarUrl: '💀',
    bio: '',
    presence: 'offline' as const,
    isAdmin: false,
    isDeleted: true,
    email: '',
  };

  return (
    <div className="dm-page">
      <ChannelHeader
        name={`@${displayUser.username}`}
        description={isDeleted ? '⚠️ This user has been deleted' : (displayUser.bio || 'Direct message')}
      />
      <div className="dm-content">
        <MessageList messages={messages} />
        <TypingIndicator userIds={typingUsers} />
        {!isDeleted && <MessageComposer onSend={handleSendMessage} dmId={dmId} />}
        {isDeleted && (
          <div className="dm-deleted-notice">
            This user has been deleted. Message history is read-only.
          </div>
        )}
      </div>
    </div>
  );
};

export default DMPage;
