import { Attachment } from '../types/message';

// ── Security constants ────────────────────────────────────────────────────────

export const MAX_FILE_SIZE_BYTES = 8 * 1024 * 1024; // 8 MB
export const MAX_FILES_PER_MESSAGE = 4;

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/avif',
  'video/mp4', 'video/webm', 'video/ogg', 'video/quicktime',
  'audio/mpeg', 'audio/mp3', 'audio/ogg', 'audio/wav', 'audio/webm', 'audio/aac', 'audio/flac',
  'application/pdf',
]);

const BLOCKED_EXTENSIONS = new Set([
  'exe','msi','bat','cmd','com','pif','scr','sh','bash','zsh','fish','ps1','psm1',
  'js','mjs','cjs','ts','tsx','jsx','html','htm','xhtml','xml','xsl',
  'php','py','rb','pl','lua','r','jar','war','class','dmg','pkg','deb','rpm','apk','vbs','wsf','wsh',
]);

export function getAttachmentKind(mimeType: string): Attachment['kind'] {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  return 'file';
}

export function validateFile(file: File): string | null {
  if (file.size > MAX_FILE_SIZE_BYTES)
    return `${file.name}: exceeds 8 MB limit (${(file.size / 1024 / 1024).toFixed(1)} MB)`;
  if (!ALLOWED_MIME_TYPES.has(file.type))
    return `${file.name}: file type "${file.type}" is not allowed`;
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (BLOCKED_EXTENSIONS.has(ext))
    return `${file.name}: .${ext} files are not allowed`;
  return null;
}

export async function uploadFile(
  file: File,
  _userId: string,
  onProgress?: (pct: number) => void
): Promise<Attachment> {
  const cloudName    = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
  const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

  if (!cloudName || !uploadPreset)
    throw new Error('Cloudinary is not configured. Add VITE_CLOUDINARY_CLOUD_NAME and VITE_CLOUDINARY_UPLOAD_PRESET to your .env file.');

  const resourceType = file.type.startsWith('image/') ? 'image'
    : file.type.startsWith('video/') ? 'video' : 'raw';

  const url = `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`;
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', uploadPreset);
  formData.append('tags', 'retrochord');

  const downloadUrl = await new Promise<string>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress?.(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try { resolve(JSON.parse(xhr.responseText).secure_url); }
        catch { reject(new Error('Invalid response from Cloudinary')); }
      } else {
        let msg = `Upload failed (${xhr.status})`;
        try { const e = JSON.parse(xhr.responseText); if (e.error?.message) msg = e.error.message; } catch {}
        reject(new Error(msg));
      }
    };
    xhr.onerror = () => reject(new Error('Network error during upload'));
    xhr.open('POST', url);
    xhr.send(formData);
  });

  return { url: downloadUrl, name: file.name, type: file.type, size: file.size, kind: getAttachmentKind(file.type) };
}

// ── Embed detection ───────────────────────────────────────────────────────────

