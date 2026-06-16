import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import VideoCard from '../components/VideoCard';
import type { VideoItem } from '../types';
import { favoritesStore } from '../store/favorites';

const Favorites = () => {
  const [favorites, setFavorites] = useState<VideoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const location = useLocation();

  useEffect(() => {
    loadFavorites();
  }, [location.pathname]);

  const loadFavorites = async () => {
    setLoading(true);
    const items = await favoritesStore.getAll();
    setFavorites(items);
    setLoading(false);
  };

  const handleRemove = async (vodId: string | number) => {
    await favoritesStore.remove(vodId);
    await loadFavorites();
  };

  if (loading) {
    return <div className="text-center text-gray-400 py-8">加载中...</div>;
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-6">我的收藏</h1>

      {favorites.length === 0 ? (
        <div className="text-center text-gray-400 py-8">
          暂无收藏
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {favorites.map((item) => (
            <div key={item.vod_id} className="relative group">
              <VideoCard video={item} />
              <button
                onClick={() => handleRemove(item.vod_id)}
                className="absolute bottom-12 right-2 w-8 h-8 bg-red-500/90 backdrop-blur-sm text-white rounded-full flex items-center justify-center shadow-md hover:bg-red-600 transition-all opacity-0 group-hover:opacity-100 z-50"
                title="删除收藏"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Favorites;
