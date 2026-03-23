// ── Theme store ───────────────────────────────────────────────────────────────
export interface Theme {
  colorSurface1: string;
  colorSurface2: string;
  colorAccent:   string;
  colorText:     string;
  colorTitlebar: string;
  fontFamily:    string;
  fontUrl:       string;
  fontName:      string;
  bgImageUrl:    string;
  bgOpacity:     number;
}

export const DEFAULT_THEME: Theme = {
  colorSurface1: '#c0c0c0',
  colorSurface2: '#dfdfdf',
  colorAccent:   '#000080',
  colorText:     '#000000',
  colorTitlebar: '#0a246a',
  fontFamily:    "'MS Sans Serif', Tahoma, Arial, sans-serif",
  fontUrl:       '',
  fontName:      'MS Sans Serif (default)',
  bgImageUrl:    '',
  bgOpacity:     0.3,
};

export const PRESET_FONTS = [
  { name: 'MS Sans Serif (default)', family: "'MS Sans Serif', Tahoma, Arial, sans-serif" },
  { name: 'Courier New',             family: "'Courier New', Courier, monospace" },
  { name: 'Comic Sans MS',           family: "'Comic Sans MS', cursive" },
  { name: 'Impact',                  family: "'Impact', 'Arial Narrow Bold', sans-serif" },
  { name: 'Georgia',                 family: "Georgia, 'Times New Roman', serif" },
  { name: 'Verdana',                 family: "Verdana, Geneva, Tahoma, sans-serif" },
  { name: 'Trebuchet MS',            family: "'Trebuchet MS', Arial, sans-serif" },
  { name: 'Press Start 2P (pixel)',  family: "'Press Start 2P', cursive" },
];

const STORAGE_KEY = 'retrochord_theme';

function load(): Theme {
  try { const r = localStorage.getItem(STORAGE_KEY); if (r) return { ...DEFAULT_THEME, ...JSON.parse(r) }; } catch {}
  return { ...DEFAULT_THEME };
}
function save(t: Theme) { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(t)); } catch {} }

let _theme: Theme = load();
type Listener = () => void;
const listeners = new Set<Listener>();
export function subscribeTheme(fn: Listener) { listeners.add(fn); return () => listeners.delete(fn); }
export function getTheme(): Theme { return _theme; }

function lighten(hex: string, amt: number): string {
  try {
    const n = parseInt(hex.replace('#',''), 16);
    const r = Math.min(255, ((n>>16)&0xff)+amt), g = Math.min(255, ((n>>8)&0xff)+amt), b = Math.min(255, (n&0xff)+amt);
    return '#'+((1<<24)+(r<<16)+(g<<8)+b).toString(16).slice(1);
  } catch { return hex; }
}

export function applyTheme(t: Theme) {
  _theme = t; save(t);
  const r = document.documentElement;
  r.style.setProperty('--surface-1',         t.colorSurface1);
  r.style.setProperty('--surface-2',         t.colorSurface2);
  r.style.setProperty('--surface-3',         lighten(t.colorSurface1, 20));
  r.style.setProperty('--surface-4',         lighten(t.colorSurface1, -40));
  r.style.setProperty('--win98-highlight',   t.colorAccent);
  r.style.setProperty('--win98-blue-dark',   t.colorAccent);
  r.style.setProperty('--win98-blue-light',  lighten(t.colorAccent, 20));
  r.style.setProperty('--text-primary',      t.colorText);
  r.style.setProperty('--text-secondary',    lighten(t.colorText, 60));
  r.style.setProperty('--text-muted',        lighten(t.colorText, 80));
  r.style.setProperty('--theme-titlebar',    t.colorTitlebar);
  r.style.setProperty('--theme-font',        t.fontFamily);
  r.style.setProperty('--chat-bg-image',     t.bgImageUrl ? `url("${t.bgImageUrl}")` : 'none');
  r.style.setProperty('--chat-bg-opacity',   String(t.bgOpacity));
  document.body.style.fontFamily = t.fontFamily;
  if (t.fontFamily.includes('Press Start') && !document.querySelector('#psfont')) {
    const link = Object.assign(document.createElement('link'), { id:'psfont', rel:'stylesheet', href:'https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap' });
    document.head.appendChild(link);
  }
  listeners.forEach(fn => fn());
}

applyTheme(_theme);
