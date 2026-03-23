import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../features/auth/useAuth';
import {
  subscribeToNotifications, markNotificationRead,
  markAllNotificationsRead, Notification
} from '../../features/chat/api';
import { formatTime } from '../../lib/time';
import './NotificationBell.css';

const NotificationBell: React.FC<{ onNavigate?: () => void }> = ({ onNavigate }) => {
  const { user } = useAuth();
  const navigate  = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen]                   = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const bellRef  = useRef<HTMLButtonElement>(null);

  // Compute fixed position anchored to bell button
  const getPanelStyle = (): React.CSSProperties => {
    if (!bellRef.current) return {};
    const rect = bellRef.current.getBoundingClientRect();
    return { top: rect.bottom + 6, right: window.innerWidth - rect.right };
  };

  useEffect(() => {
    if (!user) return;
    return subscribeToNotifications(user.id, setNotifications);
  }, [user?.id]);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const unread = notifications.filter(n => !n.read).length;

  const handleClick = async (n: Notification) => {
    if (!n.read) await markNotificationRead(n.id);
    setOpen(false);
    onNavigate?.();
    if (n.channelId) {
      navigate(`/app/channel/${n.channelId}?highlight=${n.messageId}`);
    } else if (n.dmId) {
      // DM notifications: navigate to the sender's profile page (DM by user ID),
      // not the composite dmId. fromUserId is the person who mentioned us.
      navigate(`/app/dm/${n.fromUserId}`);
    }
  };

  const handleClearAll = async () => {
    if (user) await markAllNotificationsRead(user.id);
  };

  return (
    <div className="notif-bell-wrap" ref={panelRef}>
      <button
        ref={bellRef}
        className={`notif-bell-btn button-95 ${unread > 0 ? 'has-unread' : ''}`}
        onClick={() => setOpen(v => !v)}
        title={unread > 0 ? `${unread} unread notification${unread > 1 ? 's' : ''}` : 'Notifications'}
        aria-label="Notifications"
      >
        🔔
        {unread > 0 && <span className="notif-badge">{unread > 9 ? '9+' : unread}</span>}
      </button>

      {open && (
        <div className="notif-panel panel" style={getPanelStyle()}>
          <div className="notif-panel-header">
            <span className="pixel-font" style={{ fontSize: '8px' }}>NOTIFICATIONS</span>
            {unread > 0 && (
              <button className="button-95 notif-clear-btn" onClick={handleClearAll}>
                ✓ Mark all read
              </button>
            )}
          </div>

          <div className="notif-list">
            {notifications.length === 0 && (
              <div className="notif-empty">No notifications yet.</div>
            )}
            {notifications.map(n => (
              <button
                key={n.id}
                className={`notif-item ${n.read ? 'read' : 'unread'}`}
                onClick={() => handleClick(n)}
              >
                <div className="notif-item-header">
                  <span className="notif-type-icon">{n.type === 'mention' ? '@' : '💬'}</span>
                  <span className="notif-from">{n.fromUsername}</span>
                  <span className="notif-time">{formatTime(n.timestamp)}</span>
                  {!n.read && <span className="notif-dot" />}
                </div>
                <div className="notif-where">
                  {n.channelName ? `#${n.channelName}` : 'Direct Message'}
                </div>
                <div className="notif-preview">{n.preview}</div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
