import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../features/auth/useAuth';
import { setTyping, clearTyping } from '../../features/chat/api';
import './MessageComposer.css';

interface MessageComposerProps {
  onSend: (content: string) => void;
  channelId?: string;
  dmId?: string;
}

const MessageComposer: React.FC<MessageComposerProps> = ({ onSend, channelId, dmId }) => {
  const { user } = useAuth();
  const [message, setMessage] = useState('');
  // useRef instead of useState — timeout ID doesn't need to trigger a re-render
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      if (user) clearTyping(user.id, channelId, dmId);
    };
  }, [user, channelId, dmId]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value);

    if (user) {
      setTyping(user.id, channelId, dmId);

      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        clearTyping(user.id, channelId, dmId);
      }, 3000);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = message.trim();
    if (trimmed && user) {
      onSend(trimmed);
      setMessage('');
      clearTyping(user.id, channelId, dmId);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="message-composer panel-outset">
      <form onSubmit={handleSubmit} className="composer-form">
        <textarea
          className="composer-input textarea-95"
          value={message}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder="Type a message... (Enter to send, Shift+Enter for new line)"
          rows={2}
        />
        <button type="submit" className="send-button button-95" disabled={!message.trim()}>
          SEND
        </button>
      </form>
    </div>
  );
};

export default MessageComposer;
