import { Channel } from '../types/channel';

export const CHANNELS: Channel[] = [
  { id: 'general', name: 'general', description: 'General discussion' },
  { id: 'off-topic', name: 'off-topic', description: 'Random conversations' },
  { id: 'projects', name: 'projects', description: 'Share your projects' }
];

export const PRESENCE_IDLE_TIMEOUT = 5 * 60 * 1000; // 5 minutes
export const TYPING_TIMEOUT = 3000; // 3 seconds
export const WEBSOCKET_RECONNECT_DELAY = 3000; // 3 seconds

export const REACTION_EMOJIS = ['👍', '😊', '😂', '💾', '❤️', '🔥', '👀', '🎮'];

export const PRESET_AVATARS = [
  '🎮', '🌴', '💾', '📼', '🎧', '🎨', '🌈', '⭐',
  '🎯', '🎪', '🎭', '🎬', '📻', '🔮', '💿', '🕹️'
];
