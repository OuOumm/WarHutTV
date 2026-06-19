import { useState, useCallback, createContext, memo } from 'react';
import type { ReactNode, Dispatch, SetStateAction } from 'react';

interface HomeTabContextValue {
  activeTab: string;
  setActiveTab: Dispatch<SetStateAction<string>>;
}

export const HomeTabContext = createContext<HomeTabContextValue>({
  activeTab: 'home',
  setActiveTab: () => {},
});
import { useNavigate, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import MobileNav from './MobileNav';
import ThemeSwitcher from './ThemeSwitcher';
import UserMenu from './SettingsPanel';
import { useConfig } from '../store/config';
import { CapsuleSwitch } from './CapsuleSwitch';

// 静态SVG图标 - 使用 memo 优化
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

  // 使用 useCallback 缓存事件处理函数
  const handleSearchClick = useCallback(() => {
    navigate('/search');
  }, [navigate]);

  const handleToggleSidebar = useCallback(() => {
    setCollapsed(prev => !prev);
  }, []);

  return (
    <div className="w-full min-h-screen relative" style={{ background: 'transparent' }}>
      {/* 浮动光球层 */}
      <div id="orb-layer">
        <div className="orb orb-a" style={{ top: '10%', left: '10%' }} />
        <div className="orb orb-b" style={{ top: '55%', left: '60%' }} />
        <div className="orb orb-c" style={{ top: '30%', left: '45%' }} />
      </div>

      {/* 桌面端侧边栏 */}
      <div className="hidden md:block">
        <Sidebar collapsed={collapsed} onToggle={handleToggleSidebar} />
      </div>

      {/* 移动端顶部栏 */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 glass-panel">
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
                  { label: '收藏夹', value: 'favorites' },
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

      {/* 内容区域 — 使用相对定位，跟随侧边栏缩进 */}
      <div
        className="hidden md:block transition-all duration-300 min-h-screen relative"
        style={{ marginLeft: collapsed ? 64 : 256 }}
      >
        {/* 顶部操作栏 — 三栏布局居中 CapsuleSwitch */}
        <div className="sticky top-0 z-20 flex items-center px-4 py-3">
          {/* 左占位 */}
          <div className="flex-1" />

          {/* 居中 — CapsuleSwitch */}
          {isHome && (
            <div className="flex-shrink-0">
              <CapsuleSwitch
                options={[
                  { label: '首页', value: 'home' },
                  { label: '收藏夹', value: 'favorites' },
                ]}
                active={homeTab}
                onChange={setHomeTab}
              />
            </div>
          )}

          {/* 右侧操作按钮 */}
          <div className="flex-1 flex justify-end">
            <div className="glass-panel rounded-full px-2 py-1 flex items-center gap-1">
              <ThemeSwitcher />
              <div className="w-px h-5 bg-glass-border/50 mx-0.5" />
              <UserMenu />
            </div>
          </div>
        </div>

        <main className="px-4 sm:px-6 pb-14 md:pb-0">
          <HomeTabContext.Provider value={{ activeTab: homeTab, setActiveTab: setHomeTab }}>
            {children}
          </HomeTabContext.Provider>
        </main>
      </div>

      {/* 移动端 */}
      <div className="md:hidden">
        <div className="pt-14 pb-14 px-3" style={{ paddingBottom: 'calc(3.5rem + env(safe-area-inset-bottom))' }}>
          <HomeTabContext.Provider value={{ activeTab: homeTab, setActiveTab: setHomeTab }}>
            {children}
          </HomeTabContext.Provider>
        </div>
        <MobileNav />
      </div>
    </div>
  );
});

export default Layout;
