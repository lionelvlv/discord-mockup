import React, { useState, useEffect, useRef, useCallback } from 'react';
import './GifPicker.css';

interface GifResult {
  id: string;
  url: string;       // direct media URL (ends in .gif — detected by embed system)
  preview: string;   // smaller preview for the grid
  title: string;
}

interface GifPickerProps {
  onSelect: (gifUrl: string) => void;
  onClose: () => void;
}

const API_KEY = import.meta.env.VITE_GIPHY_API_KEY as string | undefined;
const PAGE_SIZE = 24;

// Fetches from Giphy with rating=g (strict SFW filter)
async function fetchGifs(query: string, offset: number): Promise<GifResult[]> {
  if (!API_KEY) return [];

  const endpoint = query.trim()
    ? `https://api.giphy.com/v1/gifs/search?api_key=${API_KEY}&q=${encodeURIComponent(query)}&rating=g&limit=${PAGE_SIZE}&offset=${offset}`
    : `https://api.giphy.com/v1/gifs/trending?api_key=${API_KEY}&rating=g&limit=${PAGE_SIZE}&offset=${offset}`;

  const res = await fetch(endpoint);
  if (!res.ok) throw new Error(`Giphy error ${res.status}`);
  const json = await res.json();

  return (json.data as any[]).map((g: any) => ({
    id: g.id,
    // Use downsized_medium for send (still a real .gif URL the embed system detects)
    url: g.images?.downsized_medium?.url ?? g.images?.original?.url ?? '',
    // Use fixed_height_small for the grid preview
    preview: g.images?.fixed_height_small?.url ?? g.images?.fixed_height?.url ?? '',
    title: g.title ?? '',
  })).filter(g => g.url && g.preview);
}

const GifPicker: React.FC<GifPickerProps> = ({ onSelect, onClose }) => {
  const [query, setQuery] = useState('');
  const [gifs, setGifs] = useState<GifResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async (q: string, off: number, append: boolean) => {
    if (!API_KEY) {
      setError('Add VITE_GIPHY_API_KEY to your .env to enable GIF search.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const results = await fetchGifs(q, off);
      setGifs(prev => append ? [...prev, ...results] : results);
      setHasMore(results.length === PAGE_SIZE);
      setOffset(off + results.length);
    } catch (e) {
      setError('Failed to load GIFs. Try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Load trending on mount
  useEffect(() => {
    load('', 0, false);
  }, [load]);

  // Debounced search
  useEffect(() => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      setOffset(0);
      load(query, 0, false);
    }, 400);
    return () => { if (searchTimeout.current) clearTimeout(searchTimeout.current); };
  }, [query, load]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleSelect = (gif: GifResult) => {
    onSelect(gif.url);
    onClose();
  };

  return (
    <div className="gif-picker panel" ref={containerRef}>
      <div className="gif-picker-header">
        <span className="gif-picker-title pixel-font">GIFs</span>
        <button className="gif-picker-close button-95" onClick={onClose} aria-label="Close">×</button>
      </div>

      <div className="gif-search-row">
        <input
          className="gif-search-input input-95"
          type="text"
          placeholder="Search GIFs… (powered by GIPHY)"
          value={query}
          onChange={e => setQuery(e.target.value)}
          autoFocus
        />
      </div>

      {error && <div className="gif-error">{error}</div>}

      <div className="gif-grid">
        {gifs.map(gif => (
          <button
            key={gif.id}
            className="gif-item"
            onClick={() => handleSelect(gif)}
            title={gif.title}
            aria-label={gif.title || 'GIF'}
          >
            <img
              src={gif.preview}
              alt={gif.title}
              loading="lazy"
              className="gif-thumb"
            />
          </button>
        ))}
        {loading && Array.from({ length: 8 }).map((_, i) => (
          <div key={`sk-${i}`} className="gif-skeleton" />
        ))}
      </div>

      {!loading && hasMore && gifs.length > 0 && (
        <button
          className="gif-load-more button-95"
          onClick={() => load(query, offset, true)}
        >
          Load more
        </button>
      )}

      <div className="gif-attribution">
        Powered by GIPHY · All results rated G (SFW)
      </div>
    </div>
  );
};

export default GifPicker;
