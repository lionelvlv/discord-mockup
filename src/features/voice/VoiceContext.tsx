import React, { createContext, useContext, useState, useCallback } from 'react';

interface ActiveVoice {
  channelId: string;
  channelName: string;
}

interface VoiceContextType {
  activeVoice: ActiveVoice | null;
  joinVoice: (channelId: string, channelName: string) => void;
  leaveVoice: () => void;
  isExpanded: boolean;
  setExpanded: (v: boolean) => void;
  // Whether the local user is currently speaking (for the collapsed bar indicator)
  localIsSpeaking: boolean;
  setLocalIsSpeaking: (v: boolean) => void;
}

const VoiceContext = createContext<VoiceContextType | null>(null);

export const VoiceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeVoice, setActiveVoice] = useState<ActiveVoice | null>(null);
  const [isExpanded, setIsExpanded] = useState(true);
  const [localIsSpeaking, setLocalIsSpeaking] = useState(false);

  const joinVoice = useCallback((channelId: string, channelName: string) => {
    setActiveVoice({ channelId, channelName });
    setIsExpanded(true);
  }, []);

  const leaveVoice = useCallback(() => {
    setActiveVoice(null);
    setIsExpanded(false);
    setLocalIsSpeaking(false);
  }, []);

  return (
    <VoiceContext.Provider value={{
      activeVoice, joinVoice, leaveVoice,
      isExpanded, setExpanded: setIsExpanded,
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
