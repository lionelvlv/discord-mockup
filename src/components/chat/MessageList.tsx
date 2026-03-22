import React, { useRef, useEffect } from 'react';
import { Message } from '../../types/message';
import { soundManager } from '../../lib/sounds';
import MessageItem from './MessageItem';
import './MessageList.css';

interface MessageListProps {
  messages: Message[];
}

function MessageList({ messages }: MessageListProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const prevMessageCount = useRef(messages.length);

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
      {messages.map((message) => (
        <MessageItem key={message.id} message={message} />
      ))}
      <div ref={messagesEndRef} />
    </div>
  );
}

export default MessageList;