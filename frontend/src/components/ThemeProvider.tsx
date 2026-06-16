import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

type Theme = 'light' | 'dark' | 'system';

interface ThemeContextType {
  theme: Theme;
  resolvedTheme: 'light' | 'dark';
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'system',
  resolvedTheme: 'light',
  setTheme: () => {},
  toggleTheme: () => {},
});

export const useTheme = () => useContext(ThemeContext);

function setThemeColor(theme: string) {
  const color = theme === 'dark' ? '#0c111c' : '#f9fbfe';
  let meta = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null;
  if (!meta) {
    meta = document.createElement('meta');
    meta.name = 'theme-color';
    document.head.appendChild(meta);
  }
  meta.content = color;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('system');
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('light');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem('theme') as Theme | null;
    if (saved) setThemeState(saved);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const resolve = () => {
      const resolved = theme === 'system' ? (mediaQuery.matches ? 'dark' : 'light') : theme;
      setResolvedTheme(resolved);
      document.documentElement.classList.toggle('dark', resolved === 'dark');
      setThemeColor(resolved);
    };
    resolve();
    mediaQuery.addEventListener('change', resolve);
    return () => mediaQuery.removeEventListener('change', resolve);
  }, [theme, mounted]);

  const setTheme = (t: Theme) => {
    setThemeState(t);
    localStorage.setItem('theme', t);
  };

  const toggleTheme = () => {
    const target = resolvedTheme === 'dark' ? 'light' : 'dark';
    setThemeColor(target);
    if (!(document as any).startViewTransition) {
      setTheme(target);
      return;
    }
    (document as any).startViewTransition(() => {
      setTheme(target);
    });
  };

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
