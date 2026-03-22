import React, { useEffect, useState } from 'react';
import { subscribeToCustomEmojis, CustomEmoji } from '../../features/customEmojis/api';

// Singleton subscription — shared across all MessageItems
let cachedEmojis: CustomEmoji[] = [];
const listeners = new Set<() => void>();
let unsubFn: (() => void) | null = null;

function ensureSubscription() {
  if (unsubFn) return;
  unsubFn = subscribeToCustomEmojis(emojis => {
    cachedEmojis = emojis;
    listeners.forEach(fn => fn());
  });
}

export function useCustomEmojis() {
  const [emojis, setEmojis] = useState<CustomEmoji[]>(cachedEmojis);
  useEffect(() => {
    ensureSubscription();
    const update = () => setEmojis([...cachedEmojis]);
    listeners.add(update);
    return () => { listeners.delete(update); };
  }, []);
  return emojis;
}

const URL_RE = /(https?:\/\/[^\s<>'")\]]+)/g;

// Render text with custom emoji tokens, clickable URLs, and @mention highlights
export const RenderWithCustomEmojis: React.FC<{ text: string; customEmojis: CustomEmoji[] }> = ({ text, customEmojis }) => {
  const emojiMap = new Map(customEmojis.map(e => [`:${e.name}:`, e]));
  // Split on custom emoji tokens, URLs, and @mentions
  const parts = text.split(/(:[a-z0-9_]+:|https?:\/\/[^\s<>'")\]]+|@[a-zA-Z0-9_]+)/g);

  return (
    <span style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
      {parts.map((part, i) => {
        const ce = emojiMap.get(part);
        if (ce) {
          return <img key={i} src={ce.url} alt={part} title={part} className="inline-custom-emoji" />;
        }
        if (/^https?:\/\//.test(part)) {
          return <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="msg-link">{part}</a>;
        }
        if (/^@[a-zA-Z0-9_]+$/.test(part)) {
          return <span key={i} className="msg-mention">{part}</span>;
        }
        return <React.Fragment key={i}>{part}</React.Fragment>;
      })}
    </span>
  );
};
