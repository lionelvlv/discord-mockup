export interface Channel {
  id: string;
  name: string;
  description?: string;
  createdBy?: string;
  isPermanent?: boolean;
  isVoiceChannel?: boolean;
}

export interface DM {
  id: string;
  userA: string;
  userB: string;
  lastSeenBy: {
    [userId: string]: number;
  };
  closedBy?: string[];
}