import React, { useState, useEffect } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { User } from '../../types/user';
import MemberList from '../lists/MemberList';
import './RightRail.css';

const RightRail: React.FC = () => {
  const [onlineCount, setOnlineCount] = useState(0);

  useEffect(() => {
    // Subscribe to all users and count online client-side.
    // Compound Firestore queries (isDeleted==false AND presence==online) miss docs
    // where either field is absent (legacy accounts), giving a falsely-low count.
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
        <span className="online-badge">{onlineCount} online</span>
      </div>
      <MemberList />
    </div>
  );
};

export default RightRail;