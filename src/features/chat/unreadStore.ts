// ── Unread message store ──────────────────────────────────────────────────────
// Tracks per-channel/DM unread counts and mention counts.
// Singleton shared across ChannelList, DMList, GlobalUnreadWatcher, MessageList.

import { Message } from '../../types/message';

interface UnreadEntry {
  unread: number;
  mentions: number;
  // ids of messages that are @mentions — so we can decrement when they're seen
  mentionMessageIds: Set<string>;
}

type Listener = () => void;

let data: Record<string, UnreadEntry> = {};
const listeners = new Set<Listener>();

function notify() { listeners.forEach(fn => fn()); }

export function subscribeUnread(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getUnread(id: string): { unread: number; mentions: number; mentionMessageIds: Set<string> } {
  const e = data[id];
  return { unread: e?.unread ?? 0, mentions: e?.mentions ?? 0, mentionMessageIds: e?.mentionMessageIds ?? new Set() };
}

export function markRead(id: string) {
  const e = data[id];
  if (!e) return;
  // Keep mentionMessageIds so IntersectionObserver can still decrement-on-seen
  data = { ...data, [id]: { unread: 0, mentions: 0, mentionMessageIds: e.mentionMessageIds } };
  notify();
}

// Called when a mentioned message scrolls into view
export function markMentionSeen(channelOrDMId: string, messageId: string) {
  const e = data[channelOrDMId];
  if (!e || !e.mentionMessageIds.has(messageId)) return;
  const newIds = new Set(e.mentionMessageIds);
  newIds.delete(messageId);
  const newMentions = Math.max(0, e.mentions - 1);
  const newUnread   = Math.max(0, e.unread - 1);
  data = { ...data, [channelOrDMId]: { unread: newUnread, mentions: newMentions, mentionMessageIds: newIds } };
  notify();
}

// Update from GlobalUnreadWatcher.
// isDM=true means every incoming message counts as a mention (DMs are always personal).
export function updateUnread(
  id: string,
  messages: Message[],
  currentUserId: string,
  currentUsername: string,
  lastReadTimestamp: number,
  isDM = false
) {
  let unread = 0, mentions = 0;
  const mentionMessageIds = new Set<string>();

  for (const msg of messages) {
    if (msg.timestamp <= lastReadTimestamp) continue;
    if (msg.senderId === currentUserId) continue;
    if (msg.deleted) continue;
    unread++;
    const isExplicitMention = msg.content?.toLowerCase().includes(`@${currentUsername.toLowerCase()}`);
    if (isDM || isExplicitMention) {
      mentions++;
      mentionMessageIds.add(msg.id);
    }
  }

  const prev = data[id];
  if (prev?.unread === unread && prev?.mentions === mentions) return;
  data = { ...data, [id]: { unread, mentions, mentionMessageIds } };
  notify();
}

export function getTotalMentions(): number {
  return Object.values(data).reduce((sum, e) => sum + e.mentions, 0);
}
