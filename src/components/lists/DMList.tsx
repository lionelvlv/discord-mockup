import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../features/auth/useAuth';
import { subscribeToActiveDMs, closeDM } from '../../features/chat/dmApi';
import { User } from '../../types/user';
import { DM } from '../../types/channel';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../../config/firebase';
import Avatar from '../ui/Avatar';
import PresenceDot from '../ui/PresenceDot';
import './DMList.css';

const DMList: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [dms, setDms] = useState<DM[]>([]);
  // Keep ALL users (including deleted) so DMs with deleted users can still be closed.
  // Real-time subscription ensures profile changes (e.g. soft-delete) are reflected live.
  const [users, setUsers] = useState<Map<string, User>>(new Map());
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; dm: DM } | null>(null);

  useEffect(() => {
    if (!user) return;

    // Subscribe to all users in real-time — includes deleted users so their DMs
    // still render (as "Deleted User") and can be closed via right-click.
    console.log('[DMList] Subscribing to users + active DMs');
    const unsubUsers = onSnapshot(collection(db, 'users'), (snap) => {
      const map = new Map<string, User>();
      snap.docs.forEach((d) => map.set(d.id, { id: d.id, ...d.data() } as User));
      console.log(`[DMList] Users updated: ${map.size} total`);
      setUsers(map);
    });

    // Real-time DM subscription — fires whenever a DM is opened or closed
    const unsubDMs = subscribeToActiveDMs(user.id, (activeDMs) => {
      console.log(`[DMList] Active DMs updated: ${activeDMs.length}`);
      setDms(activeDMs);
    });

    return () => {
      unsubUsers();
      unsubDMs();
    };
  }, [user?.id]);

  useEffect(() => {
    const handler = () => setContextMenu(null);
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, []);

  const handleContextMenu = (e: React.MouseEvent, dm: DM) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, dm });
  };

  const handleCloseDM = async (dm: DM) => {
    if (!user) return;
    if (confirm('Close this DM?')) {
      await closeDM(dm.id, user.id);
      const otherUserId = dm.userA === user.id ? dm.userB : dm.userA;
      if (location.pathname === `/app/dm/${otherUserId}`) {
        navigate('/app/channel/general');
      }
    }
    setContextMenu(null);
  };

  const getOtherUser = (dm: DM): User | undefined => {
    const otherUserId = dm.userA === user?.id ? dm.userB : dm.userA;
    const found = users.get(otherUserId);
    // If the user record is missing entirely (shouldn't happen, but be safe),
    // return a placeholder so the DM row still renders and can be closed.
    if (!found) {
      console.warn(`[DMList] User ${otherUserId} not found in cache — showing placeholder`);
      return {
        id: otherUserId,
        username: 'Unknown User',
        avatarUrl: '👤',
        email: '',
        bio: '',
        presence: 'offline',
        isAdmin: false,
        isDeleted: true,
      } as User;
    }
    return found;
  };

  const isDMActive = (dm: DM) => {
    const otherUserId = dm.userA === user?.id ? dm.userB : dm.userA;
    return location.pathname === `/app/dm/${otherUserId}`;
  };

  return (
    <>
      <div className="dm-list">
        <div className="list-header pixel-font">DIRECT MESSAGES</div>
        {dms.map((dm) => {
          const otherUser = getOtherUser(dm);
          if (!otherUser) return null;
          const isDeleted = otherUser.isDeleted;
          return (
            <div
              key={dm.id}
              className={`dm-item list-item-95 ${isDMActive(dm) ? 'selected' : ''} ${isDeleted ? 'dm-deleted' : ''}`}
              onClick={() => !isDeleted && navigate(`/app/dm/${otherUser.id}`)}
              onContextMenu={(e) => handleContextMenu(e, dm)}
              title={isDeleted ? 'This user has been deleted — right-click to close DM' : undefined}
            >
              <Avatar src={otherUser.avatarUrl} size={24} />
              <span className="dm-username" style={{ opacity: isDeleted ? 0.5 : 1 }}>
                {otherUser.username}
              </span>
              {!isDeleted && <PresenceDot status={otherUser.presence} />}
            </div>
          );
        })}
      </div>

      {contextMenu && (
        <div
          className="context-menu panel"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <div className="context-item" onClick={() => handleCloseDM(contextMenu.dm)}>
            ❌ Close DM
          </div>
        </div>
      )}
    </>
  );
};

export default DMList;