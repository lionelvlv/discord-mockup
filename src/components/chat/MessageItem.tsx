import React, { useRef, useEffect, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { Message } from '../../types/message';
import { User } from '../../types/user';
import { soundManager } from '../../lib/sounds';
import MessageItem from './MessageItem';
import './MessageList.css';

interface MessageListProps {
  messages: Message[];
}

// Subscribe to ALL users once at the list level and pass sender data down to
// each MessageItem as a prop. This replaces the old pattern where every
// MessageItem opened its own Firestore listener — which created N×senders
// redundant subscriptions (visible in logs as 20+ "Subscribing to sender" lines
// for only 3 unique users).
function MessageList({ messages }: MessageListProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const prevMessageCount = useRef(messages.length);
  const [usersById, setUsersById] = useState<Map<string, User>>(new Map());

  // Single subscription for all user docs — updates whenever any profile changes
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'users'), (snap) => {
      const map = new Map<string, User>();
      snap.docs.forEach((d) => map.set(d.id, { id: d.id, ...d.data() } as User));
      setUsersById(map);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
    if (messages.length > prevMessageCount.current && prevMessageCount.current > 0) {
      soundManager.play('message', 0.5);
    }
    prevMessageCount.current = messages.length;
  }, [messages]);

  return (
    <div className="message-list">
      {messages.map((message) => {
        // Look up sender; if not in the map (e.g. hard-deleted account), pass a
        // placeholder so the message still renders rather than staying blank forever.
        const sender = usersById.get(message.senderId) ?? {
          id: message.senderId,
          username: 'Deleted User',
          avatarUrl: '💀',
          email: '',
          bio: '',
          presence: 'offline' as const,
          isAdmin: false,
          isDeleted: true,
        };
        return (
          <MessageItem
            key={message.id}
            message={message}
            sender={sender}
          />
        );
      })}
      <div ref={messagesEndRef} />
    </div>
  );
}

export default MessageList;
