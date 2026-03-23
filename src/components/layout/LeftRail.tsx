import React, { useState, useEffect } from 'react';
import { useAuth } from '../../features/auth/useAuth';
import { subscribeToServerSettings } from '../../features/serverSettings/api';
import ChannelList from '../lists/ChannelList';
import VoiceChannelList from '../lists/VoiceChannelList';
import DMList from '../lists/DMList';
import ServerSettings from './ServerSettings';
import ChannelSearch from './ChannelSearch';
import './LeftRail.css';

interface LeftRailProps {
  onNavigate?: () => void;
}

const LeftRail: React.FC<LeftRailProps> = ({ onNavigate }) => {
  const { user } = useAuth();
  const [serverName, setServerName] = useState('RETROCHORD');
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    const unsub = subscribeToServerSettings(s => setServerName(s.name));
    return unsub;
  }, []);

  return (
    <>
      <div className="left-rail panel">
        {/* Server header */}
        <div className="server-header panel-outset">
          <span className="pixel-font server-name">{serverName.toUpperCase()}</span>
          {user?.isAdmin && (
            <button
              className="server-cog-btn"
              onClick={() => setShowSettings(true)}
              title="Server Settings"
              aria-label="Server Settings"
            >
              ⚙️
            </button>
          )}
        </div>

        {/* Full-text message search */}
        <ChannelSearch onNavigate={onNavigate} />

        <div className="rail-content">
          {/* Lists are no longer filtered by search — search is handled by ChannelSearch above */}
          <ChannelList onNavigate={onNavigate} />
          <VoiceChannelList onNavigate={onNavigate} />
          <DMList onNavigate={onNavigate} />
        </div>
      </div>

      {showSettings && user?.isAdmin && (
        <ServerSettings onClose={() => setShowSettings(false)} />
      )}
    </>
  );
};

export default LeftRail;
