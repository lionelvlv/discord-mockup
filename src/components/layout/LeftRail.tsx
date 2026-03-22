import React from 'react';
import ChannelList from '../lists/ChannelList';
import VoiceChannelList from '../lists/VoiceChannelList';
import DMList from '../lists/DMList';
import './LeftRail.css';

const LeftRail: React.FC = () => {
  return (
    <div className="left-rail panel">
      <div className="server-header panel-outset">
        <span className="pixel-font server-name">RETROCHORD</span>
      </div>
      
      <div className="rail-content">
        <ChannelList />
        <VoiceChannelList />
        <DMList />
      </div>
    </div>
  );
};

export default LeftRail;