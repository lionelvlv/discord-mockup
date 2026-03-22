import React, { useState, useEffect } from 'react';
import { useAuth } from '../../features/auth/useAuth';
import { deleteMessage, toggleReaction } from '../../features/chat/api';
import { Message } from '../../types/message';
import { User } from '../../types/user';
import { formatTime } from '../../lib/time';
import { REACTION_EMOJIS } from '../../lib/constants';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../config/firebase';
import Avatar from '../ui/Avatar';
import './MessageItem.css';

interface MessageItemProps {
  message: Message;
}

const MessageItem: React.FC<MessageItemProps> = ({ message }) => {
  const { user: currentUser } = useAuth();
  const [sender, setSender] = useState<User | null>(null);
  const [showActions, setShowActions] = useState(false);
  const [showReactions, setShowReactions] = useState(false);

  // Subscribe to the sender's user doc in real-time.
  // This means username/avatar changes and soft-deletes are reflected instantly,
  // and we avoid the N×getAllUsers() reads that the old code did (one per message).
  useEffect(() => {
    if (!message.senderId) return;
    console.log(`[MessageItem] Subscribing to sender ${message.senderId}`);
    const unsub = onSnapshot(doc(db, 'users', message.senderId), (snap) => {
      if (snap.exists()) {
        setSender({ id: snap.id, ...snap.data() } as User);
      } else {
        // Sender doc missing — show a placeholder so message still renders
        setSender({
          id: message.senderId,
          username: 'Deleted User',
          avatarUrl: '💀',
          email: '',
          bio: '',
          presence: 'offline',
          isAdmin: false,
          isDeleted: true,
        } as User);
      }
    });
    return () => unsub();
  }, [message.senderId]);

  const handleDelete = () => {
    if (currentUser && confirm('Delete this message?')) {
      deleteMessage(message.id, currentUser.id).catch((error) => {
        alert(error instanceof Error ? error.message : 'Failed to delete');
      });
    }
  };

  const handleReaction = async (emoji: string) => {
    if (currentUser) {
      await toggleReaction(message.id, currentUser.id, emoji);
    }
    setShowReactions(false);
  };

  if (message.deleted) {
    return (
      <div className="message-item deleted">
        <div className="message-deleted-text">
          💀 This message was deleted.
        </div>
      </div>
    );
  }

  // Don't render until we have sender info (avoids flash of empty row)
  if (!sender) {
    return null;
  }

  const isOwnMessage = currentUser?.id === message.senderId;
  const isAdmin = currentUser?.isAdmin || false;
  const canDelete = isOwnMessage || isAdmin;

  return (
    <div
      className="message-item"
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => { setShowActions(false); setShowReactions(false); }}
    >
      <Avatar src={sender.avatarUrl} size={32} />

      <div className="message-content">
        <div className="message-header">
          <span className="message-author">
            {sender.username}
            {sender.isAdmin && <span className="admin-crown" title="Admin">👑</span>}
          </span>
          <span className="message-timestamp">{formatTime(message.timestamp)}</span>
        </div>

        <div className="message-bubble panel-outset" style={{ whiteSpace: 'pre-wrap' }}>
          {message.content}
        </div>

        {message.reactions.length > 0 && (
          <div className="message-reactions">
            {message.reactions.map((reaction) => (
              <button
                key={reaction.emoji}
                className={`reaction-badge ${reaction.userIds.includes(currentUser?.id || '') ? 'active' : ''}`}
                onClick={() => handleReaction(reaction.emoji)}
              >
                {reaction.emoji} {reaction.userIds.length}
              </button>
            ))}
          </div>
        )}
      </div>

      {showActions && (
        <div className="message-actions">
          <button
            className="action-btn button-95"
            onClick={() => setShowReactions(!showReactions)}
            title="React"
          >
            😊
          </button>
          {canDelete && (
            <button
              className="action-btn button-95"
              onClick={handleDelete}
              title="Delete"
            >
              🗑️
            </button>
          )}
        </div>
      )}

      {showReactions && (
        <div className="reaction-picker panel">
          {REACTION_EMOJIS.map(emoji => (
            <button
              key={emoji}
              className="reaction-option"
              onClick={() => handleReaction(emoji)}
            >
              {emoji}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default MessageItem;
