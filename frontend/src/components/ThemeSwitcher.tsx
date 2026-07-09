import { useState, useEffect, useRef, useCallback } from 'react';
import { themes, getCurrentTheme, saveTheme, applyTheme, type Theme } from '../store/theme';
import { useFocusTrap } from '../hooks/useFocusTrap';

// 主题预览色块 - 展示每个主题的独特氛围
const ThemePreview = ({ theme, isActive }: { theme: Theme; isActive: boolean }) => {
  const { colors, visual } = theme;
  return (
    <div 
      className="relative w-11 h-11 rounded-lg overflow-hidden flex-shrink-0 border transition-all duration-200"
      style={{ 
        borderColor: isActive ? colors.primary + '60' : 'rgba(255,255,255,0.08)',
        boxShadow: isActive ? `0 0 12px ${colors.primary}20` : 'none',
      }}
    >
      {/* 底色 */}
      <div className="absolute inset-0" style={{ backgroundColor: colors.deep }} />
      {/* 表面色块 */}
      <div className="absolute bottom-0 left-0 right-0 h-[45%]" style={{ backgroundColor: colors.card }} />
      {/* 主色条 */}
      <div 
        className="absolute top-0 left-0 right-0 h-[3px]" 
        style={{ backgroundColor: colors.primary }} 
      />
      {/* 主色点缀 */}
      <div 
        className="absolute bottom-1.5 right-1.5 w-2 h-2 rounded-full"
        style={{ backgroundColor: colors.primary, opacity: 0.8 }}
      />
      {/* 纹理指示 */}
      {visual.texture === 'crystal' && (
        <div className="absolute inset-0 opacity-30" style={{ 
          background: 'radial-gradient(circle at 30% 40%, rgba(255,255,255,0.3) 0%, transparent 50%)' 
        }} />
      )}
      {visual.texture === 'fabric' && (
        <div className="absolute inset-0 opacity-20" style={{ 
          backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.1) 2px, rgba(255,255,255,0.1) 3px)' 
        }} />
      )}
    </div>
  );
};

export default function ThemeSwitcher() {
  const [isOpen, setIsOpen] = useState(false);
  const [currentTheme, setCurrentTheme] = useState<Theme>(getCurrentTheme);
  const menuRef = useRef<HTMLDivElement>(null);

  // Trap focus + Esc-to-close while the theme menu is open.
  const themeTrapRef = useFocusTrap<HTMLDivElement>(
    isOpen,
    useCallback(() => setIsOpen(false), []),
  );

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
    window.dispatchEvent(new CustomEvent('theme-change', { detail: theme }));
  };

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-label="切换主题"
        className="w-10 h-10 p-2 rounded-full flex items-center justify-center text-muted hover:bg-primary-glow hover:text-primary transition-all duration-200"
        title="切换主题"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
        </svg>
      </button>

      {isOpen && (
        <div
          ref={themeTrapRef}
          role="menu"
          aria-label="主题风格"
          className="absolute right-0 top-full mt-2 w-72 glass-panel rounded-xl shadow-2xl overflow-hidden z-[100] animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="px-4 py-3 border-b border-glass-border">
            <span className="text-sm font-semibold text-text tracking-wide">主题风格</span>
          </div>
          <div className="p-2 space-y-0.5 max-h-[400px] overflow-y-auto">
            {themes.map((theme) => {
              const isActive = theme.id === currentTheme.id;
              return (
                <button
                  key={theme.id}
                  role="menuitem"
                  aria-label={theme.name}
                  onClick={() => handleThemeChange(theme)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 ${
                    isActive 
                      ? 'bg-primary-glow ring-1 ring-primary/20' 
                      : 'hover:bg-surface/60'
                  }`}
                >
                  {/* 预览色块 */}
                  <ThemePreview theme={theme} isActive={isActive} />
                  
                  {/* 主题信息 */}
                  <div className="flex-1 text-left min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-medium ${isActive ? 'text-primary' : 'text-text'}`}>
                        {theme.name}
                      </span>
                      <span className="text-[10px] text-muted/70 font-mono">{theme.nameEn}</span>
                    </div>
                    <div className="text-[11px] text-muted leading-tight mt-0.5 truncate">
                      {theme.description}
                    </div>
                  </div>

                  {/* 选中指示 */}
                  {isActive && (
                    <div className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center">
                      <svg className="w-3 h-3 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
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
