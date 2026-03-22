export interface Reaction {
  emoji: string;
  userIds: string[];
}

// A file or embed attached to a message
export interface Attachment {
  url: string;          // Download/display URL (Firebase Storage or embed)
  name: string;         // Original filename or embed title
  type: string;         // MIME type (e.g. "image/png") or "embed/youtube"
  size?: number;        // Bytes — undefined for embeds
  kind: 'image' | 'video' | 'audio' | 'file' | 'embed';
}

export interface Message {
  id: string;
  senderId: string;
  channelId?: string;
  dmId?: string;
  content: string;
  timestamp: number;
  deleted: boolean;
  reactions: Reaction[];
  attachments?: Attachment[];
}
