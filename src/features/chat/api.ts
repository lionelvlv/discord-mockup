import { 
  collection, 
  addDoc, 
  query, 
  where, 
  orderBy, 
  onSnapshot,
  updateDoc,
  doc,
  getDocs,
  getDoc,
  Unsubscribe,
  runTransaction,
  limit
} from 'firebase/firestore';
import { db } from '../../config/firebase';
import { Message, Attachment, Reaction } from '../../types/message';
import { storage } from '../../lib/storage';

export const sendMessage = async (
  senderId: string,
  content: string,
  channelId?: string,
  dmId?: string,
  attachments?: Attachment[],
  senderUsername?: string,
  channelName?: string
): Promise<Message> => {
  const messageData = {
    senderId,
    content,
    channelId: channelId || null,
    dmId: dmId || null,
    timestamp: Date.now(),
    deleted: false,
    reactions: [],
    attachments: attachments && attachments.length > 0 ? attachments : [],
  };

  const docRef = await addDoc(collection(db, 'messages'), messageData);

  // Fire-and-forget mention notifications
  if (content.includes('@') && senderUsername) {
    createMentionNotifications(
      docRef.id, senderId, senderUsername, content, channelId, channelName, dmId
    ).catch(() => {});
  }

  return {
    id: docRef.id,
    ...messageData
  } as Message;
};

// Real-time subscription for channel messages
export const subscribeToChannelMessages = (
  channelId: string,
  callback: (messages: Message[]) => void
): Unsubscribe => {
  const q = query(
    collection(db, 'messages'),
    where('channelId', '==', channelId),
    where('deleted', '==', false),
    orderBy('timestamp', 'asc')
  );
  
  return onSnapshot(q, (snapshot) => {
    const messages = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Message[];
    callback(messages);
  });
};

// Real-time subscription for DM messages
export const subscribeToDMMessages = (
  dmId: string,
  callback: (messages: Message[]) => void
): Unsubscribe => {
  const q = query(
    collection(db, 'messages'),
    where('dmId', '==', dmId),
    where('deleted', '==', false),
    orderBy('timestamp', 'asc')
  );
  
  return onSnapshot(q, (snapshot) => {
    const messages = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Message[];
    callback(messages);
  });
};

export const deleteMessage = async (messageId: string, userId: string): Promise<void> => {
  const messageRef = doc(db, 'messages', messageId);
  const messageDoc = await getDoc(messageRef);
  
  if (!messageDoc.exists()) {
    throw new Error('Message not found');
  }
  
  const message = messageDoc.data() as Message;
  
  // Check if user is admin
  const userDoc = await getDoc(doc(db, 'users', userId));
  const isAdmin = userDoc.exists() && userDoc.data().isAdmin;
  
  // Allow delete if message sender OR admin
  if (message.senderId !== userId && !isAdmin) {
    throw new Error('Cannot delete another user\'s message');
  }
  
  await updateDoc(messageRef, { deleted: true });
};

export const toggleReaction = async (messageId: string, userId: string, emoji: string): Promise<void> => {
  const messageRef = doc(db, 'messages', messageId);

  await runTransaction(db, async (transaction) => {
    const messageDoc = await transaction.get(messageRef);

    if (!messageDoc.exists()) {
      throw new Error('Message not found');
    }

    const message = messageDoc.data() as Message;
    const reactions: Reaction[] = message.reactions ? [...message.reactions] : [];

    const reactionIndex = reactions.findIndex(r => r.emoji === emoji);

    if (reactionIndex === -1) {
      // New emoji — add reaction with this user
      reactions.push({ emoji, userIds: [userId] });
    } else {
      const reaction = { ...reactions[reactionIndex] };
      const userIndex = reaction.userIds.indexOf(userId);

      if (userIndex === -1) {
        reaction.userIds = [...reaction.userIds, userId];
      } else {
        reaction.userIds = reaction.userIds.filter(id => id !== userId);
      }

      if (reaction.userIds.length === 0) {
        reactions.splice(reactionIndex, 1);
      } else {
        reactions[reactionIndex] = reaction;
      }
    }

    transaction.update(messageRef, { reactions });
  });
};

// Backward compatibility - fetch all messages (use subscriptions instead)
export const getChannelMessages = async (channelId: string): Promise<Message[]> => {
  const q = query(
    collection(db, 'messages'),
    where('channelId', '==', channelId),
    where('deleted', '==', false),
    orderBy('timestamp', 'asc')
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Message));
};

export const getDMMessages = async (dmId: string): Promise<Message[]> => {
  const q = query(
    collection(db, 'messages'),
    where('dmId', '==', dmId),
    where('deleted', '==', false),
    orderBy('timestamp', 'asc')
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Message));
};

// Typing indicators (kept in localStorage for simplicity - can be moved to Firestore later)
const TYPING_KEY = 'retrochord_typing';
type TypingMap = Record<string, Record<string, number>>;

export const setTyping = (userId: string, channelId?: string, dmId?: string) => {
  const typing = (storage.get(TYPING_KEY) || {}) as TypingMap;
  const key = channelId || dmId || 'unknown';
  
  if (!typing[key]) {
    typing[key] = {};
  }
  
  typing[key][userId] = Date.now();
  storage.set(TYPING_KEY, typing);
  
  window.dispatchEvent(new StorageEvent('storage', {
    key: TYPING_KEY,
    newValue: JSON.stringify(typing)
  }));
};

