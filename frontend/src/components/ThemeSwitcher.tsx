import { useState, useEffect, useRef } from 'react';
import { themes, getCurrentTheme, saveTheme, applyTheme, type Theme } from '../store/theme';

export default function ThemeSwitcher() {
  const [isOpen, setIsOpen] = useState(false);
  const [currentTheme, setCurrentTheme] = useState<Theme>(getCurrentTheme);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    applyTheme(currentTheme);
  }, [currentTheme]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleThemeChange = (theme: Theme) => {
    setCurrentTheme(theme);
    saveTheme(theme.id);
    setIsOpen(false);
    // 通知其他组件主题已更改
    window.dispatchEvent(new CustomEvent('theme-change', { detail: theme }));
  };

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-10 h-10 p-2 rounded-full flex items-center justify-center text-muted hover:bg-primary-glow transition-colors"
        title="切换主题"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-1 w-64 bg-card rounded-xl shadow-xl border border-glass-border overflow-hidden z-[100]">
          <div className="px-4 py-3 border-b border-glass-border">
            <span className="text-sm font-medium text-text">主题切换</span>
          </div>
          <div className="p-2 space-y-1">
            {themes.map((theme) => {
              const isActive = theme.id === currentTheme.id;
              return (
                <button
                  key={theme.id}
                  onClick={() => handleThemeChange(theme)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                    isActive ? 'bg-primary-glow' : 'hover:bg-surface'
                  }`}
                >
                  {/* 预览色块 */}
                  <div className="flex-shrink-0 flex gap-1">
                    <div 
                      className="w-5 h-5 rounded-full border border-white/10"
                      style={{ backgroundColor: theme.colors.deep }}
                    />
                    <div 
                      className="w-5 h-5 rounded-full border border-white/10"
                      style={{ backgroundColor: theme.colors.primary }}
                    />
                  </div>
                  {/* 主题信息 */}
                  <div className="flex-1 text-left">
                    <div className={`text-sm font-medium ${isActive ? 'text-primary' : 'text-text'}`}>
                      {theme.name}
                    </div>
                    <div className="text-[11px] text-muted">
                      {theme.description}
                    </div>
                  </div>
                  {/* 选中指示 */}
                  {isActive && (
                    <div className="flex-shrink-0">
                      <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
