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

// Play icon overlay
const PlayOverlay = () => (
  <div className="absolute inset-0 flex items-center justify-center z-[3] opacity-0 group-hover:opacity-100 transition-opacity duration-300">
    <div className="w-12 h-12 rounded-full bg-primary/90 flex items-center justify-center shadow-lg transform scale-0 group-hover:scale-100 transition-transform duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)]">
      <svg className="w-4 h-4 text-deep ml-0.5" fill="currentColor" viewBox="0 0 24 24">
        <polygon points="5 3 19 12 5 21 5 3"/>
      </svg>
    </div>
  </div>
);

// Top-right badge (single)
const Badge = ({ children, variant = 'default' }: { children: React.ReactNode; variant?: 'default' | 'highlight' }) => (
  <div className={`absolute top-2.5 right-2.5 text-[10px] font-semibold px-2 py-0.5 rounded z-[1] backdrop-blur-sm ${
    variant === 'highlight' 
      ? 'bg-primary/80 text-deep' 
      : 'bg-black/50 text-white'
  }`}>
    {children}
  </div>
);

// Action button
const ActionButton = ({ onClick, variant, children }: {
  onClick: (e: React.MouseEvent) => void;
  variant: 'delete' | 'favorite';
  children: React.ReactNode;
}) => (
  <button 
    onClick={onClick} 
    className={`w-7 h-7 rounded-full flex items-center justify-center transition-all shadow-md backdrop-blur-sm ${
      variant === 'delete' 
        ? 'bg-black/60 text-white hover:bg-red-500' 
        : 'bg-black/60 text-white hover:bg-pink-500'
    }`}
  >
    {children}
  </button>
);

// Base card component
const CardBase = ({ to, poster, title, badge, children, actions }: {
  to: string;
  poster: string;
  title: string;
  badge?: React.ReactNode;
  children?: React.ReactNode;
  actions?: React.ReactNode;
}) => (
  <Link
    to={to}
    className="group relative block rounded-xl overflow-hidden cursor-pointer w-full"
    style={{
      transition: 'transform 0.35s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.35s ease',
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.boxShadow = '0 12px 24px rgba(0, 0, 0, 0.3), 0 0 10px var(--color-primary-glow)';
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
        className="w-full h-full object-cover transition-transform duration-[600ms] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.05]" 
        loading="lazy" 
      />
      
      {/* Gradient overlay - softer */}
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'linear-gradient(to top, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.3) 35%, transparent 60%)'
        }}
      />
      
      {/* Shine sweep effect */}
      <div className="card-shine" />
      
      {/* Play icon */}
      <PlayOverlay />

      {/* Top-right badge */}
      {badge}

      {/* Action buttons - horizontal at bottom on hover */}
      {actions && (
        <div className="absolute bottom-12 left-0 right-0 flex justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-[4]">
          {actions}
        </div>
      )}

      {/* Bottom info */}
      <div className="absolute bottom-0 left-0 right-0 px-3 pb-2.5 z-[1]">
        {children}
      </div>
    </div>
  </Link>
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
        badge={douban.rate ? <Badge variant="highlight">{douban.rate}</Badge> : undefined}
      >
        <h3 className="font-['Anton'] text-[13px] text-white uppercase tracking-wide leading-tight mb-1 truncate">
          {douban.title}
        </h3>
        <div className="flex items-center gap-1.5">
          {douban.year && <span className="text-[11px] text-white/60">{douban.year}</span>}
        </div>
      </CardBase>
    );
  }

  // Bangumi card
  if (from === 'bangumi' && bangumi) {
    const rating = bangumi.rating?.score > 0 ? bangumi.rating.score.toFixed(1) : null;
    return (
      <CardBase
        to={`/search?wd=${encodeURIComponent((bangumi.name_cn || bangumi.name).replace(/\s+/g, ''))}`}
        poster={processImageUrl(bangumi.images?.large || bangumi.images?.common || bangumi.images?.medium || '')}
        title={bangumi.name_cn || bangumi.name}
        badge={rating ? <Badge variant="highlight">{rating}</Badge> : undefined}
      >
        <h3 className="font-['Anton'] text-[13px] text-white uppercase tracking-wide leading-tight mb-1 truncate">
          {bangumi.name_cn || bangumi.name}
        </h3>
        <div className="flex items-center gap-1.5">
          {bangumi.air_date && <span className="text-[11px] text-white/60">{bangumi.air_date.split('-')[0]}</span>}
        </div>
      </CardBase>
    );
  }

  // VOD card
  if (from === 'vod' && video) {
    const year = video.vod_year;
    const type = video.type_name;
    const remarks = video.vod_remarks;
    
    // Meta line: year · type
    const metaParts = [year, type].filter(Boolean);
    
    return (
      <CardBase
        to={`/play/${(video as any).site_key || 'default'}/${video.vod_id}`}
        poster={video.vod_pic || '/placeholder.jpg'}
        title={video.vod_name}
        badge={remarks ? <Badge>{remarks}</Badge> : undefined}
        actions={
          showActions ? (
            <>
              <ActionButton onClick={handleDeleteClick} variant="delete">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </ActionButton>
              <ActionButton onClick={handleFavoriteClick} variant="favorite">
                <svg className="w-3.5 h-3.5" fill={isFavorited ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
              </ActionButton>
            </>
          ) : undefined
        }
      >
        <h3 className="font-['Anton'] text-[13px] text-white uppercase tracking-wide leading-tight mb-1 truncate">
          {video.vod_name}
        </h3>
        {metaParts.length > 0 && (
          <div className="flex items-center">
            <span className="text-[11px] text-white/60">{metaParts.join(' · ')}</span>
          </div>
        )}
      </CardBase>
    );
  }

  return null;
};

export default VideoCard;
