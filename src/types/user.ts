export type PresenceStatus = 'online' | 'idle' | 'offline';

export interface User {
  id: string;
  username: string;
  email: string;
  password?: string; // Only stored in mock backend
  avatarUrl: string; // Emoji or URL
  bio: string;
  presence: PresenceStatus;
  isAdmin?: boolean;
  isDeleted?: boolean;
}