export const clearTyping = (userId: string, channelId?: string, dmId?: string) => {
  const typing = (storage.get(TYPING_KEY) || {}) as TypingMap;
  const key = channelId || dmId || 'unknown';
  
  if (typing[key]) {
    delete typing[key][userId];
    
    if (Object.keys(typing[key]).length === 0) {
      delete typing[key];
    }
  }
  
  storage.set(TYPING_KEY, typing);
  
  window.dispatchEvent(new StorageEvent('storage', {
    key: TYPING_KEY,
    newValue: JSON.stringify(typing)
  }));
};

export const getTypingUsers = (channelId?: string, dmId?: string): string[] => {
  const typing = (storage.get(TYPING_KEY) || {}) as TypingMap;
  const key = channelId || dmId || 'unknown';
  const now = Date.now();
  const timeout = 3000;
  
  if (!typing[key]) {
    return [];
  }
  
  return Object.entries(typing[key])
    .filter(([_, timestamp]) => now - (timestamp as number) < timeout)
    .map(([userId, _]) => userId);
};

// ── Full-text message search ──────────────────────────────────────────────────
// Firestore doesn't support native CONTAINS, so we fetch the latest N messages
// from each text channel and filter client-side. For a small/medium server this
// is fast and free. Limited to channel messages only (not DMs).

export interface SearchResult {
  messageId: string;
  channelId: string;
  channelName: string;
  content: string;
  senderId: string;
  senderName: string;
  timestamp: number;
}

export async function searchChannelMessages(
  queryStr: string,
  channels: { id: string; name: string }[]
): Promise<SearchResult[]> {
  if (!queryStr.trim() || channels.length === 0) return [];
  const q = queryStr.toLowerCase().trim();
  const results: SearchResult[] = [];

  // Load users once for username lookup
  const usersSnap = await getDocs(collection(db, 'users'));
  const usernameById = new Map<string, string>();
  usersSnap.docs.forEach(d => usernameById.set(d.id, d.data().username ?? 'Unknown'));

  // Fan out — fetch last 200 messages per channel in parallel
  await Promise.all(
    channels.map(async (ch) => {
      const snap = await getDocs(
        query(
          collection(db, 'messages'),
          where('channelId', '==', ch.id),
          where('deleted', '==', false),
          orderBy('timestamp', 'desc'),
          limit(200)
        )
      );
      snap.docs.forEach((d) => {
        const data = d.data();
        if (typeof data.content === 'string' && data.content.toLowerCase().includes(q)) {
          results.push({
            messageId: d.id,
            channelId: ch.id,
            channelName: ch.name,
            content: data.content,
            senderId: data.senderId ?? '',
            senderName: usernameById.get(data.senderId) ?? data.senderId ?? 'Unknown',
            timestamp: data.timestamp ?? 0,
          });
        }
      });
    })
  );

  results.sort((a, b) => b.timestamp - a.timestamp);
  return results.slice(0, 50);
}

// ── Message editing ───────────────────────────────────────────────────────────
export async function editMessage(
  messageId: string,
  userId: string,
  newContent: string
): Promise<void> {
  const messageRef = doc(db, 'messages', messageId);
  const snap = await getDoc(messageRef);
  if (!snap.exists()) throw new Error('Message not found');
  const data = snap.data();
  if (data.senderId !== userId) throw new Error('Cannot edit another user\'s message');
  await updateDoc(messageRef, { content: newContent.trim(), editedAt: Date.now() });
}

// ── Notifications ─────────────────────────────────────────────────────────────
export interface Notification {
  id: string;
  toUserId: string;
  fromUserId: string;
  fromUsername: string;
  type: 'mention' | 'dm';
  channelId?: string;
  channelName?: string;
  dmId?: string;
  messageId: string;
  preview: string;
  read: boolean;
  timestamp: number;
}

export async function createMentionNotifications(
  messageId: string,
  senderId: string,
  senderUsername: string,
  content: string,
  channelId?: string,
  channelName?: string,
  dmId?: string
): Promise<void> {
  // Extract @username mentions
  const mentionMatches = content.match(/@([a-zA-Z0-9_]+)/g) ?? [];
  if (mentionMatches.length === 0) return;

  const usernames = mentionMatches.map(m => m.slice(1).toLowerCase());

  // Look up mentioned users
  const usersSnap = await getDocs(collection(db, 'users'));
  const preview = content.length > 80 ? content.slice(0, 80) + '…' : content;

  const writes = usersSnap.docs
    .filter(d => {
      const u = d.data();
      return usernames.includes((u.username ?? '').toLowerCase()) && d.id !== senderId;
    })
    .map(d =>
      addDoc(collection(db, 'notifications'), {
        toUserId: d.id,
        fromUserId: senderId,
        fromUsername: senderUsername,
        type: channelId ? 'mention' : 'dm',
        channelId: channelId ?? null,
        channelName: channelName ?? null,
        dmId: dmId ?? null,
        messageId,
        preview,
        read: false,
        timestamp: Date.now(),
      })
    );

  await Promise.all(writes);
}

export function subscribeToNotifications(
  userId: string,
  cb: (notifications: Notification[]) => void
): Unsubscribe {
  const q = query(
    collection(db, 'notifications'),
    where('toUserId', '==', userId),
    orderBy('timestamp', 'desc'),
    limit(50)
  );
  return onSnapshot(q, snap => {
    const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as Notification));
    cb(list);
  });
}

export async function markNotificationRead(notificationId: string): Promise<void> {
  await updateDoc(doc(db, 'notifications', notificationId), { read: true });
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  const snap = await getDocs(
    query(collection(db, 'notifications'), where('toUserId', '==', userId), where('read', '==', false))
  );
  await Promise.all(snap.docs.map(d => updateDoc(d.ref, { read: true })));
}
