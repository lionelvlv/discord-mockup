import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../features/auth/useAuth';
import { deleteMessage, toggleReaction, editMessage } from '../../features/chat/api';
import { Message, Attachment } from '../../types/message';
import { User } from '../../types/user';
import { formatTime } from '../../lib/time';
import { detectEmbeds, EmbedInfo } from '../../lib/mediaUpload';
import { useCustomEmojis, RenderWithCustomEmojis } from './CustomEmojiRenderer';
import EmojiPicker from './EmojiPicker';
import Avatar from '../ui/Avatar';
import './MessageItem.css';

interface MessageItemProps {
  message: Message;
  sender: User;
}

const MessageItem: React.FC<MessageItemProps> = ({ message, sender: senderProp }) => {
  const { user: currentUser } = useAuth();
  const customEmojis = useCustomEmojis();
  const [showActions, setShowActions]     = useState(false);
  const [showReactions, setShowReactions] = useState(false);
  const [isEditing, setIsEditing]         = useState(false);
  const [editContent, setEditContent]     = useState(message.content);
  const [editSaving, setEditSaving]       = useState(false);
  const editRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isEditing && editRef.current) {
      editRef.current.focus();
      editRef.current.selectionStart = editRef.current.value.length;
    }
  }, [isEditing]);

  const handleDelete = () => {
    if (currentUser && confirm('Delete this message?')) {
      deleteMessage(message.id, currentUser.id).catch(err =>
        alert(err instanceof Error ? err.message : 'Failed to delete')
      );
    }
  };

  const handleReaction = async (emoji: string) => {
    if (currentUser) await toggleReaction(message.id, currentUser.id, emoji);
    setShowReactions(false);
  };

  const startEdit = () => {
    setEditContent(message.content);
    setIsEditing(true);
  };

  const cancelEdit = () => {
    setIsEditing(false);
    setEditContent(message.content);
  };

  const saveEdit = async () => {
    if (!currentUser || !editContent.trim() || editContent === message.content) {
      cancelEdit(); return;
    }
    setEditSaving(true);
    try {
      await editMessage(message.id, currentUser.id, editContent.trim());
      setIsEditing(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to edit');
    } finally {
      setEditSaving(false);
    }
  };

  const handleEditKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveEdit(); }
    if (e.key === 'Escape') cancelEdit();
  };

  if (message.deleted) {
    return (
      <div className="message-item deleted">
        <div className="message-deleted-text">💀 This message was deleted.</div>
      </div>
    );
  }

  const isOwnMessage = currentUser?.id === message.senderId;
  const canDelete    = isOwnMessage || currentUser?.isAdmin;
  const canEdit      = isOwnMessage;
  const embeds       = detectEmbeds(message.content);
  const sender       = senderProp.isDeleted
    ? { ...senderProp, username: 'Deleted User', avatarUrl: '💀' }
    : senderProp;

  return (
    <div
      className="message-item"
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => { if (!showReactions) setShowActions(false); }}
    >
      <Avatar src={sender.avatarUrl} size={32} />

      <div className="message-content">
        <div className="message-header">
          <span className="message-author">
            {sender.username}
            {sender.isAdmin && <span className="admin-crown" title="Admin">👑</span>}
          </span>
          <span className="message-timestamp">{formatTime(message.timestamp)}</span>
          {message.editedAt && <span className="message-edited">(edited)</span>}
        </div>

        {/* Editing inline */}
        {isEditing ? (
          <div className="message-edit-wrap">
            <textarea
              ref={editRef}
              className="message-edit-input textarea-95"
              value={editContent}
              onChange={e => setEditContent(e.target.value)}
              onKeyDown={handleEditKeyDown}
              rows={Math.max(2, editContent.split('\n').length)}
              disabled={editSaving}
            />
            <div className="message-edit-actions">
              <span className="message-edit-hint">Enter to save · Esc to cancel</span>
              <button className="button-95" onClick={saveEdit} disabled={editSaving}>
                {editSaving ? '…' : '✓ Save'}
              </button>
              <button className="button-95" onClick={cancelEdit} disabled={editSaving}>✕</button>
            </div>
          </div>
        ) : (
          <>
            {message.content && (
              <div className="message-bubble panel-outset">
                <RenderWithCustomEmojis text={message.content} customEmojis={customEmojis} />
              </div>
            )}

            {message.attachments && message.attachments.length > 0 && (
              <div className="message-attachments">
                {message.attachments.map((att, i) => (
                  <AttachmentRenderer key={i} attachment={att} />
                ))}
              </div>
            )}

            {embeds.length > 0 && (
              <div className="message-embeds">
                {embeds.map((e, i) => <EmbedRenderer key={i} embed={e} />)}
              </div>
            )}

            {message.reactions && message.reactions.length > 0 && (
              <div className="message-reactions">
                {message.reactions.map(reaction => {
                  const isCustom = reaction.emoji.startsWith(':') && reaction.emoji.endsWith(':');
                  const ce = isCustom ? customEmojis.find(e => `:${e.name}:` === reaction.emoji) : null;
                  return (
                    <button
                      key={reaction.emoji}
                      className={`reaction-badge ${reaction.userIds.includes(currentUser?.id ?? '') ? 'active' : ''}`}
                      onClick={() => handleReaction(reaction.emoji)}
                      title={reaction.emoji}
                    >
                      {ce ? <img src={ce.url} alt={reaction.emoji} className="reaction-custom-emoji" /> : reaction.emoji}
                      {' '}{reaction.userIds.length}
                    </button>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      {/* Hover action bar */}
      {showActions && !isEditing && (
        <div className="message-actions">
          {/* React button + picker */}
          <div style={{ position: 'relative' }}>
            <button
              className="action-btn button-95"
              onClick={() => setShowReactions(v => !v)}
              title="React"
            >😊</button>
            {showReactions && (
              <div className="reaction-picker-anchor">
                <EmojiPicker
                  onSelect={emoji => handleReaction(emoji)}
                  onClose={() => { setShowReactions(false); setShowActions(false); }}
                />
              </div>
            )}
          </div>
          {canEdit && (
            <button className="action-btn button-95" onClick={startEdit} title="Edit">✏️</button>
          )}
          {canDelete && (
            <button className="action-btn button-95" onClick={handleDelete} title="Delete">🗑️</button>
          )}
        </div>
      )}
    </div>
  );
};

// ── Helpers ────────────────────────────────────────────────────────────────────
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
          <img src={url} alt={name} className="attachment-image" loading="lazy" referrerPolicy="no-referrer" />
        </a>
        <div className="attachment-filename">{name}</div>
      </div>
    );
  }

  if (kind === 'video') {
    return (
      <div className="attachment-video-wrap">
        <video src={url} controls preload="metadata" className="attachment-video">
          Your browser does not support video playback.
        </video>
        <div className="attachment-filename">{name}</div>
      </div>
    );
  }

  if (kind === 'audio') {
    return (
      <div className="attachment-audio-wrap">
        <audio src={url} controls preload="metadata" className="attachment-audio" />
        <div className="attachment-filename">{name}</div>
      </div>
    );
  }

  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="attachment-file panel-inset">
      <span className="attachment-file-icon">📎</span>
      <div className="attachment-file-info">
        <span className="attachment-file-name">{name}</span>
        {size && <span className="attachment-file-size">{formatBytes(size)}</span>}
      </div>
    </a>
  );
};

const EmbedRenderer: React.FC<{ embed: EmbedInfo }> = ({ embed }) => {
  if (embed.kind === 'image_url') {
    return (
      <div className="attachment-image-wrap">
        <a href={embed.originalUrl} target="_blank" rel="noopener noreferrer">
          <img src={embed.embedUrl} alt="Linked image" className="attachment-image" loading="lazy" />
        </a>
      </div>
    );
  }
  if (embed.kind === 'imgur_image') {
    if (embed.meta?.isVideo === 'true') {
      return (
        <div className="attachment-video-wrap">
          <video controls preload="metadata" className="attachment-video" loop>
            <source src={embed.embedUrl} type="video/mp4" />
          </video>
          <a href={embed.originalUrl} target="_blank" rel="noopener noreferrer" className="embed-source-link">↗ Imgur</a>
        </div>
      );
    }
    return (
      <div className="attachment-image-wrap">
        <a href={embed.originalUrl} target="_blank" rel="noopener noreferrer">
          <img src={embed.embedUrl} alt="Imgur" className="attachment-image" loading="lazy" />
        </a>
      </div>
    );
  }
  if (embed.kind === 'imgur_album' || embed.kind === 'github_repo' || embed.kind === 'github_pr' || embed.kind === 'github_gist') {
    const icon = embed.kind === 'imgur_album' ? '🖼️' : embed.kind === 'github_gist' ? '📄' : embed.kind === 'github_pr' ? '🔀' : '📦';
    const label = embed.kind === 'imgur_album' ? 'Imgur Album'
      : embed.kind === 'github_gist' ? 'GitHub Gist'
      : embed.kind === 'github_pr' ? 'GitHub PR/Issue'
      : `GitHub — ${embed.meta?.repo ?? ''}`;
    return (
      <a href={embed.originalUrl} target="_blank" rel="noopener noreferrer" className="embed-card panel-inset">
        <span className="embed-card-icon">{icon}</span>
        <div className="embed-card-info">
          <span className="embed-card-site">{label}</span>
          <span className="embed-card-url">{embed.originalUrl}</span>
        </div>
      </a>
    );
  }
  if (embed.kind === 'spotify') {
    return (
      <div className="embed-video-wrap">
        <iframe src={embed.embedUrl} className="embed-spotify" title="Spotify" frameBorder="0"
          allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy" />
        <a href={embed.originalUrl} target="_blank" rel="noopener noreferrer" className="embed-source-link">↗ {embed.originalUrl}</a>
      </div>
    );
  }
  return (
    <div className="embed-video-wrap">
      <iframe src={embed.embedUrl} className="embed-video" title={embed.kind === 'youtube' ? 'YouTube' : 'Vimeo'}
        frameBorder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen" loading="lazy" />
      <a href={embed.originalUrl} target="_blank" rel="noopener noreferrer" className="embed-source-link">↗ {embed.originalUrl}</a>
    </div>
  );
};

export default MessageItem;
