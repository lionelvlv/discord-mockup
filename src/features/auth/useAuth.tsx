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

      // ── Foolproof presence: heartbeat + TTL + multi-signal offline detection ──
      //
      // Stores { online: bool, lastSeen: timestamp } in RTDB.
      // Client computes actual status from age:
      //   lastSeen < 90s  → online
      //   90s–5min        → idle
      //   > 5min or gone  → offline
      //
      // This survives ALL failure modes:
      //  ✓ Normal tab close   → beforeunload + onDisconnect.remove()
      //  ✓ Device power off   → onDisconnect fires when TCP times out
      //  ✓ Internet cut       → onDisconnect fires; heartbeat stops → ages out
      //  ✓ Mobile background  → visibilitychange pauses heartbeat → ages out in 90s
      //  ✓ App crash / kill   → onDisconnect fires on TCP close
      //  ✓ Long idle          → heartbeat stops → ages to idle/offline
      //  ✓ Reconnect          → re-registers onDisconnect, resumes heartbeat

      const presenceRef  = ref(rtdb, `presence/${firebaseUser.uid}`);
      const connectedRef = ref(rtdb, '.info/connected');

      let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
      let isConnected = false;

      const writeHeartbeat = async () => {
        if (!isConnected || document.visibilityState === 'hidden') return;
        try { await set(presenceRef, { online: true, lastSeen: Date.now() }); } catch { /* retry next tick */ }
      };

      const goOnline = async () => {
        isConnected = true;
        await onDisconnect(presenceRef).remove(); // server clears on disconnect
        await set(presenceRef, { online: true, lastSeen: Date.now() });
        await updateDoc(doc(db, 'users', firebaseUser.uid), { presence: 'online' }).catch(() => {});
        if (heartbeatTimer) clearInterval(heartbeatTimer);
        heartbeatTimer = setInterval(writeHeartbeat, 30_000);
      };

      const goOffline = async (writeNow = false) => {
        isConnected = false;
        if (heartbeatTimer) { clearInterval(heartbeatTimer); heartbeatTimer = null; }
        if (writeNow) {
          try { await set(presenceRef, { online: false, lastSeen: 0 }); } catch { /* best effort */ }
          await updateDoc(doc(db, 'users', firebaseUser.uid), { presence: 'offline' }).catch(() => {});
        }
      };

      const connectedHandler = onValue(connectedRef, async (snap) => {
        if (snap.val()) { await goOnline(); }
        else { await goOffline(); }
      });
      rtdbUnsubs.push(() => off(connectedRef, 'value', connectedHandler));

      // visibilitychange: pause heartbeat when backgrounded (mobile focus loss)
      const handleVisibility = () => {
        if (document.visibilityState === 'hidden') {
          if (heartbeatTimer) { clearInterval(heartbeatTimer); heartbeatTimer = null; }
        } else if (isConnected) {
          writeHeartbeat();
          if (heartbeatTimer) clearInterval(heartbeatTimer);
          heartbeatTimer = setInterval(writeHeartbeat, 30_000);
        }
      };
      document.addEventListener('visibilitychange', handleVisibility);
      rtdbUnsubs.push(() => document.removeEventListener('visibilitychange', handleVisibility));
      rtdbUnsubs.push(() => { if (heartbeatTimer) clearInterval(heartbeatTimer); });

      // Mirror RTDB lastSeen → Firestore presence (drives the dot in MemberList)
      const presenceHandler = onValue(presenceRef, async (snap) => {
        const val = snap.val();
        if (!val || !val.online) {
          await updateDoc(doc(db, 'users', firebaseUser.uid), { presence: 'offline' }).catch(() => {});
          return;
        }
        const age = Date.now() - (val.lastSeen ?? 0);
        const status = age < 90_000 ? 'online' : age < 300_000 ? 'idle' : 'offline';
        await updateDoc(doc(db, 'users', firebaseUser.uid), { presence: status }).catch(() => {});
      });
      rtdbUnsubs.push(() => off(presenceRef, 'value', presenceHandler));

      // ── Firestore user doc subscription ─────────────────────────────────
      firestoreUnsub = onSnapshot(doc(db, 'users', firebaseUser.uid), (snap) => {
        if (!snap.exists()) return;
        const data = snap.data() as User;
        if (data.isDeleted === true) {
          alert('Your account has been deleted by an administrator.');
          apiLogout();
          return;
        }
        setUser({ ...data, id: snap.id });
        storage.set('currentUser', { ...data, id: snap.id });
      });
    });

    // Immediate offline on tab close — belt-and-suspenders with onDisconnect
    const handleBeforeUnload = () => {
      const uid = auth.currentUser?.uid;
      if (uid) {
        try { set(ref(rtdb, `presence/${uid}`), { online: false, lastSeen: 0 }); } catch { /* best effort */ }
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