import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../../features/auth/useAuth';
import { setTyping, clearTyping } from '../../features/chat/api';
import {
  validateFile,
  uploadFile,
  MAX_FILES_PER_MESSAGE,
} from '../../lib/mediaUpload';
import { Attachment } from '../../types/message';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { User } from '../../types/user';
import GifPicker from './GifPicker';
import EmojiPicker from './EmojiPicker';
import './MessageComposer.css';

interface PendingFile {
  id: string;           // local key for React
  file: File;
  previewUrl?: string;  // object URL for local image preview
  progress: number;     // 0–100
  uploaded?: Attachment; // set when upload completes
  error?: string;
}

interface MessageComposerProps {
  onSend: (content: string, attachments?: Attachment[]) => void;
  channelId?: string;
  dmId?: string;
}

const MessageComposer: React.FC<MessageComposerProps> = ({ onSend, channelId, dmId }) => {
  const { user } = useAuth();
  const [message, setMessage] = useState('');
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  // Mention autocomplete
  const [users, setUsers] = useState<User[]>([]);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionSuggestions, setMentionSuggestions] = useState<User[]>([]);
  const [mentionIndex, setMentionIndex] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const composerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Close pickers when user clicks anywhere outside the composer
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (composerRef.current && !composerRef.current.contains(e.target as Node)) {
        setShowGifPicker(false);
        setShowEmojiPicker(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Revoke object URLs on unmount to avoid memory leaks
  useEffect(() => {
    return () => {
      pendingFiles.forEach(f => { if (f.previewUrl) URL.revokeObjectURL(f.previewUrl); });
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      if (user) clearTyping(user.id, channelId, dmId);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Subscribe to users for mention autocomplete
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'users'), snap => {
      setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() } as User)).filter(u => !u.isDeleted));
    });
    return unsub;
  }, []);

  // Parse @mention trigger from message
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const cursor = textarea.selectionStart ?? message.length;
    const textBefore = message.slice(0, cursor);
    const match = textBefore.match(/@([a-zA-Z0-9_]*)$/);
    if (match) {
      const q = match[1].toLowerCase();
      setMentionQuery(q);
      const filtered = users
        .filter(u => u.id !== user?.id && u.username.toLowerCase().includes(q))
        .slice(0, 6);
      setMentionSuggestions(filtered);
      setMentionIndex(0);
    } else {
      setMentionQuery(null);
      setMentionSuggestions([]);
    }
  }, [message, users, user?.id]);

  const insertMention = (username: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const cursor = textarea.selectionStart ?? message.length;
    const textBefore = message.slice(0, cursor);
    const replaced = textBefore.replace(/@([a-zA-Z0-9_]*)$/, `@${username} `);
    const newMsg = replaced + message.slice(cursor);
    setMessage(newMsg);
    setMentionQuery(null);
    setMentionSuggestions([]);
    setTimeout(() => {
      textarea.focus();
      const pos = replaced.length;
      textarea.setSelectionRange(pos, pos);
    }, 0);
  };

  const addFiles = useCallback(async (files: File[]) => {
    if (!user) return;

    const remaining = MAX_FILES_PER_MESSAGE - pendingFiles.filter(f => !f.error).length;
    if (remaining <= 0) {
      alert(`You can attach up to ${MAX_FILES_PER_MESSAGE} files per message.`);
      return;
    }

    const toAdd = files.slice(0, remaining);
    const validated: PendingFile[] = [];

    for (const file of toAdd) {
      const err = validateFile(file);
      const previewUrl = file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined;
      validated.push({
        id: `${Date.now()}_${Math.random()}`,
        file,
        previewUrl,
        progress: 0,
        error: err ?? undefined,
      });
    }

    setPendingFiles(prev => [...prev, ...validated]);

    // Upload valid files immediately
    setUploading(true);
    for (const pf of validated) {
      if (pf.error) continue;
      try {
        const attachment = await uploadFile(pf.file, user.id, (pct) => {
          setPendingFiles(prev =>
            prev.map(f => f.id === pf.id ? { ...f, progress: pct } : f)
          );
        });
        setPendingFiles(prev =>
          prev.map(f => f.id === pf.id ? { ...f, progress: 100, uploaded: attachment } : f)
        );
      } catch {
        setPendingFiles(prev =>
          prev.map(f => f.id === pf.id ? { ...f, error: 'Upload failed — try again' } : f)
        );
      }
    }
    setUploading(false);
  }, [user, pendingFiles]);

  const removeFile = (id: string) => {
    setPendingFiles(prev => {
      const pf = prev.find(f => f.id === id);
      if (pf?.previewUrl) URL.revokeObjectURL(pf.previewUrl);
      return prev.filter(f => f.id !== id);
    });
  };

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
    const readyAttachments = pendingFiles
      .filter(f => f.uploaded)
      .map(f => f.uploaded!);

    if (!trimmed && readyAttachments.length === 0) return;
    if (uploading) return;

    onSend(trimmed, readyAttachments.length > 0 ? readyAttachments : undefined);
    setMessage('');
    pendingFiles.forEach(f => { if (f.previewUrl) URL.revokeObjectURL(f.previewUrl); });
    setPendingFiles([]);
    setShowGifPicker(false);
    if (user) clearTyping(user.id, channelId, dmId);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
  };

  // When a GIF is selected, send it immediately as the message content.
  // The URL gets picked up by detectEmbeds in MessageItem and rendered inline.
  const handleGifSelect = (gifUrl: string) => {
    onSend(gifUrl);
    setShowGifPicker(false);
  };

  const handleEmojiSelect = (emoji: string, isCustom?: boolean, customUrl?: string) => {
    setMessage(prev => prev + emoji);
    setShowEmojiPicker(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Mention autocomplete navigation
    if (mentionSuggestions.length > 0) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setMentionIndex(i => Math.min(i + 1, mentionSuggestions.length - 1)); return; }
      if (e.key === 'ArrowUp')   { e.preventDefault(); setMentionIndex(i => Math.max(i - 1, 0)); return; }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        insertMention(mentionSuggestions[mentionIndex]?.username ?? '');
        return;
      }
      if (e.key === 'Escape') { setMentionQuery(null); setMentionSuggestions([]); return; }
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length) addFiles(files);
    // Reset input so the same file can be re-selected if removed
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length) addFiles(files);
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const files = Array.from(e.clipboardData.files);
    if (files.length) {
      e.preventDefault();
      addFiles(files);
    }
  };

  const canSend =
    (message.trim().length > 0 || pendingFiles.some(f => f.uploaded)) && !uploading;

  return (
    <div
      ref={composerRef}
      className={`message-composer panel-outset ${dragOver ? 'drag-over' : ''}`}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      style={{ position: 'relative' }}
    >
      {/* GIF picker popover */}
      {showGifPicker && (
        <GifPicker
          onSelect={handleGifSelect}
          onClose={() => setShowGifPicker(false)}
        />
      )}
      {showEmojiPicker && (
        <EmojiPicker
          onSelect={handleEmojiSelect}
          onClose={() => setShowEmojiPicker(false)}
        />
      )}
      {/* File previews */}
      {pendingFiles.length > 0 && (
        <div className="composer-attachments">
          {pendingFiles.map(pf => (
            <div key={pf.id} className={`attachment-preview ${pf.error ? 'has-error' : ''}`}>
              {pf.previewUrl
                ? <img src={pf.previewUrl} alt={pf.file.name} className="attachment-thumb" />
                : <span className="attachment-icon">{getFileIcon(pf.file.type)}</span>
              }
              <div className="attachment-meta">
                <span className="attachment-name">{pf.file.name}</span>
                {pf.error
                  ? <span className="attachment-error">{pf.error}</span>
                  : pf.progress < 100
                    ? <div className="attachment-progress"><div style={{ width: `${pf.progress}%` }} /></div>
                    : <span className="attachment-done">✓ Ready</span>
                }
              </div>
              <button className="attachment-remove" onClick={() => removeFile(pf.id)} title="Remove">×</button>
            </div>
          ))}
        </div>
      )}

      <form onSubmit={handleSubmit} className="composer-form">
        {/* Hidden multi-file input */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,video/*,audio/*,application/pdf"
          style={{ display: 'none' }}
          onChange={handleFileInput}
        />

        <button
          type="button"
          className="attach-button button-95"
          onClick={() => fileInputRef.current?.click()}
          title="Attach files (images, video, audio, PDF — max 8 MB each)"
          disabled={pendingFiles.filter(f => !f.error).length >= MAX_FILES_PER_MESSAGE}
        >
          📎
        </button>

        <button
          type="button"
          className={`attach-button button-95 ${showEmojiPicker ? 'active' : ''}`}
          onClick={() => { setShowEmojiPicker(v => !v); setShowGifPicker(false); }}
          title="Emoji"
        >
          😊
        </button>

        <button
          type="button"
          className={`attach-button button-95 ${showGifPicker ? 'active' : ''}`}
          onClick={() => { setShowGifPicker(v => !v); setShowEmojiPicker(false); }}
          title="Send a GIF"
        >
          GIF
        </button>

        <div style={{ flex: 1, position: 'relative' }}>
          {/* Mention autocomplete dropdown */}
          {mentionSuggestions.length > 0 && (
            <div className="mention-dropdown panel">
              {mentionSuggestions.map((u, i) => (
                <button
                  key={u.id}
                  className={`mention-item ${i === mentionIndex ? 'active' : ''}`}
                  onMouseDown={e => { e.preventDefault(); insertMention(u.username); }}
                >
                  <span className="mention-avatar">{u.avatarUrl.startsWith('http') ? '👤' : u.avatarUrl}</span>
                  <span className="mention-username">@{u.username}</span>
                </button>
              ))}
            </div>
          )}
          <textarea
            ref={textareaRef}
            className="composer-input textarea-95"
            value={message}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder={dragOver ? 'Drop files here…' : 'Type a message… (Enter to send, Shift+Enter for new line)'}
            rows={2}
          />
        </div>

        <button
          type="submit"
          className="send-button button-95"
          disabled={!canSend}
        >
          {uploading ? '⏳' : 'SEND'}
        </button>
      </form>

      {dragOver && <div className="drop-overlay">Drop files to attach</div>}
    </div>
  );
};

function getFileIcon(mimeType: string): string {
  if (mimeType.startsWith('video/')) return '🎬';
  if (mimeType.startsWith('audio/')) return '🎵';
  if (mimeType === 'application/pdf') return '📄';
  return '📎';
}

export default MessageComposer;
