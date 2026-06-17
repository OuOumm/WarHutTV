import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import MobileNav from './MobileNav';
import ThemeSwitcher from './ThemeSwitcher';
import UserMenu from './SettingsPanel';

interface LayoutProps {
  children: ReactNode;
  activePath?: string;
}

const Layout = ({ children, activePath = '/' }: LayoutProps) => {
  const navigate = useNavigate();

  return (
    <div className="w-full min-h-screen">
      <div className="hidden md:block">
        <Sidebar />
      </div>

      {/* 移动端顶部栏 */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 bg-card/80 backdrop-blur-xl border-b border-glass-border">
        <div className="flex items-center justify-between h-12 px-3">
          {/* 左侧搜索按钮 */}
          <button
            onClick={() => navigate('/search')}
            className="w-9 h-9 flex items-center justify-center rounded-full text-muted hover:text-text hover:bg-surface transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </button>

          {/* 中间标题 */}
          <span className="text-lg font-bold text-primary tracking-tight absolute left-1/2 -translate-x-1/2">WarHutTV</span>

          {/* 右侧按钮 */}
          <div className="flex items-center gap-0.5">
            <ThemeSwitcher />
            <UserMenu />
          </div>
        </div>
      </div>

      <div className="md:ml-64 transition-all duration-300 min-h-screen">
        {/* 桌面端右上角按钮 */}
        <div className="absolute top-2 right-4 z-20 hidden md:flex items-center gap-1">
          <ThemeSwitcher />
          <UserMenu />
        </div>

        <main
          className="pt-12 md:pt-0 mb-14 md:mb-0"
          style={{ paddingBottom: 'calc(3.5rem + env(safe-area-inset-bottom))' }}
        >
          {children}
        </main>
      </div>

      <div className="md:hidden">
        <MobileNav activePath={activePath} />
      </div>
    </div>
  );
};

export default Layout;
