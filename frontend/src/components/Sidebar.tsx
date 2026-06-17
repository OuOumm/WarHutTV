import { NavLink, useLocation } from 'react-router-dom';

const navItems = [
  { path: '/', label: '首页', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
  { path: '/search', label: '搜索', icon: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z' },
];

const menuItems = [
  { path: '/douban?type=movie', label: '电影', icon: 'M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z' },
  { path: '/douban?type=tv', label: '剧集', icon: 'M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z' },
  { path: '/douban?type=anime', label: '动漫', icon: 'M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
  { path: '/douban?type=show', label: '综艺', icon: 'M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z' },
  { path: '/live', label: '直播', icon: 'M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z' },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

const Sidebar = ({ collapsed, onToggle }: SidebarProps) => {
  const location = useLocation();

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    if (path.includes('type=')) {
      const typeMatch = path.match(/type=([^&]+)/)?.[1];
      return location.pathname.startsWith('/douban') && location.search.includes(`type=${typeMatch}`);
    }
    return location.pathname.startsWith(path);
  };

  return (
    <aside
      className="fixed top-0 left-0 h-screen transition-all duration-300 border-r border-glass-border z-10 bg-card/95 backdrop-blur-xl"
      style={{ 
        width: collapsed ? 64 : 256,
        boxShadow: '4px 0 24px rgba(0,0,0,0.2)',
      }}
    >
      <div className="flex h-full flex-col">
        {/* Logo */}
        <div className="relative h-16 flex items-center justify-center border-b border-glass-border/50">
          {!collapsed && (
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-primary/20 flex items-center justify-center">
                <span className="text-primary font-bold text-sm">W</span>
              </div>
              <span className="text-lg font-bold text-text tracking-tight">
                War<span className="text-primary">Hut</span>TV
              </span>
            </div>
          )}
          <button
            onClick={onToggle}
            className={`absolute top-1/2 -translate-y-1/2 flex items-center justify-center w-8 h-8 rounded-lg text-muted hover:text-text hover:bg-surface transition-all duration-200 ${
              collapsed ? 'left-1/2 -translate-x-1/2' : 'right-2'
            }`}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={collapsed ? "M13 5l7 7-7 7M5 5l7 7-7 7" : "M11 19l-7-7 7-7m8 14l-7-7 7-7"} />
            </svg>
          </button>
        </div>

        {/* Main nav */}
        <nav className="px-2 mt-4 space-y-1">
          {navItems.map((item) => {
            const active = isActive(item.path);
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={`group relative flex items-center rounded-lg py-2.5 text-muted hover:text-primary transition-all duration-200 min-h-[42px] gap-3 ${
                  collapsed ? 'px-0 justify-center' : 'px-2'
                } ${active ? 'text-primary' : ''}`}
              >
                {active && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-primary" />
                )}
                
                <div className={`w-5 h-5 flex items-center justify-center transition-colors duration-200 ${
                  active ? 'text-primary' : 'text-muted group-hover:text-primary'
                }`}>
                  <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 2 : 1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
                  </svg>
                </div>
                {!collapsed && (
                  <span className={`whitespace-nowrap text-sm ${active ? 'font-medium' : ''}`}>{item.label}</span>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* Divider */}
        <div className="mx-4 my-3 border-t border-glass-border/40" />

        {/* Menu items */}
        <div className="flex-1 overflow-y-auto px-2">
          {!collapsed && (
            <div className="px-2 mb-2">
              <span className="text-[10px] font-semibold text-muted/50 uppercase tracking-widest">发现</span>
            </div>
          )}
          <div className="space-y-0.5">
            {menuItems.map((item) => {
              const active = isActive(item.path);
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={`group relative flex items-center rounded-lg py-2.5 text-sm text-muted hover:text-primary transition-all duration-200 min-h-[42px] gap-3 ${
                    collapsed ? 'px-0 justify-center' : 'px-2'
                  } ${active ? 'text-primary' : ''}`}
                >
                  {active && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-primary" />
                  )}
                  <div className={`w-5 h-5 flex items-center justify-center transition-colors duration-200 ${
                    active ? 'text-primary' : 'text-muted group-hover:text-primary'
                  }`}>
                    <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 2 : 1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
                    </svg>
                  </div>
                  {!collapsed && (
                    <span className={`whitespace-nowrap ${active ? 'font-medium' : ''}`}>{item.label}</span>
                  )}
                </NavLink>
              );
            })}
          </div>
        </div>

        {/* Bottom section */}
        {!collapsed && (
          <div className="px-4 py-3 border-t border-glass-border/40">
            <div className="flex items-center gap-2 text-muted/40">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500/60 animate-pulse" />
              <span className="text-[10px]">在线</span>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};

export default Sidebar;
