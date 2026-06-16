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

// Play icon overlay - appears on hover with scale animation
const PlayOverlay = () => (
  <div className="absolute inset-0 flex items-center justify-center z-[3] opacity-0 group-hover:opacity-100 transition-opacity duration-300">
    <div className="w-14 h-14 rounded-full bg-yellow-500/90 flex items-center justify-center shadow-lg transform scale-0 group-hover:scale-100 transition-transform duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)]">
      <svg className="w-5 h-5 text-gray-900 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
        <polygon points="5 3 19 12 5 21 5 3"/>
      </svg>
    </div>
  </div>
);

// Rating badge with bounce effect on hover
const RatingBadge = ({ value }: { value: string | number }) => (
  <span className="card-rating text-yellow-500 font-semibold text-sm">
    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
    </svg>
    {value}
  </span>
);

// Base card component matching index.html exactly
const CardBase = ({ to, poster, title, children, actions }: {
  to: string;
  poster: string;
  title: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
}) => (
  <Link
    to={to}
    className="group relative flex-shrink-0 w-[170px] sm:w-[185px] rounded-xl overflow-hidden cursor-pointer"
    style={{
      transition: 'transform 0.35s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.35s ease',
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.boxShadow = '0 12px 24px rgba(0, 0, 0, 0.3), 0 0 10px rgba(230, 185, 30, 0.12)';
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.boxShadow = '';
    }}
  >
    {/* Image container */}
    <div className="relative aspect-[2/3] overflow-hidden">
      <img 
        src={poster} 
        alt={title} 
        className="w-full h-full object-cover transition-transform duration-[600ms] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.08]" 
        loading="lazy" 
      />
      
      {/* Gradient overlay - always visible */}
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'linear-gradient(to top, rgba(11, 17, 30, 0.95) 0%, rgba(11, 17, 30, 0.6) 40%, transparent 70%)'
        }}
      />
      
      {/* Shine sweep effect */}
      <div className="card-shine" />
      
      {/* Play icon */}
      <PlayOverlay />

      {/* Action buttons */}
      {actions}

      {/* Bottom info */}
      {children}
    </div>
  </Link>
);

// Action button component
const ActionButton = ({ onClick, variant, children }: {
  onClick: (e: React.MouseEvent) => void;
  variant: 'delete' | 'favorite';
  children: React.ReactNode;
}) => (
  <button 
    onClick={onClick} 
    className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors shadow-md backdrop-blur-sm ${
      variant === 'delete' 
        ? 'bg-black/60 text-white hover:bg-red-500' 
        : 'bg-black/60 text-white hover:bg-pink-500'
    }`}
  >
    {children}
  </button>
);

const VideoCard = ({ video, douban, bangumi, from = 'vod', onDelete, showActions = false }: VideoCardProps) => {
  const [isFavorited, setIsFavorited] = useState(false);

  const handleFavoriteClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!video) return;
    const result = await favoritesStore.toggle(video);
    setIsFavorited(result);
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!video) return;
    onDelete ? onDelete() : historyStore.remove(video.vod_id);
  };

  // Douban card
  if (from === 'douban' && douban) {
    return (
      <CardBase
        to={`/search?wd=${encodeURIComponent(douban.title.replace(/\s+/g, ''))}`}
        poster={processImageUrl(douban.poster)}
        title={douban.title}
      >
        <div className="absolute bottom-0 left-0 right-0 p-3 z-[1]">
          <h3 className="font-['Anton'] text-sm text-white uppercase tracking-wide leading-tight mb-1.5">
            {douban.title}
          </h3>
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400 font-light">{douban.year}</span>
            {douban.rate && <RatingBadge value={douban.rate} />}
          </div>
        </div>
      </CardBase>
    );
  }

  // Bangumi card
  if (from === 'bangumi' && bangumi) {
    return (
      <CardBase
        to={`/search?wd=${encodeURIComponent((bangumi.name_cn || bangumi.name).replace(/\s+/g, ''))}`}
        poster={processImageUrl(bangumi.images?.large || bangumi.images?.common || bangumi.images?.medium || '')}
        title={bangumi.name_cn || bangumi.name}
      >
        <div className="absolute bottom-0 left-0 right-0 p-3 z-[1]">
          <h3 className="font-['Anton'] text-sm text-white uppercase tracking-wide leading-tight mb-1.5">
            {bangumi.name_cn || bangumi.name}
          </h3>
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400 font-light">{bangumi.air_date?.split('-')[0]}</span>
            {bangumi.rating?.score > 0 && <RatingBadge value={bangumi.rating.score.toFixed(1)} />}
          </div>
        </div>
      </CardBase>
    );
  }

  // VOD card
  if (from === 'vod' && video) {
    return (
      <CardBase
        to={`/play/${(video as any).site_key || 'default'}/${video.vod_id}`}
        poster={video.vod_pic || '/placeholder.jpg'}
        title={video.vod_name}
        actions={
          showActions ? (
            <div className="absolute top-3 right-3 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-[4]">
              <ActionButton onClick={handleDeleteClick} variant="delete">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </ActionButton>
              <ActionButton onClick={handleFavoriteClick} variant="favorite">
                <svg className="w-4 h-4" fill={isFavorited ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
              </ActionButton>
            </div>
          ) : undefined
        }
      >
        {/* Badges */}
        {video.vod_year && (
          <div className="absolute top-3 left-3 bg-black/50 backdrop-blur-sm text-white text-[10px] font-medium px-2 py-1 rounded z-[1]">
            {video.vod_year}
          </div>
        )}
        {video.vod_remarks && (
          <div className="absolute top-3 left-16 bg-emerald-500/80 text-white text-[10px] font-semibold px-2 py-1 rounded z-[1]">
            {video.vod_remarks}
          </div>
        )}

        {/* Bottom info */}
        <div className="absolute bottom-0 left-0 right-0 p-3 z-[1]">
          <h3 className="font-['Anton'] text-[13px] text-white uppercase tracking-wide leading-tight mb-1.5 truncate">
            {video.vod_name}
          </h3>
          <div className="flex items-center justify-between">
            {video.type_name && (
              <span className="text-[11px] text-gray-400">{video.type_name}</span>
            )}
          </div>
        </div>
      </CardBase>
    );
  }

  return null;
};

export default VideoCard;
