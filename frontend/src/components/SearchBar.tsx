import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const SearchBar = () => {
  const [keyword, setKeyword] = useState('');
  const navigate = useNavigate();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (keyword.trim()) {
      navigate(`/search?wd=${encodeURIComponent(keyword.trim().replace(/\s+/g, ''))}`);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 w-full max-w-xl">
      <input
        type="text"
        value={keyword}
        onChange={(e) => setKeyword(e.target.value)}
        placeholder="搜索影片..."
        className="flex-1 px-4 py-2.5 bg-glass backdrop-blur-sm border border-glass-border rounded-xl text-text placeholder-muted focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-transparent transition-all shadow-sm"
      />
      <button
        type="submit"
        className="px-6 py-2.5 bg-primary hover:bg-primary-dim text-deep rounded-xl transition-colors shadow-sm font-medium"
      >
        搜索
      </button>
    </form>
  );
};

export default SearchBar;
