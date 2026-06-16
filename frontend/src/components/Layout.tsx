import type { ReactNode } from 'react';
import Sidebar from './Sidebar';
import MobileNav from './MobileNav';
import ThemeSwitcher from './ThemeSwitcher';
import UserMenu from './SettingsPanel';

interface LayoutProps {
  children: ReactNode;
  activePath?: string;
}

const Layout = ({ children, activePath = '/' }: LayoutProps) => {
  return (
    <div className="w-full min-h-screen">
      <div className="hidden md:block">
        <Sidebar />
      </div>

      <div className="md:ml-64 transition-all duration-300 min-h-screen">
        {/* 右上角按钮 */}
        <div className="absolute top-2 right-4 z-20 hidden md:flex items-center gap-1">
          <ThemeSwitcher />
          <UserMenu />
        </div>

        <main
          className="mb-14 md:mb-0"
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
