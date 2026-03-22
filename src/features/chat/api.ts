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
  runTransaction
} from 'firebase/firestore';
import { db } from '../../config/firebase';
import { Message } from '../../types/message';
import { storage } from '../../lib/storage';
import { Reaction } from '../../types/message';
export const sendMessage = async (
  senderId: string,
  content: string,
  channelId?: string,
  dmId?: string
): Promise<Message> => {
  const messageData = {
    senderId,
    content,
    channelId: channelId || null,
    dmId: dmId || null,
    timestamp: Date.now(),
    deleted: false,
    reactions: []
  };

  const docRef = await addDoc(collection(db, 'messages'), messageData);
  
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
