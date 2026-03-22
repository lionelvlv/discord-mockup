import React, { useState, useEffect, useRef, useMemo } from 'react';
import { subscribeToCustomEmojis, CustomEmoji } from '../../features/customEmojis/api';
import './EmojiPicker.css';

// ── Standard emoji data ───────────────────────────────────────────────────────
const EMOJI_CATEGORIES: { label: string; icon: string; emojis: string[] }[] = [
  { label: 'Recent', icon: '🕐', emojis: [] }, // filled at runtime
  {
    label: 'Smileys', icon: '😀', emojis: [
      '😀','😃','😄','😁','😆','😅','🤣','😂','🙂','🙃','😉','😊','😇','🥰','😍','🤩','😘','😗','😚','😙',
      '😛','😜','🤪','😝','🤑','🤗','🤭','🤫','🤔','🤐','🤨','😐','😑','😶','😏','😒','🙄','😬','🤥','😌',
      '😔','😪','🤤','😴','😷','🤒','🤕','🤢','🤧','🥵','🥶','🥴','😵','🤯','🤠','🥳','😎','🤓','🧐',
      '😕','😟','🙁','☹️','😮','😯','😲','😳','🥺','😦','😧','😨','😰','😥','😢','😭','😱','😖','😣',
      '😞','😓','😩','😫','🥱','😤','😡','😠','🤬','😈','👿','💀','☠️','💩','🤡','👹','👺','👻','👽','👾','🤖',
    ],
  },
  {
    label: 'People', icon: '👋', emojis: [
      '👋','🤚','🖐️','✋','🖖','👌','🤌','🤏','✌️','🤞','🤟','🤘','🤙','👈','👉','👆','🖕','👇','☝️','👍',
      '👎','✊','👊','🤛','🤜','👏','🙌','👐','🤲','🤝','🙏','✍️','💅','🤳','💪','🦾','🦵','🦶','👂','🦻',
      '👃','🧠','🫀','🫁','🦷','🦴','👀','👁️','👅','👄','🫦','👶','🧒','👦','👧','🧑','👱','👨','🧔',
      '👩','🧓','👴','👵','🙍','🙎','🙅','🙆','💁','🙋','🧏','🙇','🤦','🤷',
    ],
  },
  {
    label: 'Nature', icon: '🌿', emojis: [
      '🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐨','🐯','🦁','🐮','🐷','🐸','🐵','🙈','🙉','🙊','🐔','🐧',
      '🐦','🦆','🦅','🦉','🦇','🐺','🐗','🐴','🦄','🐝','🐛','🦋','🐌','🐞','🐜','🦟','🦗','🌸','🌺','🌻',
      '🌼','🌷','🌱','🌲','🌳','🌴','🌵','🌾','🍀','🍁','🍂','🍃','🌍','🌎','🌏','🌙','⭐','🌟','💫','⚡',
      '🔥','💥','❄️','🌊','🌈','☀️','🌤️','⛅','🌥️','☁️','🌦️','🌧️','⛈️','🌩️','🌨️','🌬️','🌀','🌫️','🌊',
    ],
  },
  {
    label: 'Food', icon: '🍕', emojis: [
      '🍎','🍊','🍋','🍇','🍓','🫐','🍈','🍒','🍑','🥭','🍍','🥥','🥝','🍅','🫒','🥑','🍆','🥦','🥬','🥒',
      '🌶️','🫑','🌽','🥕','🧄','🧅','🥔','🍠','🥐','🥯','🍞','🥖','🥨','🧀','🥚','🍳','🧈','🥞','🧇','🥓',
      '🍔','🍟','🍕','🌭','🥪','🌮','🌯','🫔','🥙','🧆','🥚','🍳','🥘','🍲','🫕','🍜','🍝','🍛','🍣','🍱',
      '🍤','🍙','🍚','🍘','🍥','🥮','🍢','🍡','🍧','🍨','🍦','🥧','🧁','🎂','🍰','🍮','🍭','🍬','🍫','🍿',
      '🍩','🍪','🌰','🥜','🍯','🧃','🥤','🧋','☕','🍵','🫖','🍺','🍻','🥂','🍷','🫗','🥃','🍸','🍹','🧉',
    ],
  },
  {
    label: 'Activities', icon: '⚽', emojis: [
      '⚽','🏀','🏈','⚾','🥎','🎾','🏐','🏉','🥏','🎱','🪀','🏓','🏸','🏒','🥅','⛳','🪁','🏹','🎣','🤿',
      '🥊','🥋','🎽','🛹','🛼','🛷','⛸️','🥌','🎿','⛷️','🏂','🪂','🏋️','🤼','🤸','⛹️','🤺','🏇','🧘','🏄',
      '🏊','🚴','🏆','🥇','🥈','🥉','🏅','🎖️','🎗️','🎫','🎟️','🎪','🤹','🎭','🎨','🎬','🎤','🎧','🎼',
      '🎵','🎶','🎷','🥁','🎸','🎹','🎺','🎻','🪕','🎲','♟️','🎯','🎳','🪃','🎮','🕹️','🎰',
    ],
  },
  {
    label: 'Objects', icon: '💡', emojis: [
      '⌚','📱','💻','⌨️','🖥️','🖨️','🖱️','💾','💿','📀','📷','📸','📹','📼','📞','☎️','📟','📠','📺','📻',
      '🧭','⏰','⌛','⏳','📡','🔋','🔌','💡','🔦','🕯️','🪔','🧱','💰','💴','💵','💸','💳','🏧','💹','💱',
      '📈','📉','📊','📋','📌','📍','📎','🖇️','📐','📏','✂️','🗃️','🗑️','🔒','🔓','🔏','🔐','🔑','🗝️',
      '🔨','⛏️','⚒️','🛠️','🗡️','⚔️','🔫','🏹','🛡️','🔧','🔩','⚙️','🗜️','⚖️','🦯','🔗','⛓️','🧲','🔬',
      '🔭','📡','💉','🩸','💊','🩹','🩺','🚪','🛏️','🛋️','🪑','🚽','🪠','🚿','🛁','🧴','🧷','🧹','🧺',
    ],
  },
  {
    label: 'Symbols', icon: '💯', emojis: [
      '❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❣️','💕','💞','💓','💗','💖','💘','💝','💟','☮️',
      '✝️','☪️','🕉️','☸️','✡️','🔯','🕎','☯️','☦️','🛐','⛎','♈','♉','♊','♋','♌','♍','♎','♏','♐',
      '♑','♒','♓','🆔','⚛️','🉑','☢️','☣️','📴','📳','🈶','🈚','🈸','🈺','🈷️','✴️','🆚','💮','🉐',
      '㊙️','㊗️','🈴','🈵','🈹','🈲','🅰️','🅱️','🆎','🆑','🅾️','🆘','❌','⭕','🛑','⛔','📛','🚫',
      '💯','✅','☑️','✔️','❎','🔝','🔛','🔜','🔚','🔙','⬆️','⬇️','⬅️','➡️','↗️','↘️','↙️','↖️','↕️','↔️',
      '#️⃣','*️⃣','0️⃣','1️⃣','2️⃣','3️⃣','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣','9️⃣','🔟','🔠','🔡','🔢','🔣','🔤',
    ],
  },
];

