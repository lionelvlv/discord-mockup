import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../../features/auth/useAuth';
import { setTyping, clearTyping } from '../../features/chat/api';
import {
  validateFile,
  uploadFile,
  MAX_FILES_PER_MESSAGE,
} from '../../lib/mediaUpload';
import { Attachment } from '../../types/message';
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Revoke object URLs on unmount to avoid memory leaks
  useEffect(() => {
    return () => {
      pendingFiles.forEach(f => { if (f.previewUrl) URL.revokeObjectURL(f.previewUrl); });
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      if (user) clearTyping(user.id, channelId, dmId);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

    // Require either text or at least one successfully uploaded file
    if (!trimmed && readyAttachments.length === 0) return;
    if (uploading) return; // wait for uploads to finish

    onSend(trimmed, readyAttachments.length > 0 ? readyAttachments : undefined);
    setMessage('');
    // Revoke preview URLs
    pendingFiles.forEach(f => { if (f.previewUrl) URL.revokeObjectURL(f.previewUrl); });
    setPendingFiles([]);
    if (user) clearTyping(user.id, channelId, dmId);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
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
      className={`message-composer panel-outset ${dragOver ? 'drag-over' : ''}`}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
    >
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
          title="Attach files (images, video, audio, PDF — max 25 MB each)"
          disabled={pendingFiles.filter(f => !f.error).length >= MAX_FILES_PER_MESSAGE}
        >
          📎
        </button>

        <textarea
          className="composer-input textarea-95"
          value={message}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder={dragOver ? 'Drop files here…' : 'Type a message… (Enter to send, Shift+Enter for new line)'}
          rows={2}
        />

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
