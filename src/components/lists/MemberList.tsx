import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../features/auth/useAuth';
import { deleteUser } from '../../features/auth/api';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { User, PresenceStatus } from '../../types/user';
import Avatar from '../ui/Avatar';
import PresenceDot from '../ui/PresenceDot';
import './MemberList.css';

const MemberList: React.FC = () => {
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const [members, setMembers] = useState<User[]>([]);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; member: User } | null>(null);

  useEffect(() => {
    // Fetch all users and filter client-side. A Firestore `where('isDeleted', '==', false)`
    // clause silently excludes docs where the field is absent (legacy accounts), making
    // real users invisible. Client-side filtering handles both false and undefined.
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

  const handleMemberClick = (member: User) => {
    if (member.id !== currentUser?.id) {
      navigate(`/app/dm/${member.id}`);
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

  const onlineMembers = members.filter((m) => m.presence === 'online');
  const offlineMembers = members.filter((m) => m.presence !== 'online');

  return (
    <>
      <div className="member-list">
        <div className="list-header pixel-font">MEMBERS</div>

        {onlineMembers.length > 0 && (
          <>
            <div className="member-section-label">ONLINE — {onlineMembers.length}</div>
            {onlineMembers.map((member) => (
              <div
                key={member.id}
                className="member-item list-item-95"
                onClick={() => handleMemberClick(member)}
                onContextMenu={(e) => handleContextMenu(e, member)}
              >
                <Avatar src={member.avatarUrl} size={24} />
                <span className="member-username">{member.username}</span>
                <PresenceDot status={member.presence} />
              </div>
            ))}
          </>
        )}

        {offlineMembers.length > 0 && (
          <>
            <div className="member-section-label">OFFLINE — {offlineMembers.length}</div>
            {offlineMembers.map((member) => (
              <div
                key={member.id}
                className="member-item list-item-95 offline"
                onClick={() => handleMemberClick(member)}
                onContextMenu={(e) => handleContextMenu(e, member)}
              >
                <Avatar src={member.avatarUrl} size={24} />
                <span className="member-username">{member.username}</span>
                <PresenceDot status={member.presence} />
              </div>
            ))}
          </>
        )}
      </div>

      {contextMenu && (
        <div
          className="context-menu panel"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <div className="context-item" onClick={() => handleDeleteUser(contextMenu.member)}>
            🗑️ Delete User
          </div>
        </div>
      )}
    </>
  );
};

export default MemberList;