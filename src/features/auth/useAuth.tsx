import React, { createContext, useContext, useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { ref, set, onValue, off, onDisconnect } from 'firebase/database';
import { auth, db, rtdb } from '../../config/firebase';
import { User } from '../../types/user';
import {
  login as apiLogin,
  logout as apiLogout,
  signup as apiSignup,
  updateProfile as apiUpdateProfile
} from './api';
import { storage } from '../../lib/storage';

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  signup: (username: string, email: string, password: string, bio?: string, avatarUrl?: string) => Promise<void>;
  updateProfile: (updates: Partial<User>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const stored = storage.get('currentUser');
    if (stored) setUser(stored as User);

    // Track RTDB listeners so we can clean them up when auth state changes
    let rtdbUnsubs: (() => void)[] = [];
    let firestoreUnsub: (() => void) | null = null;

    const unsubAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      // Tear down previous listeners every time auth state changes
      rtdbUnsubs.forEach((fn) => fn());
      rtdbUnsubs = [];
      firestoreUnsub?.();
      firestoreUnsub = null;

      if (!firebaseUser) {
        console.log('[Auth] Signed out — clearing user state');
        setUser(null);
        storage.remove('currentUser');
        return;
      }

      console.log('[Auth] Signed in as', firebaseUser.uid);

      // ── RTDB presence with server-side onDisconnect ──────────────────────
      // .info/connected fires true when the RTDB WebSocket is live.
      // We register onDisconnect BEFORE writing 'online' so a tab-close/crash
      // is handled server-side even if our JS never runs the cleanup.
      const presenceRef = ref(rtdb, `presence/${firebaseUser.uid}`);
      const connectedRef = ref(rtdb, '.info/connected');

      let isReconnecting = false;

      const connectedHandler = onValue(connectedRef, async (snap) => {
        if (!snap.val()) {
          console.log('[Auth] RTDB disconnected');
          return;
        }
        console.log('[Auth] RTDB connected — registering onDisconnect and going online');
        isReconnecting = true;
        // Register server-side disconnect handler FIRST
        await onDisconnect(presenceRef).set('offline');
        // Then write online status
        await set(presenceRef, 'online');
        // Mirror to Firestore so MemberList picks it up immediately
        await updateDoc(doc(db, 'users', firebaseUser.uid), { presence: 'online' }).catch(() => {});
        isReconnecting = false;
      });
      rtdbUnsubs.push(() => off(connectedRef, 'value', connectedHandler));

      // Mirror RTDB presence changes → Firestore (catches server-side disconnect).
      // Guard: skip the mirror if we just wrote 'online' ourselves to avoid a
      // transient 'offline' flash during the reconnect sequence.
      const presenceHandler = onValue(presenceRef, async (snap) => {
        const status = snap.val();
        console.log(`[Auth] RTDB presence changed: ${status}`);
        if (status === 'offline' && !isReconnecting) {
          await updateDoc(doc(db, 'users', firebaseUser.uid), { presence: 'offline' }).catch(() => {});
        }
      });
      rtdbUnsubs.push(() => off(presenceRef, 'value', presenceHandler));

      // ── Firestore user doc subscription ─────────────────────────────────
      firestoreUnsub = onSnapshot(doc(db, 'users', firebaseUser.uid), (snap) => {
        if (!snap.exists()) return;
        const data = snap.data() as User;
        // isDeleted must be explicitly true — missing/undefined field (legacy accounts)
        // should NOT log the user out
        if (data.isDeleted === true) {
          alert('Your account has been deleted by an administrator.');
          apiLogout();
          return;
        }
        console.log('[Auth] User doc updated:', data.username, 'presence:', data.presence);
        setUser({ ...data, id: snap.id });
        storage.set('currentUser', { ...data, id: snap.id });
      });
    });

    // Best-effort: set offline immediately on tab close (RTDB onDisconnect is the
    // real safety net, but this fires synchronously on modern browsers).
    const handleBeforeUnload = () => {
      const uid = auth.currentUser?.uid;
      if (uid) {
        // navigator.sendBeacon is fire-and-forget; best effort only
        set(ref(rtdb, `presence/${uid}`), 'offline').catch(() => {});
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    // Cleanup: sign-out, RTDB listeners, and Firestore listener
    return () => {
      unsubAuth();
      rtdbUnsubs.forEach((fn) => fn());
      firestoreUnsub?.();
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  const login = async (email: string, password: string) => {
    const u = await apiLogin(email, password);
    setUser(u);
    storage.set('currentUser', u);
  };

  const logout = async () => {
    if (auth.currentUser) {
      await set(ref(rtdb, `presence/${auth.currentUser.uid}`), 'offline').catch(() => {});
      await updateDoc(doc(db, 'users', auth.currentUser.uid), { presence: 'offline' }).catch(() => {});
    }
    await apiLogout();
    setUser(null);
    storage.remove('currentUser');
  };

  const signup = async (username: string, email: string, password: string, bio?: string, avatarUrl?: string) => {
    const u = await apiSignup(username, email, password, bio, avatarUrl);
    setUser(u);
    storage.set('currentUser', u);
  };

  const updateProfile = async (updates: Partial<User>) => {
    if (user) {
      const updated = await apiUpdateProfile(user.id, updates);
      setUser(updated);
      storage.set('currentUser', updated);
    }
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, signup, updateProfile }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};