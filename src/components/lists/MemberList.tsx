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
import './MemberList.css';

// ONLINE_THRESHOLD: if lastSeen is older than this, the user is considered offline
// even if their Firestore doc still says online (e.g. phone was killed)
const ONLINE_THRESHOLD_MS = 90_000;  // 90 seconds
const IDLE_THRESHOLD_MS   = 300_000; // 5 minutes

// ── Profile popup ─────────────────────────────────────────────────────────────
    return () => unsub();
  }, []);

  // RTDB presence watcher: subscribe to the top-level /presence node and
  // reconcile each user's lastSeen against the current time.
  // This is the only reliable way to detect killed mobile apps / power-off:
  // onDisconnect removes the RTDB node, which fires this listener with null
  // for that user. We then immediately write 'offline' to their Firestore doc.
  // A periodic sweep also catches any users whose lastSeen has aged out.
  useEffect(() => {
    const allPresenceRef = rtdbRef(rtdb, 'presence');

    const markStatus = async (uid: string, status: PresenceStatus) => {
      await updateDoc(doc(db, 'users', uid), { presence: status }).catch(() => {});
    };

    const handler = onValue(allPresenceRef, (snap) => {
      const now  = Date.now();
      const data = snap.val() ?? {};

      // Check every user we know about
      members.forEach(member => {
        if (!member.id || member.id === currentUser?.id) return; // own status managed by useAuth
        const entry = data[member.id];
        if (!entry || !entry.online || !entry.lastSeen) {
          // RTDB node removed (onDisconnect fired) or never set → offline
          if (member.presence !== 'offline') markStatus(member.id, 'offline');
          return;
        }
        const age = now - entry.lastSeen;
        const expected: PresenceStatus = age < ONLINE_THRESHOLD_MS ? 'online'
          : age < IDLE_THRESHOLD_MS   ? 'idle'
          : 'offline';
        if (expected !== member.presence) markStatus(member.id, expected);
      });
    });

    // Also run a sweep every 60s to catch users whose lastSeen has aged out
    // even without a new RTDB event
    const sweep = setInterval(() => {
      const now = Date.now();
      // Re-read from the snapshot handler's data — already subscribed above
      // so just trigger a re-check using the members state
      members.forEach(member => {
        if (!member.id || member.id === currentUser?.id) return;
        // If marked online/idle but we haven't seen a RTDB update, check age
        // via a one-time read
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
          off(memberRef); // one-time read
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
    onNavigate?.();
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
          onClose={() => setProfilePopup(null)}
          onNavigate={onNavigate}
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
