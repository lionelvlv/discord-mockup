import React from 'react';
import './VoiceControls.css';

interface VoiceControlsProps {
  isMuted: boolean;
  isCameraOn: boolean;
  isScreenSharing: boolean;
  onToggleMute: () => void;
  onToggleCamera: () => void;
  onToggleScreenShare: () => void;
  onLeave: () => void;
}

const VoiceControls: React.FC<VoiceControlsProps> = ({
  isMuted,
  isCameraOn,
  isScreenSharing,
  onToggleMute,
  onToggleCamera,
  onToggleScreenShare,
  onLeave
}) => {
  return (
    <div className="voice-controls panel-inset">
      <button
        className={`control-btn button-95 ${isMuted ? 'active' : ''}`}
        onClick={onToggleMute}
        title={isMuted ? 'Unmute' : 'Mute'}
      >
        {isMuted ? '🔇' : '🎤'}
      </button>

      <button
        className={`control-btn button-95 ${isCameraOn ? 'active' : ''}`}
        onClick={onToggleCamera}
        title={isCameraOn ? 'Turn Off Camera' : 'Turn On Camera'}
      >
        {isCameraOn ? '📹' : '📷'}
      </button>

      <button
        className={`control-btn button-95 ${isScreenSharing ? 'active' : ''}`}
        onClick={onToggleScreenShare}
        title={isScreenSharing ? 'Stop Sharing' : 'Share Screen'}
      >
        {isScreenSharing ? '🖥️' : '📺'}
      </button>

      <button
        className="control-btn button-95 leave-btn"
        onClick={onLeave}
        title="Leave Voice"
      >
        📞
      </button>
    </div>
  );
};

export default VoiceControls;
