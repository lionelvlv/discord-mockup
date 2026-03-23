import React, { useState, useEffect } from 'react';
import { getTheme, applyTheme, DEFAULT_THEME, PRESET_FONTS, Theme } from '../../features/theme/themeStore';
import './UserSettings.css';

interface Props { onClose: () => void; }

type Tab = 'theme' | 'background' | 'font';

const MAX_BG_BYTES = 5 * 1024 * 1024; // 5MB

export default function UserSettings({ onClose }: Props) {
  const [tab, setTab] = useState<Tab>('theme');
  const [theme, setTheme] = useState<Theme>(getTheme());
  const [bgPreview, setBgPreview] = useState(theme.bgImageUrl);
  const [fontPreview, setFontPreview] = useState(theme.fontFamily);
  const [customFontName, setCustomFontName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [saved, setSaved] = useState(false);

  // Live preview — apply on every change
  useEffect(() => { applyTheme(theme); }, [theme]);

  const update = (patch: Partial<Theme>) => setTheme(t => ({ ...t, ...patch }));

  const handleBgUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_BG_BYTES) { alert('Background image must be under 5MB.'); return; }
    setUploading(true);
    const reader = new FileReader();
    reader.onload = ev => {
      const url = ev.target?.result as string;
      setBgPreview(url);
      update({ bgImageUrl: url });
      setUploading(false);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleFontUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) { alert('Font file must be under 3MB.'); return; }
    const reader = new FileReader();
    reader.onload = ev => {
      const dataUrl = ev.target?.result as string;
      const name = customFontName.trim() || file.name.replace(/\.[^.]+$/, '');
      // Inject @font-face
      const styleId = 'custom-theme-font';
      let style = document.getElementById(styleId) as HTMLStyleElement | null;
      if (!style) { style = document.createElement('style'); style.id = styleId; document.head.appendChild(style); }
      style.textContent = `@font-face { font-family: '${name}'; src: url('${dataUrl}'); }`;
      const family = `'${name}', sans-serif`;
      setFontPreview(family);
      update({ fontFamily: family, fontUrl: dataUrl, fontName: name });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleSave = () => {
    applyTheme(theme);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const handleReset = () => {
    setTheme({ ...DEFAULT_THEME });
    setBgPreview('');
    setFontPreview(DEFAULT_THEME.fontFamily);
    applyTheme(DEFAULT_THEME);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="user-settings-modal panel" onClick={e => e.stopPropagation()}>
        {/* Titlebar */}
        <div className="settings-titlebar" style={{ background: `linear-gradient(to right, var(--theme-titlebar), #1084d0)` }}>
          <span className="pixel-font" style={{ fontSize: '8px', color: '#fff' }}>🎨 APPEARANCE</span>
          <button className="button-95 modal-close-btn" onClick={onClose}>✕</button>
        </div>

        {/* Tabs */}
        <div className="settings-tabs">
          {(['theme', 'background', 'font'] as Tab[]).map(t => (
            <button key={t} className={`settings-tab button-95 ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
              {t === 'theme' ? '🎨 Colors' : t === 'background' ? '🖼️ Background' : '🔤 Font'}
            </button>
          ))}
        </div>

        <div className="settings-body">
          {/* ── Colors tab ── */}
          {tab === 'theme' && (
            <div className="settings-section">
              <div className="setting-row">
                <label>Panel color</label>
                <input type="color" value={theme.colorSurface1} onChange={e => update({ colorSurface1: e.target.value, colorSurface2: e.target.value })} />
                <span className="setting-hint">Sidebars & panels</span>
              </div>
              <div className="setting-row">
                <label>Chat area</label>
                <input type="color" value={theme.colorSurface2} onChange={e => update({ colorSurface2: e.target.value })} />
                <span className="setting-hint">Message background</span>
              </div>
              <div className="setting-row">
                <label>Accent / selected</label>
                <input type="color" value={theme.colorAccent} onChange={e => update({ colorAccent: e.target.value })} />
                <span className="setting-hint">Active channel, buttons</span>
              </div>
              <div className="setting-row">
                <label>Text color</label>
                <input type="color" value={theme.colorText} onChange={e => update({ colorText: e.target.value })} />
              </div>
              <div className="setting-row">
                <label>Titlebar color</label>
                <input type="color" value={theme.colorTitlebar} onChange={e => update({ colorTitlebar: e.target.value })} />
                <span className="setting-hint">Window title gradient</span>
              </div>
              <div className="setting-presets">
                <span className="pixel-font" style={{ fontSize: '8px' }}>PRESETS</span>
                <div className="preset-swatches">
                  {PRESETS.map(p => (
                    <button key={p.name} className="preset-btn" title={p.name}
                      style={{ background: p.colorAccent, border: `2px outset ${p.colorSurface1}` }}
                      onClick={() => setTheme(t => ({ ...t, ...p }))}
                    >{p.name[0]}</button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Background tab ── */}
          {tab === 'background' && (
            <div className="settings-section">
              <div className="setting-row">
                <label>Image</label>
                <label className="button-95 file-btn">
                  📁 Choose image
                  <input type="file" accept="image/*" hidden onChange={handleBgUpload} disabled={uploading} />
                </label>
                <span className="setting-hint">Max 5MB · sits behind messages</span>
              </div>
              {bgPreview && (
                <>
                  <div className="bg-preview" style={{ backgroundImage: `url("${bgPreview}")` }} />
                  <div className="setting-row">
                    <label>Opacity</label>
                    <input type="range" min="0" max="1" step="0.05"
                      value={theme.bgOpacity}
                      onChange={e => update({ bgOpacity: parseFloat(e.target.value) })}
                      style={{ flex: 1 }}
                    />
                    <span>{Math.round(theme.bgOpacity * 100)}%</span>
                  </div>
                  <button className="button-95" style={{ marginTop: 6, fontSize: 10 }}
                    onClick={() => { setBgPreview(''); update({ bgImageUrl: '', bgOpacity: 0.3 }); }}>
                    ✕ Remove image
                  </button>
                </>
              )}
              {!bgPreview && <div className="setting-hint" style={{ marginTop: 10 }}>No background image set.</div>}
            </div>
          )}

          {/* ── Font tab ── */}
          {tab === 'font' && (
            <div className="settings-section">
              <div className="setting-row" style={{ flexWrap: 'wrap', gap: 4 }}>
                <label>Preset fonts</label>
              </div>
              <div className="font-list">
                {PRESET_FONTS.map(f => (
                  <button key={f.name}
                    className={`font-item button-95 ${theme.fontFamily === f.family ? 'active' : ''}`}
                    style={{ fontFamily: f.family }}
                    onClick={() => { setFontPreview(f.family); update({ fontFamily: f.family, fontUrl: '', fontName: f.name }); }}
                  >
                    {f.name}
                  </button>
                ))}
              </div>
              <div className="setting-row" style={{ marginTop: 10, flexWrap: 'wrap' }}>
                <label>Custom font file</label>
                <input
                  className="textarea-95"
                  style={{ fontSize: 10, padding: '2px 4px', flex: 1, minWidth: 80 }}
                  placeholder="Font name..."
                  value={customFontName}
                  onChange={e => setCustomFontName(e.target.value)}
                />
                <label className="button-95 file-btn">
                  📁 Upload .ttf/.otf/.woff
                  <input type="file" accept=".ttf,.otf,.woff,.woff2" hidden onChange={handleFontUpload} />
                </label>
              </div>
              <div className="font-preview panel-inset" style={{ fontFamily: fontPreview, marginTop: 8 }}>
                The quick brown fox jumps — AaBbCc 0123
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="settings-footer">
          <button className="button-95" onClick={handleReset} style={{ fontSize: 10 }}>↺ Reset defaults</button>
          <div style={{ flex: 1 }} />
          <button className="button-95" onClick={handleSave} style={{ fontWeight: 'bold', minWidth: 80 }}>
            {saved ? '✓ Saved!' : '✓ Apply'}
          </button>
        </div>
      </div>
    </div>
  );
}

// Color presets
const PRESETS = [
  { name: 'Win98', colorSurface1:'#c0c0c0', colorSurface2:'#dfdfdf', colorAccent:'#000080', colorText:'#000000', colorTitlebar:'#0a246a' },
  { name: 'Dark',  colorSurface1:'#2c2f33', colorSurface2:'#36393f', colorAccent:'#7289da', colorText:'#dcddde', colorTitlebar:'#4752c4' },
  { name: 'Rose',  colorSurface1:'#f5e6e8', colorSurface2:'#fdf2f3', colorAccent:'#c94060', colorText:'#2d1b1e', colorTitlebar:'#a03050' },
  { name: 'Forest',colorSurface1:'#d4e0c8', colorSurface2:'#e8f0e0', colorAccent:'#2d6a3f', colorText:'#1a2e1e', colorTitlebar:'#1d4d2e' },
  { name: 'Ocean', colorSurface1:'#c8d8e8', colorSurface2:'#e0ecf6', colorAccent:'#1a5276', colorText:'#0d1f2d', colorTitlebar:'#154360' },
  { name: 'Dusk',  colorSurface1:'#2a1a3e', colorSurface2:'#3d2957', colorAccent:'#9b59b6', colorText:'#e8d5f0', colorTitlebar:'#6c2c8e' },
];
