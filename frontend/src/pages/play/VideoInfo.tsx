import type { VideoDetail } from '../../types';
import type { SourceItem } from './types';
import { cleanVodContent } from '../../utils/text';

interface VideoInfoProps {
  currentDetail: VideoDetail;
  currentSource: string;
  isFavorite: boolean;
  site?: string;
  sources: SourceItem[];
  onClearInvalidHistory: () => Promise<void>;
  onToggleFavorite: () => Promise<void>;
}

export function VideoInfo({
  currentDetail,
  currentSource,
  isFavorite,
  site,
  sources,
  onClearInvalidHistory,
  onToggleFavorite,
}: VideoInfoProps) {
  const sourceName = sources.find((source) => source.key === currentSource)?.name || site;
  const vodContent = cleanVodContent(currentDetail.vod_content);

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mt-2">
      <div className="hidden md:block md:col-span-1 md:order-first">
        <div className="pr-6">
          <div className="relative aspect-[2/3] rounded-xl overflow-hidden shadow-lg">
            <img src={currentDetail.vod_pic || '/placeholder.jpg'} alt={currentDetail.vod_name} className="w-full h-full object-cover" />
          </div>
        </div>
      </div>

      <div className="md:col-span-3">
        <div className="p-4">
          <h1 className="text-2xl sm:text-3xl font-bold text-text mb-2 flex items-center gap-3">
            {currentDetail.vod_name}
            <button onClick={onToggleFavorite} className="flex-shrink-0 hover:opacity-80 transition-opacity">
              {isFavorite ? (
                <svg className="h-7 w-7" viewBox="0 0 24 24" fill="#ef4444" stroke="#ef4444" strokeWidth="2"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" /></svg>
              ) : (
                <svg className="h-7 w-7 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1"><path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>
              )}
            </button>
          </h1>

          <div className="flex flex-wrap items-center gap-3 text-base mb-4">
            {currentDetail.type_name && <span className="text-primary font-semibold">{currentDetail.type_name}</span>}
            {currentDetail.vod_year && <span className="text-muted">{currentDetail.vod_year}</span>}
            <span className="border border-glass-border px-2 py-0.5 rounded text-muted text-sm">
              {sourceName}
            </span>
            {currentDetail.vod_remarks && <span className="text-muted">{currentDetail.vod_remarks}</span>}
          </div>

          {vodContent && (
            <div className="text-base leading-relaxed text-muted" style={{ whiteSpace: 'pre-line' }}>
              {vodContent}
              {site && /^\d+$/.test(site) && (
                <div className="mt-4">
                  <button
                    onClick={onClearInvalidHistory}
                    className="px-4 py-2 bg-primary text-deep rounded-lg hover:opacity-90 transition-opacity"
                  >
                    清空历史记录并返回首页
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
