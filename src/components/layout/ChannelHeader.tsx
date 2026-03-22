import React from 'react';
import './ChannelHeader.css';

interface ChannelHeaderProps {
  name: string;
  description?: string;
}

const ChannelHeader: React.FC<ChannelHeaderProps> = ({ name, description }) => {
  return (
    <div className="channel-header panel-outset">
      <div className="header-content">
        <h1 className="channel-title">
          <span className="channel-hash">#</span>
          {name}
        </h1>
        {description && (
          <p className="channel-description">{description}</p>
        )}
      </div>
    </div>
  );
};

export default ChannelHeader;