import React, { useState, useEffect } from 'react';
import { useAuth } from '../../features/auth/useAuth';
import { subscribeToServerSettings } from '../../features/serverSettings/api';
import ChannelList from '../lists/ChannelList';
import VoiceChannelList from '../lists/VoiceChannelList';
import DMList from '../lists/DMList';
import ServerSettings from './ServerSettings';
import './LeftRail.css';

interface LeftRailProps {
  onNavigate?: () => void;
}

const LeftRail: React.FC<LeftRailProps> = ({ onNavigate }) => {
  const { user } = useAuth();
  const [serverName, setServerName] = useState('RETROCHORD');
  const [search, setSearch]         = useState('');
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    const unsub = subscribeToServerSettings(s => setServerName(s.name));
    return unsub;
  }, []);

  return (
    <>
      <div className="left-rail panel">
        {/* Server header with name + admin cog */}
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

        {/* Channel/DM search */}
        <div className="left-rail-search">
          <input
            className="left-rail-search-input"
            type="text"
            placeholder="🔍 Search channels…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            aria-label="Search channels and DMs"
          />
          {search && (
            <button className="left-rail-search-clear" onClick={() => setSearch('')} aria-label="Clear search">✕</button>
          )}
        </div>

        <div className="rail-content">
          <ChannelList onNavigate={onNavigate} search={search} />
          <VoiceChannelList onNavigate={onNavigate} search={search} />
          <DMList onNavigate={onNavigate} search={search} />
        </div>
      </div>

      {/* Server settings modal — admin only */}
      {showSettings && user?.isAdmin && (
        <ServerSettings onClose={() => setShowSettings(false)} />
      )}
    </>
  );
};

export default LeftRail;
