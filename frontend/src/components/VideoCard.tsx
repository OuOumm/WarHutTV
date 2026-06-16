import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { VideoItem, DoubanItem, BangumiItem } from '../types';
import { processImageUrl } from '../utils/image';
import { favoritesStore } from '../store/favorites';
import { historyStore } from '../store/history';

interface VideoCardProps {
  video?: VideoItem;
  douban?: DoubanItem;
  bangumi?: BangumiItem;
  from?: 'vod' | 'douban' | 'bangumi';
  onDelete?: () => void;
  showActions?: boolean;
}

const VideoCard = ({ video, douban, bangumi, from = 'vod', onDelete, showActions = false }: VideoCardProps) => {
  const [isFavorited, setIsFavorited] = useState(false);

  if (from === 'douban' && douban) {
    return (
      <Link
        to={`/search?wd=${encodeURIComponent(douban.title)}`}
        className="group relative w-full rounded-lg bg-transparent cursor-pointer transition-all duration-300 ease-in-out hover:scale-[1.05] hover:z-[500] min-w-[120px] w-[140px] sm:min-w-[160px] sm:w-[180px] flex-shrink-0"
      >
        <div className="relative aspect-[2/3] overflow-hidden rounded-lg">
          <img src={processImageUrl(douban.poster)} alt={douban.title} className="w-full h-full object-cover" loading="lazy" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300">
            <svg className="w-12 h-12 text-white drop-shadow-lg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={0.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          {douban.rate && (
            <div className="absolute top-2 right-2 bg-pink-500 text-white text-xs font-bold w-7 h-7 rounded-full flex items-center justify-center shadow-md">{douban.rate}</div>
          )}
        </div>
        <div className="mt-2 text-center">
          <span className="block text-sm font-semibold truncate text-gray-900 dark:text-gray-100 group-hover:text-green-600 dark:group-hover:text-green-400 transition-colors">{douban.title}</span>
          {douban.year && <span className="block text-xs text-gray-500 dark:text-gray-400 mt-0.5">{douban.year}</span>}
        </div>
      </Link>
    );
  }

  if (from === 'bangumi' && bangumi) {
    return (
      <Link
        to={`/search?wd=${encodeURIComponent(bangumi.name_cn || bangumi.name)}`}
        className="group relative w-full rounded-lg bg-transparent cursor-pointer transition-all duration-300 ease-in-out hover:scale-[1.05] hover:z-[500] min-w-[120px] w-[140px] sm:min-w-[160px] sm:w-[180px] flex-shrink-0"
      >
        <div className="relative aspect-[2/3] overflow-hidden rounded-lg">
          <img src={processImageUrl(bangumi.images?.large || bangumi.images?.common || bangumi.images?.medium || '')} alt={bangumi.name_cn || bangumi.name} className="w-full h-full object-cover" loading="lazy" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300">
            <svg className="w-12 h-12 text-white drop-shadow-lg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={0.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          {bangumi.rating?.score > 0 && (
            <div className="absolute top-2 right-2 bg-pink-500 text-white text-xs font-bold w-7 h-7 rounded-full flex items-center justify-center shadow-md">{bangumi.rating.score.toFixed(1)}</div>
          )}
        </div>
        <div className="mt-2 text-center">
          <span className="block text-sm font-semibold truncate text-gray-900 dark:text-gray-100 group-hover:text-green-600 dark:group-hover:text-green-400 transition-colors">{bangumi.name_cn || bangumi.name}</span>
          {bangumi.air_date && <span className="block text-xs text-gray-500 dark:text-gray-400 mt-0.5">{bangumi.air_date.split('-')[0]}</span>}
        </div>
      </Link>
    );
  }

  if (from === 'vod' && video) {
    const handleFavoriteClick = async (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const result = await favoritesStore.toggle(video);
      setIsFavorited(result);
    };

    const handleDeleteClick = (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      onDelete ? onDelete() : historyStore.remove(video.vod_id);
    };

    return (
      <Link
        to={`/play/${(video as any).site_key || 'default'}/${video.vod_id}`}
        className="group relative w-full rounded-lg bg-transparent cursor-pointer transition-all duration-300 ease-in-out hover:scale-[1.05] hover:z-[500] min-w-[120px] w-[140px] sm:min-w-[160px] sm:w-[180px] flex-shrink-0"
      >
        <div className="relative aspect-[2/3] overflow-hidden rounded-lg">
          <img src={video.vod_pic || '/placeholder.jpg'} alt={video.vod_name} className="w-full h-full object-cover" loading="lazy" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300">
            <svg className="w-12 h-12 text-white drop-shadow-lg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={0.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          {video.vod_remarks && (
            <div className="absolute top-2 right-2 bg-green-500 text-white text-xs font-semibold px-2 py-1 rounded-md shadow-md">{video.vod_remarks}</div>
          )}
          {video.vod_year && (
            <div className="absolute top-2 left-2 bg-black/50 text-white text-xs font-medium px-2 py-1 rounded backdrop-blur-sm shadow-sm">{video.vod_year}</div>
          )}
          {/* 操作按钮 - 悬停显示 */}
          {showActions && (
            <div className="absolute bottom-2 right-2 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
              <button onClick={handleDeleteClick} className="w-8 h-8 bg-black/60 backdrop-blur-sm rounded-full flex items-center justify-center text-white hover:bg-red-500 transition-colors">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
              <button onClick={handleFavoriteClick} className="w-8 h-8 bg-black/60 backdrop-blur-sm rounded-full flex items-center justify-center text-white hover:bg-pink-500 transition-colors">
                <svg className="w-4 h-4" fill={isFavorited ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
              </button>
            </div>
          )}
        </div>
        <div className="mt-2 text-center">
          <span className="block text-sm font-semibold truncate text-gray-900 dark:text-gray-100 group-hover:text-green-600 dark:group-hover:text-green-400 transition-colors">{video.vod_name}</span>
          {video.type_name && (
            <span className="block text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              <span className="inline-block border rounded px-2 py-0.5 border-gray-500/60 dark:border-gray-500/60 group-hover:border-green-500/60 group-hover:text-green-600 dark:group-hover:text-green-400 transition-colors">{video.type_name}</span>
            </span>
          )}
        </div>
      </Link>
    );
  }

  return null;
};

export default VideoCard;
