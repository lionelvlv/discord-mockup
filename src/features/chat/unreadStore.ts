import { Message } from '../../types/message';

interface UnreadEntry {
  unread: number;
  mentions: number;
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

export function getUnread(id: string) {
  const e = data[id];
  return { unread: e?.unread ?? 0, mentions: e?.mentions ?? 0, mentionMessageIds: e?.mentionMessageIds ?? new Set<string>() };
}

// Zero the badge immediately (called when user opens the channel)
export function markRead(id: string) {
  data = { ...data, [id]: { unread: 0, mentions: 0, mentionMessageIds: new Set() } };
  notify();
}

// Called when a mentioned message scrolls into view — decrements badge by 1
export function markMentionSeen(channelOrDMId: string, messageId: string) {
  const e = data[channelOrDMId];
  if (!e?.mentionMessageIds.has(messageId)) return;
  const ids = new Set(e.mentionMessageIds);
  ids.delete(messageId);
  data = { ...data, [channelOrDMId]: {
    unread:           Math.max(0, e.unread - 1),
    mentions:         Math.max(0, e.mentions - 1),
    mentionMessageIds: ids,
  }};
  notify();
}

// msgs can be in any order — we check all of them against lastReadTimestamp
export function updateUnread(
  id: string,
  msgs: Message[],
  currentUserId: string,
  currentUsername: string,
  lastReadTimestamp: number,
  isDM = false
) {
  let unread = 0, mentions = 0;
  const mentionMessageIds = new Set<string>();
  const lower = currentUsername.toLowerCase();

  for (const m of msgs) {
    if (m.timestamp <= lastReadTimestamp) continue;
    if (m.senderId === currentUserId) continue;
    if (m.deleted) continue;
    unread++;
    if (isDM || m.content?.toLowerCase().includes(`@${lower}`)) {
      mentions++;
      mentionMessageIds.add(m.id);
    }
  }

  const prev = data[id];
  if (prev?.unread === unread && prev?.mentions === mentions) return;
  data = { ...data, [id]: { unread, mentions, mentionMessageIds } };
  notify();
}

export function getTotalMentions() {
  return Object.values(data).reduce((s, e) => s + e.mentions, 0);
}
