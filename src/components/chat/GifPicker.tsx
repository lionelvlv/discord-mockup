import React, { useState, useEffect, useRef, useCallback } from 'react';
import './GifPicker.css';

// ── Types ─────────────────────────────────────────────────────────────────────
interface GifResult {
  id: string;
  url: string;      // full-size URL sent as message (detected by embed system)
  preview: string;  // small preview for the grid
  title: string;
}

interface GifPickerProps {
  onSelect: (gifUrl: string) => void;
  onClose: () => void;
}

// ── Constants ─────────────────────────────────────────────────────────────────
const API_KEY  = import.meta.env.VITE_GIPHY_API_KEY as string | undefined;
const PAGE_SIZE = 18; // keep grid full without burning quota

// Emotion categories shown as quick-pick buttons
const CATEGORIES = [
  { label: '🔥 Trending', query: '' },
  { label: '😂 LOL',      query: 'lol funny' },
  { label: '👍 Yes',      query: 'yes agree' },
  { label: '👎 No',       query: 'no nope' },
  { label: '😍 Love',     query: 'love heart' },
  { label: '😤 Angry',    query: 'angry mad' },
  { label: '😢 Sad',      query: 'sad crying' },
  { label: '🤔 Hmm',      query: 'thinking hmm' },
  { label: '🎉 Hype',     query: 'hype celebration' },
  { label: '👀 OMG',      query: 'omg shocked' },
  { label: '🙏 Sorry',    query: 'sorry apologize' },
  { label: '😴 Boring',   query: 'boring tired' },
];

// ── In-memory result cache — keyed by "query:offset" ─────────────────────────
// One fetch = 1 API call. Cache prevents re-fetching when switching between
// categories or re-opening the picker. Cleared when the component is re-mounted.
const gifCache = new Map<string, GifResult[]>();

async function fetchGifs(query: string, offset: number): Promise<GifResult[]> {
  if (!API_KEY) return [];
  const cacheKey = `${query}:${offset}`;
  if (gifCache.has(cacheKey)) return gifCache.get(cacheKey)!;

  const endpoint = query.trim()
    ? `https://api.giphy.com/v1/gifs/search?api_key=${API_KEY}&q=${encodeURIComponent(query)}&rating=g&limit=${PAGE_SIZE}&offset=${offset}`
    : `https://api.giphy.com/v1/gifs/trending?api_key=${API_KEY}&rating=g&limit=${PAGE_SIZE}&offset=${offset}`;

  const res = await fetch(endpoint);
  if (!res.ok) throw new Error(`Giphy ${res.status}`);
  const json = await res.json();

  const results: GifResult[] = (json.data as any[])
    .map((g: any) => ({
      id: g.id,
      url:     g.images?.downsized_medium?.url ?? g.images?.original?.url ?? '',
      preview: g.images?.fixed_height_small?.url ?? g.images?.fixed_height?.url ?? '',
      title:   g.title ?? '',
    }))
    .filter((g) => g.url && g.preview);

  gifCache.set(cacheKey, results);
  return results;
}

// ── Component ─────────────────────────────────────────────────────────────────
const GifPicker: React.FC<GifPickerProps> = ({ onSelect, onClose }) => {
  const [searchQuery, setSearchQuery] = useState('');  // raw input
  const [activeQuery, setActiveQuery] = useState('');  // debounced / category
  const [activeCategory, setActiveCategory] = useState(0);
  const [gifs, setGifs] = useState<GifResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  // Core load function — idempotent via cache
  const load = useCallback(async (q: string, off: number, append: boolean) => {
    if (!API_KEY) {
      setError('Add VITE_GIPHY_API_KEY to your .env to enable GIFs.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const results = await fetchGifs(q, off);
      setGifs((prev) => (append ? [...prev, ...results] : results));
      setHasMore(results.length === PAGE_SIZE);
      setOffset(off + results.length);
    } catch {
      setError('Could not load GIFs — try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Load trending on first open
  useEffect(() => { load('', 0, false); }, [load]);

  // Debounced search — 600 ms to be gentle on quota
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const q = searchQuery.trim();
      setActiveQuery(q);
      setOffset(0);
      load(q, 0, false);
      // Deselect category if user typed something
      if (q) setActiveCategory(-1);
    }, 600);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [searchQuery, load]);

  // Select a quick-pick category
  const handleCategory = (idx: number) => {
    const cat = CATEGORIES[idx];
    setActiveCategory(idx);
    setSearchQuery('');
    setActiveQuery(cat.query);
    setOffset(0);
    load(cat.query, 0, false);
  };

  // Close on Escape
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  const handleSelect = (gif: GifResult) => {
    onSelect(gif.url);
    onClose();
  };

  const handleLoadMore = () => load(activeQuery, offset, true);

  return (
    <div className="gif-picker panel">
      {/* Title bar — Win98 style */}
      <div className="gif-picker-titlebar">
        <span className="gif-picker-title">GIF SELECTOR</span>
        <button className="gif-picker-close button-95" onClick={onClose} aria-label="Close GIF picker">✕</button>
      </div>

      {/* Search */}
      <div className="gif-picker-search-row">
        <input
          className="gif-picker-search input-95"
          type="text"
          placeholder="Search GIPHY… (e.g. cat, wow, fail)"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          autoFocus
        />
      </div>

      {/* Quick-pick emotion categories */}
      <div className="gif-category-bar">
        {CATEGORIES.map((cat, i) => (
          <button
            key={cat.query + i}
            className={`gif-category-btn button-95 ${activeCategory === i ? 'active' : ''}`}
            onClick={() => handleCategory(i)}
            title={cat.label}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Active label */}
      <div className="gif-active-label">
        {activeCategory >= 0 && !searchQuery
          ? CATEGORIES[activeCategory]?.label
          : searchQuery
            ? `Results for: "${searchQuery}"`
            : 'Trending'}
      </div>

      {/* Grid */}
      <div className="gif-grid" ref={gridRef}>
        {error && <div className="gif-error">{error}</div>}

        {gifs.map((gif) => (
          <button
            key={gif.id}
            className="gif-item"
            onClick={() => handleSelect(gif)}
            title={gif.title}
            aria-label={gif.title || 'Select GIF'}
          >
            <img src={gif.preview} alt={gif.title} loading="lazy" className="gif-thumb" />
          </button>
        ))}

        {loading && Array.from({ length: 9 }).map((_, i) => (
          <div key={`sk-${i}`} className="gif-skeleton" aria-hidden="true" />
        ))}

        {!loading && gifs.length === 0 && !error && (
          <div className="gif-empty">No GIFs found. Try a different search!</div>
        )}
      </div>

      {/* Load more */}
      {!loading && hasMore && gifs.length > 0 && (
        <button className="gif-load-more button-95" onClick={handleLoadMore}>
          Load more
        </button>
      )}

      <div className="gif-attribution">Powered by GIPHY · All results rated G (SFW only)</div>
    </div>
  );
};

export default GifPicker;
