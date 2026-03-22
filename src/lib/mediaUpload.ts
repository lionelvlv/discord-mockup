import { Attachment } from '../types/message';

// ── Security constants ────────────────────────────────────────────────────────

export const MAX_FILE_SIZE_BYTES = 8 * 1024 * 1024; // 8 MB
export const MAX_FILES_PER_MESSAGE = 4;

// Strict client-side allowlist. Cloudinary's upload preset is the server gate.
const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/avif',
  'video/mp4', 'video/webm', 'video/ogg', 'video/quicktime',
  'audio/mpeg', 'audio/mp3', 'audio/ogg', 'audio/wav', 'audio/webm', 'audio/aac', 'audio/flac',
  'application/pdf',
]);

const BLOCKED_EXTENSIONS = new Set([
  'exe','msi','bat','cmd','com','pif','scr',
  'sh','bash','zsh','fish','ps1','psm1',
  'js','mjs','cjs','ts','tsx','jsx',
  'html','htm','xhtml','xml','xsl',
  'php','py','rb','pl','lua','r',
  'jar','war','class',
  'dmg','pkg','deb','rpm','apk',
  'vbs','wsf','wsh',
]);

export function getAttachmentKind(mimeType: string): Attachment['kind'] {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  return 'file';
}

export function validateFile(file: File): string | null {
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return `${file.name}: exceeds 8 MB limit (${(file.size / 1024 / 1024).toFixed(1)} MB)`;
  }
  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    return `${file.name}: file type "${file.type}" is not allowed`;
  }
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (BLOCKED_EXTENSIONS.has(ext)) {
    return `${file.name}: .${ext} files are not allowed`;
  }
  return null;
}

// ── Cloudinary upload ─────────────────────────────────────────────────────────
// Uploads directly from the browser to Cloudinary using an unsigned preset.
// No backend or Firebase Storage plan required.

export async function uploadFile(
  file: File,
  _userId: string,
  onProgress?: (pct: number) => void
): Promise<Attachment> {
  const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
  const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

  if (!cloudName || !uploadPreset) {
    throw new Error('Cloudinary is not configured. Add VITE_CLOUDINARY_CLOUD_NAME and VITE_CLOUDINARY_UPLOAD_PRESET to your .env file.');
  }

  // Use 'raw' resource type for PDFs and audio so Cloudinary doesn't try to transform them
  const resourceType = file.type.startsWith('image/') ? 'image'
    : file.type.startsWith('video/') ? 'video'
    : 'raw';

  const url = `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`;

  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', uploadPreset);
  // tag uploads so you can identify them in the Cloudinary dashboard
  formData.append('tags', 'retrochord');

  // Use XHR for upload progress (fetch doesn't expose upload progress)
  const downloadUrl = await new Promise<string>((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        onProgress?.(Math.round((e.loaded / e.total) * 100));
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = JSON.parse(xhr.responseText);
          // Use secure_url (https) always
          resolve(data.secure_url);
        } catch {
          reject(new Error('Invalid response from Cloudinary'));
        }
      } else {
        let msg = `Upload failed (${xhr.status})`;
        try {
          const err = JSON.parse(xhr.responseText);
          if (err.error?.message) msg = err.error.message;
        } catch { /* ignore */ }
        reject(new Error(msg));
      }
    };

    xhr.onerror = () => reject(new Error('Network error during upload'));
    xhr.onabort = () => reject(new Error('Upload cancelled'));

    xhr.open('POST', url);
    xhr.send(formData);
  });

  return {
    url: downloadUrl,
    name: file.name,
    type: file.type,
    size: file.size,
    kind: getAttachmentKind(file.type),
  };
}

// ── Link embed detection ──────────────────────────────────────────────────────

const YOUTUBE_RE = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/;
const VIMEO_RE   = /(?:https?:\/\/)?(?:www\.)?vimeo\.com\/(\d+)/;
const IMAGE_URL_RE = /^https?:\/\/.+\.(jpg|jpeg|png|gif|webp|avif)(\?.*)?$/i;
// Giphy media URLs (e.g. https://media.giphy.com/media/xxx/giphy.gif)
const GIPHY_URL_RE  = /^https?:\/\/media\d*\.giphy\.com\//i;
// Tenor URLs (e.g. https://media.tenor.com/xxx/xxx.gif)
const TENOR_URL_RE  = /^https?:\/\/media\.tenor\.com\//i;

export interface EmbedInfo {
  kind: 'youtube' | 'vimeo' | 'image_url';
  embedUrl: string;
  originalUrl: string;
}

export function detectEmbeds(text: string): EmbedInfo[] {
  const embeds: EmbedInfo[] = [];
  const seen = new Set<string>();
  const tokens = text.match(/https?:\/\/[^\s<>'"]+/g) ?? [];

  for (const token of tokens) {
    if (seen.has(token)) continue;
    seen.add(token);

    const yt = token.match(YOUTUBE_RE);
    if (yt) {
      embeds.push({ kind: 'youtube', embedUrl: `https://www.youtube-nocookie.com/embed/${yt[1]}`, originalUrl: token });
      continue;
    }

    const vm = token.match(VIMEO_RE);
    if (vm) {
      embeds.push({ kind: 'vimeo', embedUrl: `https://player.vimeo.com/video/${vm[1]}`, originalUrl: token });
      continue;
    }

    if (IMAGE_URL_RE.test(token) || GIPHY_URL_RE.test(token) || TENOR_URL_RE.test(token)) {
      embeds.push({ kind: 'image_url', embedUrl: token, originalUrl: token });
    }
  }

  return embeds;
}
