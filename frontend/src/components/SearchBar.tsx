import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const SearchBar = () => {
  const [keyword, setKeyword] = useState('');
  const navigate = useNavigate();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (keyword.trim()) {
      navigate(`/search?wd=${encodeURIComponent(keyword.trim())}`);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 w-full max-w-xl">
      <input
        type="text"
        value={keyword}
        onChange={(e) => setKeyword(e.target.value)}
        placeholder="搜索影片..."
        className="flex-1 px-4 py-2.5 bg-white/60 dark:bg-gray-900/80 backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/50 rounded-xl text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-transparent transition-all shadow-sm"
      />
      <button
        type="submit"
        className="px-6 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl transition-colors shadow-sm font-medium"
      >
        搜索
      </button>
    </form>
  );
};

export default SearchBar;
