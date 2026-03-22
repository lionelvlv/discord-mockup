export interface Reaction {
  emoji: string;
  userIds: string[];
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
}
