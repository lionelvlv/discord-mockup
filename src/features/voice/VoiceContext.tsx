import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { VoiceParticipant } from '../../types/voice';

interface ActiveVoice {
  channelId: string;
  channelName: string;
}

// Controls that VoicePanel registers so VoiceMiniPanel can trigger them
interface VoiceControls {
  toggleMute: () => void;
  toggleCamera: () => void;
  toggleScreenShare: () => void;
}

interface VoiceContextType {
  activeVoice: ActiveVoice | null;
  joinVoice: (channelId: string, channelName: string) => void;
  leaveVoice: () => void;
  // true = full screen in main area; false = mini panel in left rail
  isExpanded: boolean;
  setExpanded: (v: boolean) => void;
  // Participant list synced from VoicePanel so mini panel can show streams
  participants: VoiceParticipant[];
  syncParticipants: (p: VoiceParticipant[]) => void;
  // Local control state synced from VoicePanel
  isMuted: boolean;
  isCameraOn: boolean;
  isScreenSharing: boolean;
  syncControls: (s: { isMuted: boolean; isCameraOn: boolean; isScreenSharing: boolean }) => void;
  // Registered control handlers from VoicePanel
  controls: VoiceControls | null;
  registerControls: (c: VoiceControls) => void;
  unregisterControls: () => void;
  // Speaking state for the mini panel indicator
  localIsSpeaking: boolean;
  setLocalIsSpeaking: (v: boolean) => void;
}

const VoiceContext = createContext<VoiceContextType | null>(null);

export const VoiceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeVoice, setActiveVoice]       = useState<ActiveVoice | null>(null);
  const [isExpanded, setIsExpanded]         = useState(true);
  const [participants, setParticipants]     = useState<VoiceParticipant[]>([]);
  const [isMuted, setIsMuted]               = useState(false);
  const [isCameraOn, setIsCameraOn]         = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [controls, setControls]             = useState<VoiceControls | null>(null);
  const [localIsSpeaking, setLocalIsSpeaking] = useState(false);

  const joinVoice = useCallback((channelId: string, channelName: string) => {
    setActiveVoice({ channelId, channelName });
    setIsExpanded(true);
  }, []);

  const leaveVoice = useCallback(() => {
    setActiveVoice(null);
    setIsExpanded(false);
    setParticipants([]);
    setControls(null);
    setLocalIsSpeaking(false);
  }, []);

  const syncParticipants = useCallback((p: VoiceParticipant[]) => setParticipants(p), []);

  const syncControls = useCallback((s: { isMuted: boolean; isCameraOn: boolean; isScreenSharing: boolean }) => {
    setIsMuted(s.isMuted);
    setIsCameraOn(s.isCameraOn);
    setIsScreenSharing(s.isScreenSharing);
  }, []);

  const registerControls = useCallback((c: VoiceControls) => setControls(c), []);
  const unregisterControls = useCallback(() => setControls(null), []);

  return (
    <VoiceContext.Provider value={{
      activeVoice, joinVoice, leaveVoice,
      isExpanded, setExpanded: setIsExpanded,
      participants, syncParticipants,
      isMuted, isCameraOn, isScreenSharing, syncControls,
      controls, registerControls, unregisterControls,
      localIsSpeaking, setLocalIsSpeaking,
    }}>
      {children}
    </VoiceContext.Provider>
  );
};

export const useVoice = () => {
  const ctx = useContext(VoiceContext);
  if (!ctx) throw new Error('useVoice must be used within VoiceProvider');
  return ctx;
};
