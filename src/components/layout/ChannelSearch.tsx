import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { Channel } from '../../types/channel';
import { searchChannelMessages, SearchResult } from '../../features/chat/api';
import { formatTime } from '../../lib/time';
import './ChannelSearch.css';

interface Props {
  onNavigate?: () => void;
}

const ChannelSearch: React.FC<Props> = ({ onNavigate }) => {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [channels, setChannels] = useState<Channel[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Subscribe to text channels for search scope
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'channels'), snap => {
      const list = snap.docs
        .map(d => ({ id: d.id, ...d.data() } as Channel))
        .filter(c => !c.isVoiceChannel && !c.isDeleted);
      setChannels(list);
    });
    return unsub;
  }, []);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); setOpen(false); return; }
    setLoading(true);
    try {
      const res = await searchChannelMessages(q, channels);
      setResults(res);
      setOpen(true);
    } catch (e) {
      console.error('[Search] Failed:', e);
    } finally {
      setLoading(false);
    }
  }, [channels]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!val.trim()) { setResults([]); setOpen(false); return; }
    debounceRef.current = setTimeout(() => doSearch(val), 500);
  };

  const handleResultClick = (result: SearchResult) => {
    setOpen(false);
    setQuery('');
    onNavigate?.();
    navigate(`/app/channel/${result.channelId}?highlight=${result.messageId}`);
  };

  // Group results by channel
  const grouped = results.reduce<Record<string, SearchResult[]>>((acc, r) => {
    if (!acc[r.channelId]) acc[r.channelId] = [];
    acc[r.channelId].push(r);
    return acc;
  }, {});

  // Highlight matching text
  const highlight = (text: string, q: string) => {
    const idx = text.toLowerCase().indexOf(q.toLowerCase());
    if (idx === -1) return <span>{text.slice(0, 80)}</span>;
    const before = text.slice(0, idx).slice(-20);
    const match  = text.slice(idx, idx + q.length);
    const after  = text.slice(idx + q.length, idx + q.length + 60);
    return (
      <span>
        {before.length < text.slice(0, idx).length && '…'}
        {before}
        <mark className="search-highlight">{match}</mark>
        {after}
        {after.length < text.slice(idx + q.length).length && '…'}
      </span>
    );
  };

  return (
    <div className="channel-search" ref={containerRef}>
      <div className="channel-search-input-wrap">
        <span className="channel-search-icon">🔍</span>
        <input
          className="channel-search-input"
          type="text"
          placeholder="Search messages…"
          value={query}
          onChange={handleChange}
          onFocus={() => results.length > 0 && setOpen(true)}
          aria-label="Search messages across channels"
        />
        {loading && <span className="channel-search-spinner">⏳</span>}
        {query && !loading && (
          <button
            className="channel-search-clear"
            onClick={() => { setQuery(''); setResults([]); setOpen(false); }}
            aria-label="Clear"
          >✕</button>
        )}
      </div>

      {open && (
        <div className="channel-search-results panel">
          {results.length === 0 && !loading && (
            <div className="search-no-results">No messages found for "{query}"</div>
          )}
          {Object.entries(grouped).map(([channelId, msgs]) => (
            <div key={channelId} className="search-channel-group">
              <div className="search-channel-label">
                # {msgs[0].channelName}
              </div>
              {msgs.map(r => (
                <button
                  key={r.messageId}
                  className="search-result-item"
                  onClick={() => handleResultClick(r)}
                >
                  <span className="search-result-sender">{r.senderName}</span>
                  <span className="search-result-time">{formatTime(r.timestamp)}</span>
                  <div className="search-result-content">
                    {highlight(r.content, query)}
                  </div>
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ChannelSearch;
