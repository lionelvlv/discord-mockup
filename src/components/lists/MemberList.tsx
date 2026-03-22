import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../features/auth/useAuth';
import { deleteUser } from '../../features/auth/api';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { User, PresenceStatus } from '../../types/user';
import Avatar from '../ui/Avatar';
import PresenceDot from '../ui/PresenceDot';
import './MemberList.css';

// ── Profile popup ─────────────────────────────────────────────────────────────
const ProfilePopup: React.FC<{
  member: User;
  anchor: { x: number; y: number };
  isCurrentUser: boolean;
  onClose: () => void;
  onDM: () => void;
}> = ({ member, anchor, isCurrentUser, onClose, onDM }) => {
  const popupRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) onClose();
    };
    // Slight delay so the click that opened it doesn't immediately close it
    const t = setTimeout(() => document.addEventListener('mousedown', handler), 50);
    return () => { clearTimeout(t); document.removeEventListener('mousedown', handler); };
  }, [onClose]);

  // Position: try to show to the left of the right rail, avoid viewport overflow
  const style: React.CSSProperties = {
    position: 'fixed',
    top: Math.min(anchor.y, window.innerHeight - 220),
    right: window.innerWidth - anchor.x + 8,
    zIndex: 1000,
    width: 220,
  };

  return (
    <div ref={popupRef} className="profile-popup panel" style={style}>
      {/* Win98 title bar */}
      <div className="profile-popup-titlebar">
        <span className="pixel-font" style={{ fontSize: '7px' }}>USER PROFILE</span>
        <button className="button-95 profile-popup-close" onClick={onClose}>✕</button>
      </div>

      {/* Avatar + name */}
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

      {/* Bio */}
      {member.bio && (
        <div className="profile-popup-bio panel-inset">
          {member.bio}
        </div>
      )}
      {!member.bio && (
        <div className="profile-popup-bio profile-popup-bio--empty">No bio set.</div>
      )}

      {/* DM button (not shown for self) */}
      {!isCurrentUser && (
        <button className="button-95 profile-popup-dm-btn" onClick={onDM}>
          💬 Send Message
        </button>
      )}
    </div>
  );
};

// ── MemberList ────────────────────────────────────────────────────────────────
const MemberList: React.FC = () => {
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const [members, setMembers] = useState<User[]>([]);
  const [profilePopup, setProfilePopup] = useState<{ member: User; x: number; y: number } | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; member: User } | null>(null);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'users'), (snapshot) => {
      const allUsers = snapshot.docs
        .map((d) => ({ id: d.id, ...d.data() } as User))
        .filter((u) => !u.isDeleted);
      const order: Record<PresenceStatus, number> = { online: 0, idle: 1, offline: 2 };
      allUsers.sort((a, b) => order[a.presence ?? 'offline'] - order[b.presence ?? 'offline']);
      setMembers(allUsers);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const handler = () => setContextMenu(null);
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, []);

  const handleMemberClick = (e: React.MouseEvent, member: User) => {
    e.stopPropagation();
    // Toggle popup
    if (profilePopup?.member.id === member.id) {
      setProfilePopup(null);
    } else {
      setProfilePopup({ member, x: e.clientX, y: e.clientY });
    }
  };

  const handleContextMenu = (e: React.MouseEvent, member: User) => {
    e.preventDefault();
    if (currentUser?.isAdmin && member.id !== currentUser.id) {
      setContextMenu({ x: e.clientX, y: e.clientY, member });
    }
  };

  const handleDeleteUser = async (member: User) => {
    if (!currentUser?.isAdmin) return;
    if (confirm(`Delete user "${member.username}"? This cannot be undone.`)) {
      try {
        await deleteUser(member.id, currentUser.id);
        setContextMenu(null);
      } catch (error) {
        alert(error instanceof Error ? error.message : 'Failed to delete user');
      }
    }
    setContextMenu(null);
  };

  const handleDM = (member: User) => {
    setProfilePopup(null);
    navigate(`/app/dm/${member.id}`);
  };

  const onlineMembers  = members.filter((m) => m.presence === 'online');
  const offlineMembers = members.filter((m) => m.presence !== 'online');

  const renderMember = (member: User, isOffline = false) => (
    <div
      key={member.id}
      className={`member-item list-item-95 ${isOffline ? 'offline' : ''} ${profilePopup?.member.id === member.id ? 'active' : ''}`}
      onClick={(e) => handleMemberClick(e, member)}
      onContextMenu={(e) => handleContextMenu(e, member)}
      title={`Click to view ${member.username}'s profile`}
    >
      <Avatar src={member.avatarUrl} size={24} />
      <span className="member-username">{member.username}</span>
      <PresenceDot status={member.presence} />
    </div>
  );

  return (
    <>
      <div className="member-list">
        <div className="list-header pixel-font">MEMBERS</div>
        {onlineMembers.length > 0 && (
          <>
            <div className="member-section-label">ONLINE — {onlineMembers.length}</div>
            {onlineMembers.map((m) => renderMember(m))}
          </>
        )}
        {offlineMembers.length > 0 && (
          <>
            <div className="member-section-label">OFFLINE — {offlineMembers.length}</div>
            {offlineMembers.map((m) => renderMember(m, true))}
          </>
        )}
      </div>

      {/* Profile popup */}
      {profilePopup && (
        <ProfilePopup
          member={profilePopup.member}
          anchor={{ x: profilePopup.x, y: profilePopup.y }}
          isCurrentUser={profilePopup.member.id === currentUser?.id}
          onClose={() => setProfilePopup(null)}
          onDM={() => handleDM(profilePopup.member)}
        />
      )}

      {/* Admin context menu */}
      {contextMenu && (
        <div className="context-menu panel" style={{ left: contextMenu.x, top: contextMenu.y }}>
          <div className="context-item" onClick={() => handleDeleteUser(contextMenu.member)}>
            🗑️ Delete User
          </div>
        </div>
      )}
    </>
  );
};

export default MemberList;
