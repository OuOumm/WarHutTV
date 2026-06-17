import { useState } from 'react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import MobileNav from './MobileNav';
import ThemeSwitcher from './ThemeSwitcher';
import UserMenu from './SettingsPanel';

interface LayoutProps {
  children: ReactNode;
}

const Layout = ({ children }: LayoutProps) => {
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="w-full min-h-screen relative">
      <div className="hidden md:block">
        <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
      </div>

      {/* 移动端顶部栏 */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 glass-panel">
        <div className="flex items-center justify-between h-14 px-3">
          <button
            onClick={() => navigate('/search')}
            className="w-9 h-9 flex items-center justify-center rounded-full text-muted hover:text-primary hover:bg-primary-glow transition-all duration-200"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </button>

          <span className="text-lg font-bold tracking-tight absolute left-1/2 -translate-x-1/2">
            <span className="text-text">War</span><span className="text-primary">Hut</span><span className="text-text">TV</span>
          </span>

          <div className="flex items-center gap-0.5">
            <ThemeSwitcher />
            <UserMenu />
          </div>
        </div>
      </div>

      <div 
        className="hidden md:block transition-all duration-300 min-h-screen relative z-[1]"
        style={{ marginLeft: collapsed ? 64 : 256 }}
      >
        <div className="absolute top-3 right-4 z-20 flex items-center gap-1.5">
          <ThemeSwitcher />
          <UserMenu />
        </div>

        <main className="mb-14 md:mb-0" style={{ paddingBottom: 'calc(3.5rem + env(safe-area-inset-bottom))' }}>
          {children}
        </main>
      </div>

      <div className="md:hidden">
        <div className="pt-14 mb-14" style={{ paddingBottom: 'calc(3.5rem + env(safe-area-inset-bottom))' }}>
          {children}
        </div>
        <MobileNav />
      </div>
    </div>
  );
};

export default Layout;
