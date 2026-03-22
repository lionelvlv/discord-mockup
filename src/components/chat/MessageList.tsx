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
  highlightMessageId?: string;
  onHighlightClear?: () => void;
}

function MessageList({ messages, highlightMessageId, onHighlightClear }: MessageListProps) {
  const messagesEndRef   = useRef<HTMLDivElement>(null);
  const messageRefs      = useRef<Map<string, HTMLDivElement>>(new Map());
  const prevMessageCount = useRef(messages.length);
  const [usersById, setUsersById]       = useState<Map<string, User>>(new Map());
  const [flashId, setFlashId]           = useState<string | undefined>(undefined);
  const didScrollToHighlight            = useRef(false);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'users'), (snap) => {
      const map = new Map<string, User>();
      snap.docs.forEach((d) => map.set(d.id, { id: d.id, ...d.data() } as User));
      setUsersById(map);
    });
    return () => unsub();
  }, []);

  // Scroll to bottom on new messages (unless we have a highlight target)
  useEffect(() => {
    if (highlightMessageId) return; // let the highlight scroll handle it
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
    if (messages.length > prevMessageCount.current && prevMessageCount.current > 0) {
      soundManager.play('message', 0.5);
    }
    prevMessageCount.current = messages.length;
  }, [messages, highlightMessageId]);

  // Scroll to highlighted message once messages are loaded
  useEffect(() => {
    if (!highlightMessageId || didScrollToHighlight.current) return;
    const el = messageRefs.current.get(highlightMessageId);
    if (!el) return;
    didScrollToHighlight.current = true;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setFlashId(highlightMessageId);
    // Remove flash class after animation, then clear the URL param
    setTimeout(() => {
      setFlashId(undefined);
      onHighlightClear?.();
    }, 3000);
  }, [messages, highlightMessageId, onHighlightClear]);

  // Reset scroll flag when highlight changes
  useEffect(() => {
    didScrollToHighlight.current = false;
  }, [highlightMessageId]);

  return (
    <div className="message-list">
      {messages.map((message) => {
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
          <div
            key={message.id}
            ref={el => {
              if (el) messageRefs.current.set(message.id, el);
              else messageRefs.current.delete(message.id);
            }}
            className={flashId === message.id ? 'message-highlight-flash' : ''}
          >
            <MessageItem message={message} sender={sender} />
          </div>
        );
      })}
      <div ref={messagesEndRef} />
    </div>
  );
}

export default MessageList;
