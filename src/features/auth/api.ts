import { 
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  Auth
} from 'firebase/auth';
import { auth, db } from '../../config/firebase';
import { User } from '../../types/user';
import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs,
  updateDoc,
  query,
  where
} from 'firebase/firestore';
import { kickFromAllVoiceChannels } from '../voice/api';

// Sign up a new user
export const signup = async (
  username: string,
  email: string,
  password: string,
  bio?: string,
  avatarUrl?: string
): Promise<User> => {
  try {
    // Create Firebase Auth user first
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const firebaseUser = userCredential.user;

    // Check if user document already exists
    const userDocRef = doc(db, 'users', firebaseUser.uid);
    const existingDoc = await getDoc(userDocRef);

    if (existingDoc.exists()) {
      // User document already exists, just return it
      console.log('User document already exists, returning existing data');
      return existingDoc.data() as User;
    }

    // Auto-assign admin if username is "lioneltest"
    const isAdminUser = username.toLowerCase() === 'lioneltest';

    // Create user document in Firestore
    const newUser: User = {
      id: firebaseUser.uid,
      username,
      email,
      avatarUrl: avatarUrl || '👤',
      bio: bio || '',
      presence: 'online',
      isAdmin: isAdminUser,
      isDeleted: false
    };

    // Use setDoc with merge option to avoid overwriting if document somehow exists
    await setDoc(userDocRef, newUser, { merge: true });

    return newUser;
  } catch (error: any) {
    console.error('Signup error:', error);
    
    // If the error is that email already exists, try to login instead
    if (error.code === 'auth/email-already-in-use') {
      throw new Error('This email is already registered. Please login instead.');
    }
    
    throw new Error(error.message || 'Failed to sign up');
  }
};

// Login existing user
export const login = async (email: string, password: string): Promise<User> => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const firebaseUser = userCredential.user;

    // Get user data from Firestore
    const userDocRef = doc(db, 'users', firebaseUser.uid);
    const userDoc = await getDoc(userDocRef);
    
    if (!userDoc.exists()) {
      // User exists in Auth but not in Firestore - create the document
      console.log('User exists in Auth but not Firestore, creating document...');
      
      const newUser: User = {
        id: firebaseUser.uid,
        username: firebaseUser.email?.split('@')[0] || 'User',
        email: firebaseUser.email || '',
        avatarUrl: '👤',
        bio: '',
        presence: 'online',
        isAdmin: false,
        isDeleted: false
      };
      
      await setDoc(userDocRef, newUser);
      return newUser;
    }

    const userData = userDoc.data() as User;

    // Update presence to online
    await updateDoc(userDocRef, {
      presence: 'online'
    });

    return {
      ...userData,
      presence: 'online'
    };
  } catch (error: any) {
    console.error('Login error:', error);
    throw new Error(error.message || 'Failed to login');
  }
};

// Logout
export const logout = async (): Promise<void> => {
  const currentUser = auth.currentUser;
  
  if (currentUser) {
    // Set presence to offline before logging out
    try {
      await updateDoc(doc(db, 'users', currentUser.uid), {
        presence: 'offline'
      });
    } catch (error) {
      console.error('Error updating presence on logout:', error);
    }
  }
  
  await signOut(auth);
};

// Get a single user by ID — used by VoicePanel to look up remote participants
// without fetching the entire users collection
export const getUser = async (userId: string): Promise<User> => {
  const userDoc = await getDoc(doc(db, 'users', userId));
  if (!userDoc.exists()) throw new Error(`User ${userId} not found`);
  return { id: userDoc.id, ...userDoc.data() } as User;
};

// Get all users
export const getAllUsers = async (): Promise<User[]> => {
  const usersSnapshot = await getDocs(collection(db, 'users'));
  return usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));
};

// Update user profile
export const updateProfile = async (userId: string, updates: Partial<User>): Promise<User> => {
  const userRef = doc(db, 'users', userId);
  await updateDoc(userRef, updates);
  
  const updatedDoc = await getDoc(userRef);
  return { id: updatedDoc.id, ...updatedDoc.data() } as User;
};

// Delete user (soft delete)
export const deleteUser = async (userId: string, adminId: string): Promise<void> => {
  // Check if the person deleting is an admin
  const adminDoc = await getDoc(doc(db, 'users', adminId));
  if (!adminDoc.exists() || !adminDoc.data().isAdmin) {
    throw new Error('Only admins can delete users');
  }

  // Kick user from all voice channels first
  await kickFromAllVoiceChannels(userId);

  // Soft delete - mark as deleted, change username, and remove email
  await updateDoc(doc(db, 'users', userId), {
    isDeleted: true,
    username: 'Deleted User',
    email: 'deleted@user.com',
    bio: '',
    avatarUrl: '💀'
  });
};