import React, { useState } from 'react';
import { useAuth } from '../../features/auth/useAuth';
import { deleteMessage, toggleReaction } from '../../features/chat/api';
import { Message, Attachment } from '../../types/message';
import { User } from '../../types/user';
import { formatTime } from '../../lib/time';
import { REACTION_EMOJIS } from '../../lib/constants';
import { detectEmbeds, EmbedInfo } from '../../lib/mediaUpload';
import Avatar from '../ui/Avatar';
import './MessageItem.css';

interface MessageItemProps {
  message: Message;
  // Always provided by MessageList from its shared user subscription.
  sender: User;
}

const MessageItem: React.FC<MessageItemProps> = ({ message, sender: senderProp }) => {
  const { user: currentUser } = useAuth();
  const [showActions, setShowActions] = useState(false);
  const [showReactions, setShowReactions] = useState(false);

  const handleDelete = () => {
    if (currentUser && confirm('Delete this message?')) {
      deleteMessage(message.id, currentUser.id).catch((error) => {
        alert(error instanceof Error ? error.message : 'Failed to delete');
      });
    }
  };

  const handleReaction = async (emoji: string) => {
    if (currentUser) await toggleReaction(message.id, currentUser.id, emoji);
    setShowReactions(false);
  };

  if (message.deleted) {
    return (
      <div className="message-item deleted">
        <div className="message-deleted-text">💀 This message was deleted.</div>
      </div>
    );
  }

  const isOwnMessage = currentUser?.id === message.senderId;
  const canDelete = isOwnMessage || currentUser?.isAdmin;
  const embeds = detectEmbeds(message.content);

  // Resolve display sender — show placeholder for deleted accounts
  const sender = senderProp.isDeleted
    ? { ...senderProp, username: 'Deleted User', avatarUrl: '💀' }
    : senderProp;

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

        {message.content && (
          <div className="message-bubble panel-outset" style={{ whiteSpace: 'pre-wrap' }}>
            {message.content}
          </div>
        )}

        {/* Uploaded attachments */}
        {message.attachments && message.attachments.length > 0 && (
          <div className="message-attachments">
            {message.attachments.map((att, i) => (
              <AttachmentRenderer key={i} attachment={att} />
            ))}
          </div>
        )}

        {/* Auto-detected link embeds from message text */}
        {embeds.length > 0 && (
          <div className="message-embeds">
            {embeds.map((e, i) => (
              <EmbedRenderer key={i} embed={e} />
            ))}
          </div>
        )}

        {message.reactions && message.reactions.length > 0 && (
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
          <button className="action-btn button-95" onClick={() => setShowReactions(!showReactions)} title="React">
            😊
          </button>
          {canDelete && (
            <button className="action-btn button-95" onClick={handleDelete} title="Delete">
              🗑️
            </button>
          )}
        </div>
      )}

      {showReactions && (
        <div className="reaction-picker panel">
          {REACTION_EMOJIS.map(emoji => (
            <button key={emoji} className="reaction-option" onClick={() => handleReaction(emoji)}>
              {emoji}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// ── Attachment renderer ──────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

const AttachmentRenderer: React.FC<{ attachment: Attachment }> = ({ attachment }) => {
  const { url, name, type, size, kind } = attachment;

  if (kind === 'image') {
    return (
      <div className="attachment-image-wrap">
        <a href={url} target="_blank" rel="noopener noreferrer">
          <img
            src={url}
            alt={name}
            className="attachment-image"
            loading="lazy"
            // Prevent the image from being used as a 1x1 tracker beacon
            referrerPolicy="no-referrer"
          />
        </a>
        <div className="attachment-filename">{name}</div>
      </div>
    );
  }

  if (kind === 'video') {
    return (
      <div className="attachment-video-wrap">
        <video
          controls
          preload="metadata"
          className="attachment-video"
        >
          <source src={url} type={type} />
          Your browser does not support video playback.
        </video>
        <div className="attachment-filename">{name}</div>
      </div>
    );
  }

  if (kind === 'audio') {
    return (
      <div className="attachment-audio-wrap panel-inset">
        <span className="attachment-audio-icon">🎵</span>
        <div className="attachment-audio-info">
          <div className="attachment-filename">{name}</div>
          <audio controls preload="metadata" className="attachment-audio">
            <source src={url} type={type} />
          </audio>
        </div>
      </div>
    );
  }

  // Generic file download
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="attachment-file panel-inset"
      download={name}
    >
      <span className="attachment-file-icon">📄</span>
      <div className="attachment-file-info">
        <span className="attachment-filename">{name}</span>
        {size != null && <span className="attachment-filesize">{formatBytes(size)}</span>}
      </div>
      <span className="attachment-download-hint">⬇ Download</span>
    </a>
  );
};

// ── Embed renderer ───────────────────────────────────────────────────────────

const EmbedRenderer: React.FC<{ embed: EmbedInfo }> = ({ embed }) => {
  if (embed.kind === 'image_url') {
    return (
      <div className="attachment-image-wrap">
        <a href={embed.originalUrl} target="_blank" rel="noopener noreferrer">
          <img
            src={embed.embedUrl}
            alt="Linked image"
            className="attachment-image"
            loading="lazy"
            referrerPolicy="no-referrer"
          />
        </a>
      </div>
    );
  }

  // YouTube / Vimeo — these are explicitly trusted domains so no sandbox needed.
  // sandbox without allow-same-origin breaks YouTube's player (cache storage access).
  // allowFullScreen is a separate iframe attribute, not a sandbox token.
  return (
    <div className="embed-video-wrap">
      <iframe
        src={embed.embedUrl}
        className="embed-video"
        title={embed.kind === 'youtube' ? 'YouTube video' : 'Vimeo video'}
        frameBorder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
        allowFullScreen
        loading="lazy"
        referrerPolicy="no-referrer"
      />
      <a
        href={embed.originalUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="embed-source-link"
      >
        ↗ {embed.originalUrl}
      </a>
    </div>
  );
};

export default MessageItem;
