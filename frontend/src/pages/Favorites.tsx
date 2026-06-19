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
    return (
      <div className="px-2 sm:px-4 py-4 sm:py-6 max-w-[95%] mx-auto overflow-visible">
        <div className="h-7 w-24 bg-surface rounded-lg animate-pulse mb-6" />
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-x-2 gap-y-12 sm:gap-x-6 sm:gap-y-16">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i}>
              <div className="aspect-[2/3] bg-surface rounded-xl animate-pulse" />
              <div className="mt-2 h-4 bg-surface rounded animate-pulse w-3/4" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="px-2 sm:px-4 py-4 sm:py-6 max-w-[95%] mx-auto overflow-visible page-enter">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-text">我的收藏</h1>
        {favorites.length > 0 && (
          <button
            onClick={async () => {
              await favoritesStore.clear();
              await loadFavorites();
            }}
            className="text-sm text-muted hover:text-primary transition-colors"
          >
            清空
          </button>
        )}
      </div>

      {favorites.length === 0 ? (
        <div className="text-center text-muted py-20">
          <div className="w-16 h-16 rounded-full bg-surface mx-auto mb-4 flex items-center justify-center">
            <svg className="w-8 h-8 text-primary/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
          </div>
          <p className="text-lg text-text/80">暂无收藏内容</p>
          <p className="mt-2 text-sm">浏览影片时点击爱心图标收藏</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-x-2 gap-y-12 sm:grid-cols-4 lg:grid-cols-5 sm:gap-x-6 sm:gap-y-16">
          {favorites.map((item) => (
            <div key={item.vod_id} className="relative group">
              <VideoCard video={item} showActions />
              <div className="absolute top-2 left-2 z-[5]">
                <button
                  onClick={() => handleRemove(item.vod_id)}
                  className="w-7 h-7 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center text-white/80 hover:bg-red-500/80 hover:text-white hover:scale-110 active:scale-95 border border-white/10 transition-all duration-200"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Favorites;
