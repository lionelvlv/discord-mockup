import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  onSnapshot,
  Unsubscribe
} from 'firebase/firestore';
import { db } from '../../config/firebase';
import { DM } from '../../types/channel';

export const getDMId = (userA: string, userB: string): string => {
  const sorted = [userA, userB].sort();
  return `${sorted[0]}_${sorted[1]}`;
};

export const getOrCreateDM = async (userA: string, userB: string): Promise<DM> => {
  const dmId = getDMId(userA, userB);
  const dmRef = doc(db, 'directMessages', dmId);
  const dmDoc = await getDoc(dmRef);

  if (dmDoc.exists()) {
    const data = dmDoc.data() as DM;
    if (data.closedBy?.includes(userA)) {
      const updated = { ...data, closedBy: data.closedBy.filter((id) => id !== userA) };
      await updateDoc(dmRef, { closedBy: updated.closedBy });
      return updated;
    }
    return data;
  }

  const newDM: DM = {
    id: dmId,
    userA,
    userB,
    lastSeenBy: {},
    closedBy: []
  };
  await setDoc(dmRef, newDM);
  return newDM;
};

export const createDM = (userA: string, userB: string): DM => {
  const dmId = getDMId(userA, userB);
  getOrCreateDM(userA, userB).catch(console.error);
  return { id: dmId, userA, userB, lastSeenBy: {}, closedBy: [] };
};

export const markDMSeen = async (dmId: string, userId: string): Promise<void> => {
  const dmRef = doc(db, 'directMessages', dmId);
  await updateDoc(dmRef, {
    [`lastSeenBy.${userId}`]: Date.now()
  }).catch(() => {});
};

export const closeDM = async (dmId: string, userId: string): Promise<void> => {
  const dmRef = doc(db, 'directMessages', dmId);
  const dmDoc = await getDoc(dmRef);
  if (!dmDoc.exists()) return;
  const data = dmDoc.data() as DM;
  const closedBy = data.closedBy || [];
  if (!closedBy.includes(userId)) {
    await updateDoc(dmRef, { closedBy: [...closedBy, userId] });
  }
};

export const getActiveDMs = async (userId: string): Promise<DM[]> => {
  const q1 = query(collection(db, 'directMessages'), where('userA', '==', userId));
  const q2 = query(collection(db, 'directMessages'), where('userB', '==', userId));
  const [snap1, snap2] = await Promise.all([getDocs(q1), getDocs(q2)]);
  const all = [
    ...snap1.docs.map((d) => d.data() as DM),
    ...snap2.docs.map((d) => d.data() as DM)
  ];
  return all.filter((dm) => !dm.closedBy?.includes(userId));
};

export const subscribeToActiveDMs = (
  userId: string,
  callback: (dms: DM[]) => void
): Unsubscribe => {
  const results: { a: DM[]; b: DM[] } = { a: [], b: [] };

  const merge = () => {
    const combined = [...results.a, ...results.b];
    const unique = Array.from(new Map(combined.map((d) => [d.id, d])).values());
    callback(unique.filter((dm) => !dm.closedBy?.includes(userId)));
  };

  const q1 = query(collection(db, 'directMessages'), where('userA', '==', userId));
  const q2 = query(collection(db, 'directMessages'), where('userB', '==', userId));

  const unsub1 = onSnapshot(q1, (snap: any) => {
    results.a = snap.docs.map((d: any) => d.data() as DM);
    merge();
  });
  const unsub2 = onSnapshot(q2, (snap: any) => {
    results.b = snap.docs.map((d: any) => d.data() as DM);
    merge();
  });

  return () => { unsub1(); unsub2(); };
};

export const getDMs = (): DM[] => [];