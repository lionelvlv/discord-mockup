import React, { useState, useEffect } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { User } from '../../types/user';
import MemberList from '../lists/MemberList';
import NotificationBell from './NotificationBell';
import './RightRail.css';

const RightRail: React.FC<{ onNavigate?: () => void }> = ({ onNavigate }) => {
  const [onlineCount, setOnlineCount] = useState(0);

  useEffect(() => {
    console.log('[RightRail] Subscribing to online users');
    const unsub = onSnapshot(collection(db, 'users'), (snap) => {
      const count = snap.docs.filter((d) => {
        const data = d.data() as User;
        return !data.isDeleted && data.presence === 'online';
      }).length;
      console.log(`[RightRail] Online users updated: ${count}`);
      setOnlineCount(count);
    });
    return () => unsub();
  }, []);

  return (
    <div className="right-rail panel">
      <div className="online-count-header">
        <span className="pixel-font">MEMBERS</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span className="online-badge">{onlineCount} online</span>
          <NotificationBell onNavigate={onNavigate} />
        </div>
      </div>
      <MemberList />
    </div>
  );
};

export default RightRail;