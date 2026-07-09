import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

const SearchBar = () => {
  const [searchParams] = useSearchParams();
  const wd = searchParams.get('wd') || '';
  const [keyword, setKeyword] = useState(wd);
  const [focused, setFocused] = useState(false);
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setKeyword(wd);
  }, [wd]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (keyword.trim()) {
      navigate(`/search?wd=${encodeURIComponent(keyword.trim().replace(/\s+/g, ''))}`);
    }
  };

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
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder="搜索影片..."
          aria-label="搜索影片"
          className="w-full pl-10 pr-4 py-2.5 bg-glass backdrop-blur-sm border rounded-xl text-text placeholder-muted/70 outline-none transition-all duration-200"
          style={{
            outline: 'none',
            borderColor: focused ? 'var(--color-primary)' : 'var(--color-glass-border)',
          }}
        />
      </div>
      <button
        type="submit"
        aria-label="搜索"
        className="px-5 py-2.5 bg-primary hover:bg-primary-dim text-deep rounded-xl transition-all duration-200 shadow-sm font-medium hover:shadow-md hover:shadow-primary/20 active:scale-[0.97]"
      >
        搜索
      </button>
    </form>
  );
};

export default SearchBar;
