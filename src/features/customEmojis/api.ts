import {
  collection, addDoc, deleteDoc, doc, onSnapshot,
  query, where, getDocs, Unsubscribe
} from 'firebase/firestore';
import { db } from '../../config/firebase';

export interface CustomEmoji {
  id: string;
  name: string;         // short name like "catjam"
  url: string;          // Cloudinary URL
  uploadedBy: string;   // uid
  username: string;     // display name for the tab label
  createdAt: number;
}

export const MAX_CUSTOM_EMOJI_BYTES = 256 * 1024; // 256 KB
export const MAX_CUSTOM_EMOJIS_PER_USER = 10;

// Upload to Cloudinary then write metadata to Firestore
export async function addCustomEmoji(
  file: File,
  name: string,
  userId: string,
  username: string
): Promise<CustomEmoji> {
  const cloudName    = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
  const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

  if (!cloudName || !uploadPreset)
    throw new Error('Cloudinary not configured');
  if (file.size > MAX_CUSTOM_EMOJI_BYTES)
    throw new Error(`Emoji must be under 256 KB (got ${(file.size/1024).toFixed(0)} KB)`);
  if (!file.type.startsWith('image/'))
    throw new Error('Only image files are allowed');

  // Enforce per-user limit
  const existing = await getDocs(
    query(collection(db, 'customEmojis'), where('uploadedBy', '==', userId))
  );
  if (existing.size >= MAX_CUSTOM_EMOJIS_PER_USER)
    throw new Error(`You can only have ${MAX_CUSTOM_EMOJIS_PER_USER} custom emojis`);

  const safeName = name.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_').slice(0, 32) || 'emoji';

  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', uploadPreset);
  formData.append('tags', 'retrochord_emoji');

  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
    method: 'POST', body: formData,
  });
  if (!res.ok) throw new Error(`Upload failed (${res.status})`);
  const data = await res.json();

  const emoji: Omit<CustomEmoji, 'id'> = {
    name: safeName,
    url: data.secure_url,
    uploadedBy: userId,
    username,
    createdAt: Date.now(),
  };
  const ref = await addDoc(collection(db, 'customEmojis'), emoji);
  return { id: ref.id, ...emoji };
}

export function subscribeToCustomEmojis(
  cb: (emojis: CustomEmoji[]) => void
): Unsubscribe {
  return onSnapshot(collection(db, 'customEmojis'), (snap: any) => {
    const list = snap.docs.map((d: any) => ({ id: d.id, ...d.data() } as CustomEmoji));
    list.sort((a: CustomEmoji, b: CustomEmoji) => a.username.localeCompare(b.username) || a.createdAt - b.createdAt);
    cb(list);
  });
}

export async function deleteCustomEmoji(emojiId: string): Promise<void> {
  await deleteDoc(doc(db, 'customEmojis', emojiId));
}
