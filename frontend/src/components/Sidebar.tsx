import { NavLink, useLocation } from 'react-router-dom';
import { useConfig } from '../store/config';
import { useVersionCheck, GITHUB_URL } from '../hooks/useVersionCheck';

interface NavItemData {
  path: string;
  label: string;
  icon: string;
}

const navItems: NavItemData[] = [
  { path: '/', label: '首页', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
  { path: '/search', label: '搜索', icon: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z' },
];

const browseItems: NavItemData[] = [
  { path: '/douban?type=movie', label: '电影', icon: 'M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z' },
  { path: '/douban?type=tv', label: '剧集', icon: 'M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z' },
  { path: '/douban?type=anime', label: '动漫', icon: 'M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
  { path: '/douban?type=show', label: '综艺', icon: 'M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z' },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

// ─── Shared nav item component — deduplicates rendering logic ───
function SidebarNavItem({ item, collapsed }: { item: NavItemData; collapsed: boolean }) {
  const location = useLocation();

  const isActive = (() => {
    if (item.path === '/') return location.pathname === '/';
    const typeMatch = item.path.match(/type=([^&]+)/)?.[1];
    if (typeMatch) {
      return location.pathname.startsWith('/douban') && location.search.includes(`type=${typeMatch}`);
    }
    return location.pathname.startsWith(item.path);
  })();

  return (
    <NavLink
      to={item.path}
      className={`group relative flex items-center rounded-xl text-sm transition-all duration-200 select-none ${
        collapsed ? 'h-11 w-11 mx-auto justify-center' : 'h-10 px-3 gap-3'
      } ${isActive ? 'text-primary' : 'text-muted hover:text-text'}`}
    >
      {/* Active background — subtle gradient glow */}
      {isActive && (
        <div
          className="absolute inset-0 rounded-xl"
          style={{
            background: collapsed
              ? `rgba(var(--color-primary-rgb), 0.08)`
              : `linear-gradient(135deg, rgba(var(--color-primary-rgb), 0.12), rgba(var(--color-primary-dim-rgb), 0.05))`,
          }}
        />
      )}

      {/* Hover background — only for inactive items */}
      {!isActive && (
        <div className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-all duration-200 bg-white/[0.03]" />
      )}

      {/* Active indicator dot — collapsed mode only */}
      {collapsed && isActive && (
        <div
          className="absolute -left-0.5 top-1/2 -translate-y-1/2 w-[3px] h-3 rounded-r-full bg-primary"
          style={{ boxShadow: '0 0 6px var(--color-primary)' }}
        />
      )}

      {/* Icon */}
      <div className="relative z-[1] flex items-center justify-center w-5 h-5">
        <svg
          className="w-[18px] h-[18px]"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={isActive ? 2 : 1.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
        </svg>
      </div>

      {/* Label */}
      {!collapsed && (
        <span className={`relative z-[1] whitespace-nowrap ${isActive ? 'font-medium' : ''}`}>
          {item.label}
        </span>
      )}
    </NavLink>
  );
}

// ─── Sidebar ───
const Sidebar = ({ collapsed, onToggle }: SidebarProps) => {
  const { siteName } = useConfig();
  const { current, hasUpdate } = useVersionCheck();

  return (
    <aside
      className="fixed top-0 left-0 h-screen transition-all duration-300 z-10 flex flex-col"
      style={{ width: collapsed ? 64 : 256 }}
    >
      {/* Glass background — blur lowered from 2xl (~40px) to md (~12px):
          the sidebar floats over the always-animating body background, and a
          heavy blur here means re-blurring every frame while that background
          repaints. md keeps the glass look at a fraction of the compositing cost. */}
      <div className="absolute inset-0 bg-glass backdrop-blur-md border-r border-glass-border/80" />

      {/* Subtle ambient glow */}
      <div
        className="absolute top-0 right-0 w-48 h-48 pointer-events-none opacity-[0.04]"
        style={{ background: 'radial-gradient(ellipse at 100% 0%, var(--color-primary) 0%, transparent 70%)' }}
      />
      <div
        className="absolute bottom-0 left-0 w-36 h-36 pointer-events-none opacity-[0.03]"
        style={{ background: 'radial-gradient(ellipse at 0% 100%, var(--color-primary) 0%, transparent 70%)' }}
      />

      {/* Content */}
      <div className="relative z-[1] flex h-full flex-col">
        {/* ── Logo ── */}
        <div className="relative h-16 flex items-center justify-center border-b border-glass-border/50">
          {!collapsed ? (
            <div className="flex items-center gap-2.5">
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center"
                style={{
                  background: 'var(--color-primary-glow)',
                  boxShadow: '0 0 8px var(--color-primary-glow)',
                }}
              >
                <span className="text-primary font-black text-sm">{siteName.charAt(0)}</span>
              </div>
              <span className="text-lg font-bold text-text tracking-tight">{siteName}</span>
            </div>
          ) : (
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{
                background: 'var(--color-primary-glow)',
                boxShadow: '0 0 8px var(--color-primary-glow)',
              }}
            >
              <span className="text-primary font-black text-sm">{siteName.charAt(0)}</span>
            </div>
          )}
          <button
            onClick={onToggle}
            className={`absolute top-1/2 -translate-y-1/2 flex items-center justify-center w-7 h-7 rounded-lg text-muted/70 hover:text-text hover:bg-white/[0.05] transition-all duration-200 ${
              collapsed ? 'left-1/2 -translate-x-1/2' : 'right-3'
            }`}
            aria-label={collapsed ? '展开侧边栏' : '收起侧边栏'}
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d={collapsed ? 'M13 5l7 7-7 7M5 5l7 7-7 7' : 'M11 19l-7-7 7-7m8 14l-7-7 7-7'}
              />
            </svg>
          </button>
        </div>

        {/* ── Navigation ── */}
        <div className="flex-1 overflow-y-auto scrollbar-hide pt-3 pb-2">
          {/* Primary actions */}
          <nav className="px-2.5 space-y-0.5">
            {navItems.map((item) => (
              <SidebarNavItem key={item.path} item={item} collapsed={collapsed} />
            ))}
          </nav>

          <div className="mx-5 my-3 border-t border-glass-border/20" />

          {/* Browse section */}
          <div className="px-2.5 space-y-0.5">
            {browseItems.map((item) => (
              <SidebarNavItem key={item.path} item={item} collapsed={collapsed} />
            ))}
          </div>
        </div>

        {/* ── Version footer ── */}
        {!collapsed && (
          <div className="relative z-[1] px-4 py-3 border-t border-glass-border/20">
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 group"
            >
              {hasUpdate ? (
                <>
                  <span className="h-1.5 w-1.5 rounded-full bg-orange-500 flex-shrink-0" />
                  <span className="text-[11px] text-orange-400/70 group-hover:text-orange-300 transition-colors">
                    v{current} · 有新版本
                  </span>
                </>
              ) : (
                <span className="flex items-center gap-1.5 text-[11px] text-muted group-hover:text-text transition-colors">
                  <span className="h-1.5 w-1.5 rounded-full bg-green-500 flex-shrink-0" />
                  v{current}
                </span>
              )}
            </a>
          </div>
        )}
      </div>
    </aside>
  );
};

export default Sidebar;
