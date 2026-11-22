import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  clearSearchHistory,
  readSearchHistory,
  removeSearchHistory,
} from '../store/searchHistory';

const SearchBar = () => {
  const [searchParams] = useSearchParams();
  const wd = searchParams.get('wd') || '';
  const [keyword, setKeyword] = useState(wd);
  const [focused, setFocused] = useState(false);
  const [history, setHistory] = useState<string[]>(() => readSearchHistory());
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const blurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setKeyword(wd);
  }, [wd]);

  // Refresh the list when the dropdown opens rather than in an effect: the user
  // may have searched in another tab since this component mounted, and reading
  // on focus keeps the read out of the render/effect cycle entirely.
  const handleFocus = () => {
    setHistory(readSearchHistory());
    setFocused(true);
  };

  useEffect(
    () => () => {
      if (blurTimerRef.current) clearTimeout(blurTimerRef.current);
    },
    [],
  );

  const go = useCallback(
    (raw: string) => {
      const term = raw.trim().replace(/\s+/g, '');
      if (!term) return;
      // The search page records the keyword (it also sees recommendations,
      // bookmarks and back-navigation), so this only navigates.
      setFocused(false);
      inputRef.current?.blur();
      navigate(`/search?wd=${encodeURIComponent(term)}`);
    },
    [navigate],
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    go(keyword);
  };

  // Keep the dropdown open long enough for a click on one of its rows: a blur
  // fires before the click lands, so hiding on blur would swallow the click.
  const handleBlur = () => {
    blurTimerRef.current = setTimeout(() => setFocused(false), 120);
  };

  const showHistory = focused && history.length > 0;

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 w-full max-w-xl" role="search">
      <label htmlFor="search-input" className="sr-only">搜索影片</label>
      <div className="relative flex-1">
        {/* Search icon */}
        <div className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-muted z-10">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <input
          id="search-input"
          ref={inputRef}
          type="text"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder="搜索影片..."
          aria-label="搜索影片"
          aria-autocomplete="list"
          aria-expanded={showHistory}
          aria-controls={showHistory ? 'search-history' : undefined}
          className="w-full pl-10 pr-4 py-2.5 bg-glass backdrop-blur-sm border rounded-xl text-text placeholder-muted/70 outline-none transition-all duration-200"
          style={{
            outline: 'none',
            borderColor: focused ? 'var(--color-primary)' : 'var(--color-glass-border)',
          }}
        />

        {showHistory && (
          <div
            id="search-history"
            role="listbox"
            aria-label="最近搜索"
            className="absolute left-0 right-0 top-full mt-2 z-50 glass-panel rounded-xl shadow-2xl overflow-hidden py-1"
          >
            <div className="flex items-center justify-between px-3 py-1.5">
              <span className="text-[11px] tracking-wider uppercase text-muted">最近搜索</span>
              <button
                type="button"
                onClick={() => setHistory(clearSearchHistory())}
                className="text-[11px] text-muted hover:text-primary transition-colors"
              >
                清空
              </button>
            </div>
            {history.map((item) => (
              <div key={item} className="group flex items-center">
                <button
                  type="button"
                  role="option"
                  aria-selected={false}
                  onClick={() => go(item)}
                  className="flex-1 text-left px-3 py-2 text-sm text-text/90 hover:bg-primary-glow transition-colors truncate"
                >
                  {item}
                </button>
                <button
                  type="button"
                  aria-label={`删除 ${item}`}
                  onClick={() => setHistory(removeSearchHistory(item))}
                  className="w-8 h-8 mr-1 flex items-center justify-center rounded-md text-muted/60 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
      <button
        type="submit"
        aria-label="搜索"
        className="px-5 py-2.5 bg-primary hover:bg-primary-dim text-deep rounded-xl transition-all duration-200 shadow-sm hover:shadow-md hover:shadow-primary/20 active:scale-[0.97]"
      >
        搜索
      </button>
    </form>
  );
};

export default SearchBar;