const RECENT_KEY = 'retrochord_recent_emojis';
const MAX_RECENT = 24;

function getRecent(): string[] {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]'); } catch { return []; }
}
function addRecent(emoji: string) {
  const r = [emoji, ...getRecent().filter(e => e !== emoji)].slice(0, MAX_RECENT);
  localStorage.setItem(RECENT_KEY, JSON.stringify(r));
}

interface EmojiPickerProps {
  onSelect: (emoji: string, isCustom?: boolean, customUrl?: string) => void;
  onClose: () => void;
}

const EmojiPicker: React.FC<EmojiPickerProps> = ({ onSelect, onClose }) => {
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState(0);
  const [customEmojis, setCustomEmojis] = useState<CustomEmoji[]>([]);
  const [recent, setRecent] = useState<string[]>(getRecent());
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsub = subscribeToCustomEmojis(setCustomEmojis);
    return unsub;
  }, []);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  // Group custom emojis by uploader
  const customByUser = useMemo(() => {
    const map = new Map<string, { username: string; emojis: CustomEmoji[] }>();
    for (const e of customEmojis) {
      if (!map.has(e.uploadedBy)) map.set(e.uploadedBy, { username: e.username, emojis: [] });
      map.get(e.uploadedBy)!.emojis.push(e);
    }
    return Array.from(map.values());
  }, [customEmojis]);

  // Build tab list: standard categories + one tab per user with custom emojis
  const tabs = useMemo(() => {
    const std = EMOJI_CATEGORIES.map((c, i) => ({ ...c, key: `std_${i}`, isCustom: false, userId: null as string | null }));
    std[0].emojis = recent; // fill Recent
    const custom = customByUser.map(u => ({
      label: u.username,
      icon: u.emojis[0]?.url ?? '🎨',
      emojis: [] as string[],
      key: `custom_${u.username}`,
      isCustom: true,
      userId: null as string | null,
      customEmojis: u.emojis,
    }));
    return [...std, ...custom];
  }, [recent, customByUser]);

  const handleSelect = (emoji: string) => {
    addRecent(emoji);
    setRecent(getRecent());
    onSelect(emoji);
  };

  const handleCustomSelect = (e: CustomEmoji) => {
    addRecent(`:${e.name}:`);
    setRecent(getRecent());
    onSelect(`:${e.name}:`, true, e.url);
  };

  const activeTabData = tabs[activeTab];
  const isCustomTab = (activeTabData as any).isCustom;

  // Search across all standard emojis
  const searchResults = useMemo(() => {
    if (!search) return [];
    // We don't have named lookup so just return all emojis from all std categories that vaguely match
    const all = EMOJI_CATEGORIES.flatMap(c => c.emojis);
    // Simple approach: return up to 60 since we can't name-search raw unicode easily
    return all.slice(0, 60);
  }, [search]);

  const displayEmojis = search
    ? searchResults
    : isCustomTab
      ? (activeTabData as any).customEmojis as CustomEmoji[]
      : activeTabData.emojis;

  return (
    <div className="emoji-picker panel" ref={containerRef}>
      {/* Title bar */}
      <div className="emoji-picker-titlebar">
        <span className="pixel-font" style={{ fontSize: '7px' }}>EMOJI</span>
        <button className="button-95 emoji-picker-close" onClick={onClose}>✕</button>
      </div>

      {/* Search */}
      <div className="emoji-picker-search-row">
        <input
          className="emoji-picker-search input-95"
          type="text"
          placeholder="Search emojis…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          autoFocus
        />
      </div>

      {/* Category tabs */}
      <div className="emoji-tab-bar">
        {tabs.map((tab, i) => (
          <button
            key={tab.key}
            className={`emoji-tab-btn ${activeTab === i ? 'active' : ''}`}
            onClick={() => { setActiveTab(i); setSearch(''); }}
            title={tab.label}
          >
            {(tab as any).isCustom
              ? <img src={(tab as any).customEmojis?.[0]?.url} alt={tab.label} className="emoji-tab-custom-img" />
              : tab.icon
            }
          </button>
        ))}
      </div>

      {/* Active tab label */}
      <div className="emoji-tab-label">{search ? `Search: "${search}"` : activeTabData.label}</div>

      {/* Grid */}
      <div className="emoji-grid">
        {isCustomTab && !search
          ? (displayEmojis as CustomEmoji[]).map(e => (
              <button key={e.id} className="emoji-btn emoji-btn-custom" onClick={() => handleCustomSelect(e)} title={`:${e.name}:`}>
                <img src={e.url} alt={e.name} className="emoji-custom-img" />
              </button>
            ))
          : (displayEmojis as string[]).map((em, i) => (
              <button key={i} className="emoji-btn" onClick={() => handleSelect(em)}>{em}</button>
            ))
        }
        {displayEmojis.length === 0 && (
          <div className="emoji-empty">
            {search ? 'No results' : activeTabData.label === 'Recent' ? 'No recent emojis' : 'No emojis here'}
          </div>
        )}
      </div>
    </div>
  );
};

export default EmojiPicker;