const YOUTUBE_RE  = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/;
const VIMEO_RE    = /(?:https?:\/\/)?(?:www\.)?vimeo\.com\/(\d+)/;
const SPOTIFY_RE  = /https?:\/\/open\.spotify\.com\/(track|album|playlist|episode)\/([a-zA-Z0-9]+)/;
// GitHub: repo page, PR, issue, or gist
const GITHUB_REPO_RE  = /https?:\/\/github\.com\/([a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+)\/?$/;
const GITHUB_PR_RE    = /https?:\/\/github\.com\/[^/]+\/[^/]+\/(pull|issues)\/(\d+)/;
const GITHUB_GIST_RE  = /https?:\/\/gist\.github\.com\/([a-zA-Z0-9_-]+\/[a-zA-Z0-9]+)/;
const IMAGE_URL_RE    = /^https?:\/\/.+\.(jpg|jpeg|png|gif|webp|avif)(\?.*)?$/i;
const GIPHY_URL_RE    = /^https?:\/\/media\d*\.giphy\.com\//i;
const TENOR_URL_RE    = /^https?:\/\/(?:media\.tenor\.com|c\.tenor\.com)\//i;
// Imgur: direct image or album/gallery
const IMGUR_IMG_RE    = /^https?:\/\/(?:i\.)?imgur\.com\/([a-zA-Z0-9]+)\.(jpg|jpeg|png|gif|gifv|mp4|webm)/i;
const IMGUR_ALBUM_RE  = /^https?:\/\/imgur\.com\/(?:a\/|gallery\/)([a-zA-Z0-9]+)/i;

export type EmbedKind =
  | 'youtube' | 'vimeo' | 'spotify'
  | 'github_repo' | 'github_pr' | 'github_gist'
  | 'imgur_image' | 'imgur_album'
  | 'image_url';

export interface EmbedInfo {
  kind: EmbedKind;
  embedUrl: string;   // src for iframe/img
  originalUrl: string;
  meta?: Record<string, string>; // extra info (title, artist, etc. when fetchable)
}

export function detectEmbeds(text: string): EmbedInfo[] {
  const embeds: EmbedInfo[] = [];
  const seen = new Set<string>();
  const tokens = text.match(/https?:\/\/[^\s<>'")\]]+/g) ?? [];

  for (const token of tokens) {
    if (seen.has(token)) continue;
    seen.add(token);

    const yt = token.match(YOUTUBE_RE);
    if (yt) { embeds.push({ kind: 'youtube', embedUrl: `https://www.youtube-nocookie.com/embed/${yt[1]}`, originalUrl: token }); continue; }

    const vm = token.match(VIMEO_RE);
    if (vm) { embeds.push({ kind: 'vimeo', embedUrl: `https://player.vimeo.com/video/${vm[1]}`, originalUrl: token }); continue; }

    const sp = token.match(SPOTIFY_RE);
    if (sp) {
      embeds.push({ kind: 'spotify', embedUrl: `https://open.spotify.com/embed/${sp[1]}/${sp[2]}?utm_source=generator&theme=0`, originalUrl: token });
      continue;
    }

    const ghPR = token.match(GITHUB_PR_RE);
    if (ghPR) { embeds.push({ kind: 'github_pr', embedUrl: token, originalUrl: token }); continue; }

    const ghRepo = token.match(GITHUB_REPO_RE);
    if (ghRepo) { embeds.push({ kind: 'github_repo', embedUrl: token, originalUrl: token, meta: { repo: ghRepo[1] } }); continue; }

    const ghGist = token.match(GITHUB_GIST_RE);
    if (ghGist) { embeds.push({ kind: 'github_gist', embedUrl: token, originalUrl: token }); continue; }

    const imgurImg = token.match(IMGUR_IMG_RE);
    if (imgurImg) {
      // gifv/mp4 → use mp4 src
      const ext = imgurImg[2].toLowerCase();
      const isVideo = ext === 'gifv' || ext === 'mp4' || ext === 'webm';
      const src = isVideo
        ? `https://i.imgur.com/${imgurImg[1]}.mp4`
        : `https://i.imgur.com/${imgurImg[1]}.${ext}`;
      embeds.push({ kind: 'imgur_image', embedUrl: src, originalUrl: token, meta: { isVideo: String(isVideo) } });
      continue;
    }

    const imgurAlbum = token.match(IMGUR_ALBUM_RE);
    if (imgurAlbum) { embeds.push({ kind: 'imgur_album', embedUrl: token, originalUrl: token }); continue; }

    if (IMAGE_URL_RE.test(token) || GIPHY_URL_RE.test(token) || TENOR_URL_RE.test(token)) {
      embeds.push({ kind: 'image_url', embedUrl: token, originalUrl: token });
    }
  }

  return embeds;
}

// ── Link renderer — make URLs in plain text clickable ────────────────────────
// Returns an array of strings and JSX <a> elements for rendering in a message bubble.

const URL_SPLIT_RE = /(https?:\/\/[^\s<>'")\]]+)/g;

export function renderTextWithLinks(text: string): Array<string | { url: string; key: number }> {
  const parts = text.split(URL_SPLIT_RE);
  return parts.map((part, i) =>
    URL_SPLIT_RE.test(part) ? { url: part, key: i } : part
  );
}
// Reset lastIndex after use
URL_SPLIT_RE.lastIndex = 0;
