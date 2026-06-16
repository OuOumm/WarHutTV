import { useState, useEffect } from 'react';
import VideoCard from '../components/VideoCard';
import type { VideoItem } from '../types';
import { favoritesStore } from '../store/favorites';

const Favorites = () => {
  const [favorites, setFavorites] = useState<VideoItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadFavorites();
  }, []);

  const loadFavorites = async () => {
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
                className="absolute top-2 left-2 px-2 py-1 bg-red-600 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity"
              >
                移除
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Favorites;
