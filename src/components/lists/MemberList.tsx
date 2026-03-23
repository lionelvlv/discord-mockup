import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../features/auth/useAuth';
import { deleteUser } from '../../features/auth/api';
import { collection, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { ref as rtdbRef, onValue, off } from 'firebase/database';
import { db, rtdb } from '../../config/firebase';
import { User, PresenceStatus } from '../../types/user';
import Avatar from '../ui/Avatar';
import ProfilePopup from '../ui/ProfilePopup';
import PresenceDot from '../ui/PresenceDot';
import { getUnread, subscribeUnread } from '../../features/chat/unreadStore';
import './MemberList.css';

const ONLINE_THRESHOLD_MS = 90_000;
const IDLE_THRESHOLD_MS   = 300_000;

const MemberList: React.FC<{ onNavigate?: () => void }> = ({ onNavigate }) => {
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const [members, setMembers] = useState<User[]>([]);
  const [profilePopup, setProfilePopup] = useState<{ member: User; x: number; y: number } | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; member: User } | null>(null);
  const [, forceUpdate] = useState(0);
  useEffect(() => subscribeUnread(() => forceUpdate(n => n + 1)), []);

  // Subscribe to Firestore users
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

  // RTDB presence watcher — detects killed mobile apps / power-off
  useEffect(() => {
    const allPresenceRef = rtdbRef(rtdb, 'presence');

    const markStatus = async (uid: string, status: PresenceStatus) => {
      await updateDoc(doc(db, 'users', uid), { presence: status }).catch(() => {});
    };

    const handler = onValue(allPresenceRef, (snap) => {
      const now  = Date.now();
      const data = snap.val() ?? {};
      members.forEach(member => {
        if (!member.id || member.id === currentUser?.id) return;
        const entry = data[member.id];
        if (!entry || !entry.online || !entry.lastSeen) {
          if (member.presence !== 'offline') markStatus(member.id, 'offline');
          return;
        }
        const age = now - entry.lastSeen;
        const expected: PresenceStatus = age < ONLINE_THRESHOLD_MS ? 'online'
          : age < IDLE_THRESHOLD_MS ? 'idle' : 'offline';
        if (expected !== member.presence) markStatus(member.id, expected);
      });
    });

    const sweep = setInterval(() => {
      const now = Date.now();
      members.forEach(member => {
        if (!member.id || member.id === currentUser?.id) return;
        const memberRef = rtdbRef(rtdb, `presence/${member.id}`);
        onValue(memberRef, (snap) => {
          const entry = snap.val();
          if (!entry || !entry.online || !entry.lastSeen) {
            if (member.presence !== 'offline') markStatus(member.id, 'offline');
            return;
          }
          const age = now - entry.lastSeen;
          const expected: PresenceStatus = age < ONLINE_THRESHOLD_MS ? 'online'
            : age < IDLE_THRESHOLD_MS ? 'idle' : 'offline';
          if (expected !== member.presence) markStatus(member.id, expected);
          off(memberRef);
        }, { onlyOnce: true });
      });
    }, 60_000);

    return () => {
      off(allPresenceRef, 'value', handler);
      clearInterval(sweep);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [members, currentUser?.id]);

  useEffect(() => {
    const handler = () => setContextMenu(null);
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, []);

  const handleMemberClick = (e: React.MouseEvent, member: User) => {
    e.stopPropagation();
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
      {(() => {
        const u = getUnread(member.id);
        if (u.mentions > 0) return <span className="unread-badge mention-badge">{u.mentions}</span>;
        if (u.unread > 0) return <span className="unread-dot" />;
        return <PresenceDot status={member.presence} />;
      })()}
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

      {profilePopup && (
        <ProfilePopup
          member={profilePopup.member}
          anchor={{ x: profilePopup.x, y: profilePopup.y }}
          onClose={() => setProfilePopup(null)}
          onNavigate={onNavigate}
        />
      )}

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
