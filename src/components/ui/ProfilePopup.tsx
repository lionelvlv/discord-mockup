import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { User } from '../../types/user';
import { useAuth } from '../../features/auth/useAuth';
import Avatar from './Avatar';
import PresenceDot from './PresenceDot';

interface ProfilePopupProps {
  member: User;
  anchor: { x: number; y: number };
  onClose: () => void;
  onNavigate?: () => void; // called on DM navigate (mobile tab switch)
}

const ProfilePopup: React.FC<ProfilePopupProps> = ({ member, anchor, onClose, onNavigate }) => {
  const { user: currentUser } = useAuth();
  const navigate  = useNavigate();
  const popupRef  = useRef<HTMLDivElement>(null);
  const isSelf    = currentUser?.id === member.id;

  // Close on outside click/touch
  useEffect(() => {
    const handler = (e: MouseEvent | TouchEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) onClose();
    };
    const t = setTimeout(() => {
      document.addEventListener('mousedown', handler);
      document.addEventListener('touchstart', handler);
    }, 50);
    return () => {
      clearTimeout(t);
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('touchstart', handler);
    };
  }, [onClose]);

  // Smart position: fit inside viewport, prefer left of click on desktop,
  // center-bottom on mobile
  const isMobile = window.innerWidth <= 768;
  const W = 220, H = 200;
  let style: React.CSSProperties;

  if (isMobile) {
    style = {
      position: 'fixed',
      bottom: 70, // above bottom nav
      left: '50%',
      transform: 'translateX(-50%)',
      width: W,
      zIndex: 1200,
    };
  } else {
    const top   = Math.min(anchor.y, window.innerHeight - H - 8);
    const left  = anchor.x + W + 8 < window.innerWidth
      ? anchor.x + 8
      : anchor.x - W - 8;
    style = { position: 'fixed', top, left, width: W, zIndex: 1200 };
  }

  const handleDM = () => {
    onClose();
    onNavigate?.();
    navigate(`/app/dm/${member.id}`);
  };

  return (
    <div ref={popupRef} className="profile-popup panel" style={style}>
      <div className="profile-popup-titlebar">
        <span className="pixel-font" style={{ fontSize: '7px' }}>USER PROFILE</span>
        <button className="button-95 profile-popup-close" onClick={onClose}>✕</button>
      </div>

      <div className="profile-popup-hero">
        <Avatar src={member.avatarUrl} size={52} />
        <div className="profile-popup-identity">
          <div className="profile-popup-username">{member.username}</div>
          <div className="profile-popup-presence">
            <PresenceDot status={member.presence} />
            <span>{member.presence ?? 'offline'}</span>
          </div>
        </div>
      </div>

      {member.bio
        ? <div className="profile-popup-bio panel-inset">{member.bio}</div>
        : <div className="profile-popup-bio profile-popup-bio--empty">No bio set.</div>
      }

      {!isSelf && (
        <button className="button-95 profile-popup-dm-btn" onClick={handleDM}>
          💬 Send Message
        </button>
      )}
    </div>
  );
};

export default ProfilePopup;
