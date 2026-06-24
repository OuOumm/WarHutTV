import { useCallback, useRef } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';

const navItems = [
  { path: '/', label: '首页', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
  { path: '/douban?type=movie', label: '电影', icon: 'M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z' },
  { path: '/douban?type=tv', label: '剧集', icon: 'M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z' },
  { path: '/douban?type=anime', label: '动漫', icon: 'M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
  { path: '/douban?type=show', label: '综艺', icon: 'M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z' },
];

/** Resolve the current nav index from the URL */
function getCurrentIndex(pathname: string, search: string): number {
  if (pathname === '/') return 0;
  if (pathname.startsWith('/douban')) {
    const m = search.match(/type=([^&]+)/);
    const t = m?.[1];
    if (t === 'movie') return 1;
    if (t === 'tv') return 2;
    if (t === 'anime') return 3;
    if (t === 'show') return 4;
  }
  return -1; // not a nav page
}

const SWIPE_THRESHOLD = 50; // px

const MobileNav = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);

  const isActive = useCallback((path: string) => {
    if (path === '/') return location.pathname === '/';
    if (path.includes('type=')) {
      const typeMatch = path.match(/type=([^&]+)/)?.[1];
      return location.pathname.startsWith('/douban') && location.search.includes(`type=${typeMatch}`);
    }
    return location.pathname.startsWith(path);
  }, [location]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = e.changedTouches[0].clientY - touchStartY.current;

    // Only handle horizontal swipes (ignore vertical scrolls)
    if (Math.abs(dx) < SWIPE_THRESHOLD || Math.abs(dx) < Math.abs(dy)) return;

    const idx = getCurrentIndex(location.pathname, location.search);
    if (idx === -1) return;

    const nextIdx = dx < 0
      ? Math.min(idx + 1, navItems.length - 1)  // swipe left → next
      : Math.max(idx - 1, 0);                     // swipe right → prev

    if (nextIdx !== idx) {
      navigate(navItems[nextIdx].path);
    }
  }, [location, navigate]);

  return (
    <nav
      className="md:hidden fixed left-0 right-0 z-[600] border-t border-glass-border/50 bg-card/90 backdrop-blur-xl backdrop-saturate-150"
      style={{ bottom: 0, paddingBottom: 'env(safe-area-inset-bottom)' }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <ul className="flex items-center overflow-x-auto scrollbar-hide">
        {navItems.map((item) => {
          const active = isActive(item.path);
          return (
            <li key={item.path} className="flex-1 min-w-0">
              <NavLink
                to={item.path}
                className={`relative flex flex-col items-center justify-center w-full h-14 gap-0.5 text-xs transition-all duration-200 ${
                  active ? 'text-primary' : 'text-muted hover:text-text'
                }`}
              >
                {/* Active indicator bar */}
                {active && (
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-0.5 rounded-b-full bg-primary" />
                )}
                <svg
                  className="h-5 w-5 transition-colors duration-200"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={active ? 2 : 1.5}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
                </svg>
                <span className="text-[11px] leading-none transition-colors duration-200">
                  {item.label}
                </span>
              </NavLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
};

export default MobileNav;
