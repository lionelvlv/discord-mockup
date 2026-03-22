import React from 'react';
import ChannelList from '../lists/ChannelList';
import VoiceChannelList from '../lists/VoiceChannelList';
import DMList from '../lists/DMList';
import './LeftRail.css';

interface LeftRailProps {
  // Called when the user taps a channel/DM on mobile so AppLayout can switch to chat tab
  onNavigate?: () => void;
}

const LeftRail: React.FC<LeftRailProps> = ({ onNavigate }) => {
  return (
    <div className="left-rail panel">
      <div className="server-header panel-outset">
        <span className="pixel-font server-name">RETROCHORD</span>
      </div>

      <div className="rail-content">
        <ChannelList onNavigate={onNavigate} />
        <VoiceChannelList onNavigate={onNavigate} />
        <DMList onNavigate={onNavigate} />
      </div>
    </div>
  );
};

export default LeftRail;
