import { useState, useCallback, memo } from 'react';
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

// ─── Sub-components (memoised) ───

const PlayOverlay = memo(() => (
  <div className="absolute inset-0 flex items-center justify-center z-[3] opacity-0 group-hover:opacity-100 transition-opacity duration-300">
    <div className="relative">
      <div className="absolute inset-0 w-16 h-16 -m-2 rounded-full border-2 border-primary/30 scale-0 group-hover:scale-100 group-hover:opacity-0 transition-all duration-700 ease-out" />
      <div className="w-12 h-12 rounded-full bg-primary/90 backdrop-blur-sm flex items-center justify-center shadow-lg shadow-primary/25 scale-0 group-hover:scale-100 transition-transform duration-300"
        style={{ transitionTimingFunction: 'var(--ease-elastic)' }}>
        <svg className="w-5 h-5 text-deep ml-0.5" fill="currentColor" viewBox="0 0 24 24">
          <polygon points="6 3 20 12 6 21 6 3"/>
        </svg>
      </div>
    </div>
  </div>
));

const Badge = memo(({ children, variant = 'default' }: { children: React.ReactNode; variant?: 'default' | 'highlight' }) => (
  <div className={`absolute top-2.5 right-2.5 text-[10px] font-bold px-2 py-0.5 rounded-md z-[1] backdrop-blur-sm tracking-wide ${
    variant === 'highlight'
      ? 'bg-primary/90 text-deep shadow-sm shadow-primary/20'
      : 'bg-black/60 text-white/90'
  }`}>
    {children}
  </div>
));

