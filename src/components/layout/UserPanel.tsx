import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../features/auth/useAuth';
import { User } from '../../types/user';
import Avatar from '../ui/Avatar';
import PresenceDot from '../ui/PresenceDot';
import './UserPanel.css';

interface UserPanelProps {
  user: User;
}

const UserPanel: React.FC<UserPanelProps> = ({ user }) => {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [showMenu, setShowMenu] = useState(false);

  const handleSettings = () => {
    setShowMenu(false);
    navigate('/app/settings/profile');
  };

  const handleLogout = () => {
    if (confirm('Are you sure you want to logout?')) {
      logout();
    }
  };

  return (
    <div className="user-panel panel-inset">
      <div className="user-info" onClick={() => setShowMenu(!showMenu)}>
        <Avatar src={user.avatarUrl} size={32} />
        <div className="user-details">
          <div className="user-name">
            {user.username}
            {user.isAdmin && <span className="admin-crown-badge" title="Admin">👑</span>}
          </div>
          <div className="user-status">
            <PresenceDot status={user.presence} />
            <span>{user.presence}</span>
          </div>
        </div>
      </div>
      
      <div className="user-actions">
        <button
          className="icon-button button-95"
          onClick={handleSettings}
          title="Settings"
        >
          ⚙️
        </button>
        <button
          className="icon-button button-95"
          onClick={handleLogout}
          title="Logout"
        >
          🚪
        </button>
      </div>

      {showMenu && (
        <div className="user-menu window-95">
          <div className="menu-item list-item-95" onClick={handleSettings}>
            ⚙️ Settings
          </div>
          <div className="divider-95"></div>
          <div className="menu-item list-item-95" onClick={handleLogout}>
            🚪 Logout
          </div>
        </div>
      )}
    </div>
  );
};

export default UserPanel;
