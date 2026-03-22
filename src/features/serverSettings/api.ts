import { doc, getDoc, setDoc, onSnapshot, Unsubscribe } from 'firebase/firestore';
import { db } from '../../config/firebase';

export interface ServerSettings {
  name: string;
}

const REF = () => doc(db, 'serverSettings', 'main');

export function subscribeToServerSettings(cb: (s: ServerSettings) => void): Unsubscribe {
  return onSnapshot(REF(), snap => {
    cb(snap.exists() ? (snap.data() as ServerSettings) : { name: 'RETROCHORD' });
  });
}

export async function updateServerSettings(updates: Partial<ServerSettings>): Promise<void> {
  await setDoc(REF(), updates, { merge: true });
}

export async function getServerSettings(): Promise<ServerSettings> {
  const snap = await getDoc(REF());
  return snap.exists() ? (snap.data() as ServerSettings) : { name: 'RETROCHORD' };
}