const ActionButton = memo(({ onClick, variant, children }: {
  onClick: (e: React.MouseEvent) => void;
  variant: 'delete' | 'favorite';
  children: React.ReactNode;
}) => (
  <button
    onClick={onClick}
    className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 shadow-lg backdrop-blur-md border border-white/10 hover:scale-110 active:scale-95 ${
      variant === 'delete'
        ? 'bg-black/50 text-white/80 hover:bg-red-500/80 hover:text-white hover:border-red-400/30'
        : 'bg-black/50 text-white/80 hover:bg-pink-500/80 hover:text-white hover:border-pink-400/30'
    }`}
  >
    {children}
  </button>
));

// ─── Base card ───

const CardBase = memo(({ to, poster, title, badge, children, actions }: {
  to: string;
  poster: string;
  title: string;
  badge?: React.ReactNode;
  children?: React.ReactNode;
  actions?: React.ReactNode;
}) => {
  const [lifted, setLifted] = useState(false);

  return (
    <Link
      to={to}
      className={`group relative block rounded-xl overflow-hidden cursor-pointer w-full card-entrance card-base transition-all duration-350 ${
        lifted ? '-translate-y-1.5 scale-[1.02] shadow-xl shadow-black/30' : ''
      }`}
      style={{ transitionTimingFunction: 'var(--ease-elastic), var(--ease-out-expo)' }}
      onMouseEnter={() => setLifted(true)}
      onMouseLeave={() => setLifted(false)}
    >
      <div className="relative aspect-[2/3] overflow-hidden bg-surface">
        <img
          src={poster}
          alt={title}
          className="w-full h-full object-cover transition-transform duration-[800ms] group-hover:scale-[1.08]"
          style={{ transitionTimingFunction: 'var(--ease-out-expo)' }}
          loading="lazy"
        />

        {/* Gradient overlay */}
        <div
          className="absolute inset-0 pointer-events-none transition-opacity duration-500"
          style={{
            background: `
              linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.4) 30%, transparent 55%),
              linear-gradient(to bottom, rgba(0,0,0,0.3) 0%, transparent 20%)
            `
          }}
        />

        {/* Theme accent glow on hover */}
        <div
          className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse at center bottom, var(--color-primary-glow) 0%, transparent 60%)'
          }}
        />

        <PlayOverlay />
        {badge}

        {/* Action buttons */}
        {actions && (
          <div className="absolute bottom-14 left-0 right-0 flex justify-center gap-2 opacity-100 translate-y-0 sm:opacity-0 sm:translate-y-2 sm:group-hover:opacity-100 sm:group-hover:translate-y-0 transition-all duration-300 z-[4]"
            style={{ transitionTimingFunction: 'var(--ease-elastic)' }}>
            {actions}
          </div>
        )}

        {/* Bottom info */}
        <div className="absolute bottom-0 left-0 right-0 px-3 pb-3 z-[1]">
          {children}
        </div>
      </div>
    </Link>
  );
});

// ─── Main component ───

const VideoCard = memo(({ video, douban, bangumi, from = 'vod', onDelete, showActions = false }: VideoCardProps) => {
  const [isFavorited, setIsFavorited] = useState(false);

  const handleFavoriteClick = useCallback(async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!video) return;
    const result = await favoritesStore.toggle(video);
    setIsFavorited(result);
  }, [video]);

  const handleDeleteClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!video) return;
    onDelete ? onDelete() : historyStore.remove(video.vod_id);
  }, [video, onDelete]);

  // ── Douban variant ──
  if (from === 'douban' && douban) {
    const searchUrl = `/search?wd=${encodeURIComponent(douban.title.replace(/\s+/g, ''))}`;
    return (
      <CardBase to={searchUrl} poster={processImageUrl(douban.poster)} title={douban.title}
        badge={douban.rate ? <Badge variant="highlight">{douban.rate}</Badge> : undefined}>
        <h3 className="font-['Anton'] text-[13px] text-white uppercase tracking-wider leading-tight mb-1.5 truncate drop-shadow-sm">
          {douban.title}
        </h3>
        {douban.year && (
          <span className="text-[11px] text-white/50 font-medium tracking-wide">{douban.year}</span>
        )}
      </CardBase>
    );
  }

  // ── Bangumi variant ──
  if (from === 'bangumi' && bangumi) {
    const searchUrl = `/search?wd=${encodeURIComponent((bangumi.name_cn || bangumi.name).replace(/\s+/g, ''))}`;
    const poster = processImageUrl(bangumi.images?.large || bangumi.images?.common || bangumi.images?.medium || '');
    const title = bangumi.name_cn || bangumi.name;
    const rating = bangumi.rating?.score > 0 ? bangumi.rating.score.toFixed(1) : null;
    const year = bangumi?.air_date ? bangumi.air_date.split('-')[0] : null;

    return (
      <CardBase to={searchUrl} poster={poster} title={title}
        badge={rating ? <Badge variant="highlight">{rating}</Badge> : undefined}>
        <h3 className="font-['Anton'] text-[13px] text-white uppercase tracking-wider leading-tight mb-1.5 truncate drop-shadow-sm">
          {title}
        </h3>
        {year && <span className="text-[11px] text-white/50 font-medium tracking-wide">{year}</span>}
      </CardBase>
    );
  }

  // ── VOD variant ──
  if (from === 'vod' && video) {
    const playUrl = `/play/${(video as any).site_key || 'default'}/${video.vod_id}`;
    const metaParts = [video.vod_year, video.type_name].filter(Boolean);
    const remarks = video.vod_remarks;

    return (
      <CardBase to={playUrl} poster={video.vod_pic || '/placeholder.jpg'} title={video.vod_name}
        badge={remarks ? <Badge>{remarks}</Badge> : undefined}
        actions={showActions ? (
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
        ) : undefined}>
        <h3 className="font-['Anton'] text-[13px] text-white uppercase tracking-wider leading-tight mb-1.5 truncate drop-shadow-sm">
          {video.vod_name}
        </h3>
        {metaParts.length > 0 && (
          <span className="text-[11px] text-white/50 font-medium tracking-wide">{metaParts.join(' · ')}</span>
        )}
      </CardBase>
    );
  }

  return null;
});

export default VideoCard;
