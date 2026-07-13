import { processImageUrl, buildDoubanSrcSet } from '../../utils/image';
import { SourceStatusBadge } from './SourceStatusBadge';
import { sortSourcesBySpeed } from './playUtils';
import type { Episode, SourcePanelState } from './types';

interface SourcePanelProps extends SourcePanelState {
  onActiveTabChange: (tab: 'episodes' | 'sources') => void;
  onEpisodeClick: (episode: Episode) => void;
  onEpisodePageChange: (page: number) => void;
  onSourceSwitch: (sourceKey: string) => void;
  watchedEpisodes: string[];
}

export function SourcePanel({
  activeTab,
  currentDetail,
  currentEpisode,
  currentSource,
  episodePage,
  episodes,
  episodesPerPage,
  sourceListRef,
  sourceLoading,
  sources,
  onActiveTabChange,
  onEpisodeClick,
  onEpisodePageChange,
  onSourceSwitch,
  watchedEpisodes,
}: SourcePanelProps) {
  return (
    <div className="md:col-span-1 h-[300px] lg:h-full overflow-hidden">
      <div className="h-full bg-card rounded-xl overflow-hidden flex flex-col">
        {episodes.length <= 1 ? (
          <SourceList
            currentDetailName={currentDetail.vod_name}
            currentSource={currentSource}
            sourceListRef={sourceListRef}
            sourceLoading={sourceLoading}
            sources={sources}
            onSourceSwitch={onSourceSwitch}
          />
        ) : (
          <>
            <div className="flex border-b border-glass-border flex-shrink-0">
              <button onClick={() => onActiveTabChange('episodes')} className={`flex-1 px-3 py-2.5 text-sm font-medium transition-colors ${activeTab === 'episodes' ? 'text-primary border-b-2 border-primary bg-deep' : 'text-muted'}`}>
                播放集数
              </button>
              <button onClick={() => onActiveTabChange('sources')} className={`flex-1 px-3 py-2.5 text-sm font-medium transition-colors ${activeTab === 'sources' ? 'text-primary border-b-2 border-primary bg-deep' : 'text-muted'}`}>
                换源
              </button>
            </div>

            <div className="flex-1 min-h-0 max-h-full overflow-y-auto bg-deep">
              {activeTab === 'episodes' ? (
                <EpisodeGrid
                  currentEpisode={currentEpisode}
                  episodePage={episodePage}
                  episodes={episodes}
                  episodesPerPage={episodesPerPage}
                  onEpisodeClick={onEpisodeClick}
                  onEpisodePageChange={onEpisodePageChange}
                  watchedEpisodes={watchedEpisodes}
                />
              ) : (
                <SourceList
                  currentDetailName={currentDetail.vod_name}
                  currentSource={currentSource}
                  sourceListRef={sourceListRef}
                  sourceLoading={sourceLoading}
                  sources={sources}
                  onSourceSwitch={onSourceSwitch}
                />
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

interface SourceListProps {
  currentDetailName: string;
  currentSource: string;
  sourceListRef?: React.RefObject<HTMLDivElement | null>;
  sourceLoading: boolean;
  sources: SourcePanelState['sources'];
  onSourceSwitch: (sourceKey: string) => void;
}

function SourceList({ currentDetailName, currentSource, sourceListRef, sourceLoading, sources, onSourceSwitch }: SourceListProps) {
  if (sourceLoading) {
    return <div className="flex justify-center py-4"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" /></div>;
  }
  if (sources.length === 0) {
    return <div className="text-center text-muted text-sm py-4">暂无其他播放源</div>;
  }

  // 按速度排序：快源在上、测速失败（status==='error'）沉底。仅渲染期排序，
  // 不改 reducer 中 sources 的原始顺序（setSourceStatus 仍按索引更新）。
  const displaySources = sortSourcesBySpeed(sources);

  return (
    <div ref={sourceListRef} className="flex-1 min-h-0 max-h-full overflow-y-auto bg-deep">
      <div className="space-y-1.5">
        {displaySources.map((source) => (
          <button
            key={source.key}
            type="button"
            onClick={() => onSourceSwitch(source.key)}
            aria-label={`切换播放源：${source.name}`}
            data-active={currentSource === source.key ? 'true' : undefined}
            className={`flex gap-2.5 p-2 w-full text-left rounded-lg cursor-pointer transition-colors ${currentSource === source.key ? 'bg-primary-glow ring-1 ring-primary' : 'hover:bg-surface'}`}
          >
            <div className="w-12 h-16 flex-shrink-0 rounded overflow-hidden bg-surface">
              {source.poster ? <img src={processImageUrl(source.poster)} srcSet={buildDoubanSrcSet(source.poster)} sizes="48px" alt="" className="w-full h-full object-cover" decoding="async" /> : <div className="w-full h-full flex items-center justify-center text-muted text-xs">暂无</div>}
            </div>
            <div className="flex-1 min-w-0 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-text truncate">{currentDetailName}</span>
                  {source.speed && <span className="text-[10px] px-1.5 py-0.5 bg-green-900/30 text-green-400 rounded">{source.speed.quality}</span>}
                  {source.status === 'error' && <span className="text-[10px] px-1.5 py-0.5 bg-red-900/30 text-red-400 rounded">检测失败</span>}
                </div>
                <div className="flex items-center gap-1 mt-0.5">
                  <span className="text-[10px] px-1 py-0.5 bg-card text-muted rounded">{source.name}</span>
                  {source.episodeCount && <span className="text-[10px] text-muted">{source.episodeCount} 集</span>}
                </div>
              </div>
              <div className="text-[10px]">
                <SourceStatusBadge source={source} />
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

interface EpisodeGridProps {
  currentEpisode: Episode | null;
  episodePage: number;
  episodes: Episode[];
  episodesPerPage: number;
  onEpisodeClick: (episode: Episode) => void;
  onEpisodePageChange: (page: number) => void;
  watchedEpisodes: string[];
}

function EpisodeGrid({ currentEpisode, episodePage, episodes, episodesPerPage, onEpisodeClick, onEpisodePageChange, watchedEpisodes }: EpisodeGridProps) {
  return (
    <>
      {episodes.length > episodesPerPage && (
        <div className="sticky top-0 z-10 bg-surface border-b border-glass-border px-2 py-1.5">
          <div className="flex gap-1 overflow-x-auto scrollbar-hide">
            {Array.from({ length: Math.ceil(episodes.length / episodesPerPage) }, (_, index) => {
              const start = index * episodesPerPage + 1;
              const end = Math.min((index + 1) * episodesPerPage, episodes.length);
              return (
                <button
                  key={index}
                  onClick={() => onEpisodePageChange(index)}
                  className={`px-2.5 py-1 text-[11px] font-medium rounded-md flex-shrink-0 transition-all ${episodePage === index ? 'bg-primary text-deep shadow-sm' : 'text-muted hover:text-text hover:bg-card'}`}
                >
                  {start}-{end}
                </button>
              );
            })}
          </div>
        </div>
      )}
      <div className="p-2 grid grid-cols-4 gap-1.5">
        {episodes.slice(episodePage * episodesPerPage, (episodePage + 1) * episodesPerPage).map((episode, index) => {
          const isCurrent = currentEpisode?.name === episode.name;
          const isWatched = !isCurrent && watchedEpisodes.includes(episode.name);
          return (
            <button
              key={index}
              onClick={() => onEpisodeClick(episode)}
              className={`px-1.5 py-1.5 text-xs rounded-md transition-colors ${isCurrent ? 'bg-primary text-deep' : isWatched ? 'bg-watched text-text ring-1 ring-primary/40' : 'bg-surface text-muted hover:bg-card'}`}
              title={episode.name}
              aria-label={isWatched ? `已观看：${episode.name}` : episode.name}
            >
              <span className="truncate">{isWatched ? '✓ ' : ''}{episode.name}</span>
            </button>
          );
        })}
      </div>
    </>
  );
}
