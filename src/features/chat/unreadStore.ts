// ── Unread message store ──────────────────────────────────────────────────────
// Tracks per-channel/DM unread counts and mention counts.
// Singleton — shared across ChannelList, DMList, and MessageList.

import { Message } from '../../types/message';

interface UnreadEntry {
  unread: number;    // total unread messages
  mentions: number;  // messages that @mention the current user
}

type Listener = () => void;

let data: Record<string, UnreadEntry> = {};
const listeners = new Set<Listener>();

function notify() {
  listeners.forEach(fn => fn());
}

export function subscribeUnread(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getUnread(id: string): UnreadEntry {
  return data[id] ?? { unread: 0, mentions: 0 };
}

export function markRead(id: string) {
  if (!data[id]) return;
  data = { ...data, [id]: { unread: 0, mentions: 0 } };
  notify();
}

// Called by MessageList when new messages arrive
export function updateUnread(
  id: string,
  messages: Message[],
  currentUserId: string,
  currentUsername: string,
  lastReadTimestamp: number
) {
  let unread = 0;
  let mentions = 0;
  for (const msg of messages) {
    if (msg.timestamp <= lastReadTimestamp) continue;
    if (msg.senderId === currentUserId) continue;
    if (msg.deleted) continue;
    unread++;
    if (msg.content && msg.content.toLowerCase().includes(`@${currentUsername.toLowerCase()}`)) {
      mentions++;
    }
  }
  const prev = data[id];
  if (prev?.unread === unread && prev?.mentions === mentions) return;
  data = { ...data, [id]: { unread, mentions } };
  notify();
}

// Get total mention count across all channels/DMs for the title bar
export function getTotalMentions(): number {
  return Object.values(data).reduce((sum, e) => sum + e.mentions, 0);
}
