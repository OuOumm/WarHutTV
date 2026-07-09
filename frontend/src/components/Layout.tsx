import { useState, useCallback, createContext, memo } from 'react';
import type { ReactNode, Dispatch, SetStateAction } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import MobileNav from './MobileNav';
import ThemeSwitcher from './ThemeSwitcher';
import UserMenu from './SettingsPanel';
import { useConfig } from '../store/config';
import { CapsuleSwitch } from './CapsuleSwitch';

interface HomeTabContextValue {
  activeTab: string;
  setActiveTab: Dispatch<SetStateAction<string>>;
}

export const HomeTabContext = createContext<HomeTabContextValue>({
  activeTab: 'home',
  setActiveTab: () => {},
});

// Static SVG icon — memoised
const SearchIcon = memo(() => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
  </svg>
));

interface LayoutProps {
  children: ReactNode;
}

const Layout = memo(({ children }: LayoutProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const { siteName } = useConfig();
  const [homeTab, setHomeTab] = useState('home');
  const isHome = location.pathname === '/';

  const handleSearchClick = useCallback(() => {
    navigate('/search');
  }, [navigate]);

  const handleToggleSidebar = useCallback(() => {
    setCollapsed(prev => !prev);
  }, []);

  return (
    <div className="w-full min-h-screen relative">
      {/* Skip link — keyboard users jump straight to content, bypassing nav */}
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[1000] focus:px-4 focus:py-2 focus:rounded-lg focus:bg-card focus:text-text focus:shadow-lg focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
      >
        跳到主内容
      </a>

      {/* Floating ambient orbs */}
      <div id="orb-layer" className="pointer-events-none">
        <div className="orb orb-a" style={{ top: '10%', left: '10%' }} />
        <div className="orb orb-b" style={{ top: '55%', left: '60%' }} />
        <div className="orb orb-c" style={{ top: '30%', left: '45%' }} />
      </div>

      {/* Desktop sidebar */}
      <div className="hidden md:block">
        <Sidebar collapsed={collapsed} onToggle={handleToggleSidebar} />
      </div>

      {/* Mobile header */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 bg-card/90 backdrop-blur-xl border-b border-glass-border/50">
        <div className="flex items-center justify-between h-14 px-3">
          <button
            onClick={handleSearchClick}
            className="w-9 h-9 flex items-center justify-center rounded-full text-muted hover:text-primary hover:bg-primary-glow transition-all duration-200"
          >
            <SearchIcon />
          </button>

          {isHome ? (
            <div className="absolute left-1/2 -translate-x-1/2 scale-90 origin-center">
              <CapsuleSwitch
                options={[
                  { label: '首页', value: 'home' },
                  { label: '收藏', value: 'favorites' },
                ]}
                active={homeTab}
                onChange={setHomeTab}
              />
            </div>
          ) : (
            <span className="text-lg font-bold tracking-tight absolute left-1/2 -translate-x-1/2">
              {siteName}
            </span>
          )}

          <div className="flex items-center gap-0.5">
            <ThemeSwitcher />
            <UserMenu />
          </div>
        </div>
      </div>

      {/* Content — rendered ONCE for all viewports */}
      {/* 桌面区作为唯一内容容器，用响应式 padding/margin 适配移动端 */}
      <div
        className={`duration-300 min-h-screen relative pt-14 md:pt-0 pb-[calc(3.5rem+env(safe-area-inset-bottom))] md:pb-0 ${
          collapsed ? 'md:ml-[64px]' : 'md:ml-[256px]'
        }`}
        style={{ transition: 'margin-left 300ms' }}
      >
        {/* Desktop top bar — hidden on mobile */}
        <div className="hidden md:flex sticky top-0 z-20 items-center px-4 py-3">
          <div className="flex-1" />

          {isHome && (
            <div className="flex-shrink-0">
              <CapsuleSwitch
                options={[
                  { label: '首页', value: 'home' },
                  { label: '收藏', value: 'favorites' },
                ]}
                active={homeTab}
                onChange={setHomeTab}
              />
            </div>
          )}

          <div className="flex-1 flex justify-end">
            <div className="glass-panel rounded-full px-2 py-1 flex items-center gap-1">
              <ThemeSwitcher />
              <div className="w-px h-5 bg-glass-border/50 mx-0.5" />
              <UserMenu />
            </div>
          </div>
        </div>

        <main id="main" className="px-4 sm:px-6">
          <HomeTabContext.Provider value={{ activeTab: homeTab, setActiveTab: setHomeTab }}>
            {children}
          </HomeTabContext.Provider>
        </main>
      </div>

      {/* Mobile bottom navigation */}
      <MobileNav />
    </div>
  );
});

export default Layout;
