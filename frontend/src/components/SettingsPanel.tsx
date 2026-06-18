import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../hooks/useAuth';

interface Settings {
  doubanProxy: 'tencent' | 'ali' | 'direct';
  defaultAggregate: boolean;
}

const defaultSettings: Settings = {
  doubanProxy: 'tencent',
  defaultAggregate: true,
};

function loadSettings(): Settings {
  try {
    const saved = localStorage.getItem('settings');
    return saved ? { ...defaultSettings, ...JSON.parse(saved) } : defaultSettings;
  } catch {
    return defaultSettings;
  }
}

function saveSettings(settings: Settings) {
  localStorage.setItem('settings', JSON.stringify(settings));
  localStorage.setItem('doubanProxy', settings.doubanProxy);
  localStorage.setItem('defaultAggregateSearch', JSON.stringify(settings.defaultAggregate));
}

export function useSettings() {
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const update = (partial: Partial<Settings>) => {
    const next = { ...settings, ...partial };
    setSettings(next);
    saveSettings(next);
  };
  return { settings, update };
}

export default function UserMenu() {
  const [showDropdown, setShowDropdown] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const { logout } = useAuth();
  const { settings, update } = useSettings();
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
        setShowSettings(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => { setShowDropdown(!showDropdown); setShowSettings(false); }}
        className="w-10 h-10 p-2 rounded-full flex items-center justify-center text-muted hover:bg-primary-glow transition-colors"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      </button>

      {showDropdown && !showSettings && (
        <div className="absolute right-0 top-full mt-2 w-40 glass-panel rounded-xl shadow-2xl overflow-hidden z-[100]">
          <button
            onClick={() => setShowSettings(true)}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-text hover:bg-surface transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            设置
          </button>
          <div className="border-t border-glass-border" />
          <button
            onClick={() => {
              logout();
              // React Router 的 <Navigate> 会自动重定向到 /login
              // 不需要手动调用 navigate
            }}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-500 hover:bg-red-900/20 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            退出
          </button>
        </div>
      )}

      {showDropdown && showSettings && (
        <div className="absolute right-0 top-full mt-2 w-72 glass-panel rounded-xl shadow-2xl overflow-hidden z-[100]">
          <div className="flex items-center justify-between px-4 py-3 border-b border-glass-border">
            <span className="text-sm font-medium text-text">设置</span>
            <button onClick={() => setShowSettings(false)} className="text-muted hover:text-text">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="p-4 space-y-4">
            <div>
              <h4 className="text-xs font-medium text-muted mb-2">豆瓣数据代理</h4>
              <select
                value={settings.doubanProxy}
                onChange={(e) => update({ doubanProxy: e.target.value as Settings['doubanProxy'] })}
                className="w-full px-3 py-1.5 text-sm bg-surface rounded-lg text-text focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
                <option value="tencent">豆瓣 CDN By CMLiussss（腾讯云）</option>
                <option value="ali">豆瓣 CDN By CMLiussss（阿里云）</option>
                <option value="direct">直连豆瓣</option>
              </select>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm text-text">默认聚合搜索</h4>
                <p className="text-xs text-muted">搜索时按标题和年份聚合</p>
              </div>
              <button
                onClick={() => update({ defaultAggregate: !settings.defaultAggregate })}
                className={`relative w-9 h-5 rounded-full transition-colors ${settings.defaultAggregate ? 'bg-primary' : 'bg-surface'}`}
              >
                <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${settings.defaultAggregate ? 'translate-x-4' : ''}`} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
