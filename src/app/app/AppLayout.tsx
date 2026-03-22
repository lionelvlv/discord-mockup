import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../../features/auth/useAuth';
import LeftRail from '../../components/layout/LeftRail';
import RightRail from '../../components/layout/RightRail';
import UserPanel from '../../components/layout/UserPanel';
import ChannelPage from './channel/ChannelPage';
import VoiceChannelPage from './voice/VoiceChannelPage';
import DMPage from './dm/DMPage';
import ProfileSettings from './settings/ProfileSettings';
import './App.css';

const AppLayout: React.FC = () => {
  const { user } = useAuth();

  if (!user) {
    return <Navigate to="/login" />;
  }

  return (
    <div className="app-layout">
      <div className="left-section">
        <LeftRail />
        <UserPanel user={user} />
      </div>

      <div className="main-section">
        <Routes>
          <Route path="/" element={<Navigate to="/app/channel/general" />} />
          <Route path="/channel/:channelId" element={<ChannelPage />} />
          <Route path="/voice/:channelId" element={<VoiceChannelPage />} />
          <Route path="/dm/:userId" element={<DMPage />} />
          <Route path="/settings/profile" element={<ProfileSettings />} />
        </Routes>
      </div>

      <div className="right-section">
        <RightRail />
      </div>
    </div>
  );
};

export default AppLayout;