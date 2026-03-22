import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDocs,
  getDoc,
  query,
  orderBy,
  setDoc
} from 'firebase/firestore';
import { db } from '../../config/firebase';
import { Channel } from '../../types/channel';

// Initialize default channels — seeds each channel only if it doesn't already exist.
// This is safe to call multiple times (idempotent per channel ID).
export const initializeDefaultChannels = async () => {
  const defaultChannels = [
    { id: 'general',      name: 'general',      description: 'General discussion',    isPermanent: true, createdBy: 'system', isVoiceChannel: false },
    { id: 'off-topic',    name: 'off-topic',     description: 'Random conversations',  isPermanent: true, createdBy: 'system', isVoiceChannel: false },
    { id: 'projects',     name: 'projects',      description: 'Share your projects',   isPermanent: true, createdBy: 'system', isVoiceChannel: false },
    { id: 'voice-lobby',  name: 'Voice Lobby',   description: 'Main voice channel',    isPermanent: true, createdBy: 'system', isVoiceChannel: true  },
    { id: 'voice-gaming', name: 'Gaming',        description: 'Gaming voice channel',  isPermanent: true, createdBy: 'system', isVoiceChannel: true  },
  ];

  for (const channel of defaultChannels) {
    const ref = doc(db, 'channels', channel.id);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        name: channel.name,
        description: channel.description,
        isPermanent: channel.isPermanent,
        createdBy: channel.createdBy,
        isVoiceChannel: channel.isVoiceChannel,
      });
    }
  }
};

export const getAllChannels = async (): Promise<Channel[]> => {
  const q = query(collection(db, 'channels'), orderBy('name', 'asc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  } as Channel));
};

export const getTextChannels = async (): Promise<Channel[]> => {
  const channels = await getAllChannels();
  return channels.filter(c => !c.isVoiceChannel);
};

export const getVoiceChannels = async (): Promise<Channel[]> => {
  const channels = await getAllChannels();
  return channels.filter(c => c.isVoiceChannel);
};

export const createChannel = async (
  name: string,
  createdBy: string,
  description?: string,
  isVoiceChannel: boolean = false
): Promise<Channel> => {
  const channels = await getAllChannels();
  if (channels.some(c => c.name.toLowerCase() === name.toLowerCase())) {
    throw new Error('Channel name already exists');
  }

  const channelData = {
    name: name.toLowerCase().replace(/\s+/g, '-'),
    description: description || '',
    createdBy,
    isPermanent: false,
    isVoiceChannel
  };

  const docRef = await addDoc(collection(db, 'channels'), channelData);

  return {
    id: docRef.id,
    ...channelData
  };
};

export const updateChannel = async (
  channelId: string,
  userId: string,
  updates: { name?: string; description?: string }
): Promise<void> => {
  const channelDoc = await getDoc(doc(db, 'channels', channelId));
  
  if (!channelDoc.exists()) {
    throw new Error('Channel not found');
  }

  const channel = channelDoc.data() as Channel;

  const userDoc = await getDoc(doc(db, 'users', userId));
  const isAdmin = userDoc.exists() && userDoc.data().isAdmin;

  if (channel.createdBy !== userId && !isAdmin) {
    throw new Error('Only the channel creator or admin can edit this channel');
  }

  if (channel.isPermanent && updates.name) {
    throw new Error('Cannot rename permanent channels');
  }

  await updateDoc(doc(db, 'channels', channelId), updates);
};

export const deleteChannel = async (channelId: string, userId: string): Promise<void> => {
  const channelDoc = await getDoc(doc(db, 'channels', channelId));
  
  if (!channelDoc.exists()) {
    throw new Error('Channel not found');
  }

  const channel = channelDoc.data() as Channel;

  if (channel.isPermanent) {
    throw new Error('Cannot delete permanent channels');
  }

  const userDoc = await getDoc(doc(db, 'users', userId));
  const isAdmin = userDoc.exists() && userDoc.data().isAdmin;

  if (channel.createdBy !== userId && !isAdmin) {
    throw new Error('Only the channel creator or admin can delete this channel');
  }

  await deleteDoc(doc(db, 'channels', channelId));
};