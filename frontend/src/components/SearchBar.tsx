import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const SearchBar = () => {
  const [keyword, setKeyword] = useState('');
  const [focused, setFocused] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (keyword.trim()) {
      navigate(`/search?wd=${encodeURIComponent(keyword.trim().replace(/\s+/g, ''))}`);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 w-full max-w-xl">
      <div className={`flex-1 relative transition-all duration-300 ${focused ? 'scale-[1.01]' : ''}`}>
        <input
          type="text"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder="搜索影片..."
          className="w-full px-4 py-2.5 bg-glass backdrop-blur-sm border border-glass-border rounded-xl text-text placeholder-muted focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/30 transition-all duration-200 shadow-sm"
        />
        {/* Focus glow */}
        {focused && (
          <div className="absolute inset-0 rounded-xl pointer-events-none" style={{ boxShadow: '0 0 20px var(--color-primary-glow)' }} />
        )}
      </div>
      <button
        type="submit"
        className="px-6 py-2.5 bg-primary hover:bg-primary-dim text-deep rounded-xl transition-all duration-200 shadow-sm font-medium hover:shadow-md hover:shadow-primary/20 active:scale-[0.97]"
      >
        搜索
      </button>
    </form>
  );
};

export default SearchBar;
