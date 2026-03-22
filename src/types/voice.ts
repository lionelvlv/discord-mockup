export interface VoiceParticipant {
  userId: string;
  username: string;
  avatarUrl: string;
  isMuted: boolean;
  isCameraOn: boolean;
  isScreenSharing: boolean;
  stream?: MediaStream;
}

export interface VoiceChannel {
  channelId: string;
  participants: string[];
}

export interface SignalingData {
  id: string;
  from: string;
  to: string;
  channelId: string;
  type: 'offer' | 'answer' | 'ice-candidate' | 'kick';
  offer?: { type: RTCSdpType; sdp: string };
  answer?: { type: RTCSdpType; sdp: string };
  candidate?: RTCIceCandidateInit;
  timestamp: number;
}