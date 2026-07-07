import { lazy, Suspense } from 'react';
import { OptimizingOverlay } from '../../components/OptimizingOverlay';
import { SearchingOverlay } from '../../components/SearchingOverlay';
import type { PlayerViewportState } from './types';

const Player = lazy(() => import('../../components/Player'));

interface PlayerViewportProps extends PlayerViewportState {
  onTimeUpdate: (time: number) => void;
}

export function PlayerViewport({
  currentDetail,
  currentTime,
  isOptimizing,
  optimizeComplete,
  playUrl,
  searchProgress,
  sourceSwitching,
  sources,
  onTimeUpdate,
}: PlayerViewportProps) {
  return (
    <div className="md:col-span-3 h-full">
      <div className="relative w-full h-[300px] lg:h-full bg-black rounded-xl overflow-hidden ring-1 ring-white/10 shadow-2xl">
        {searchProgress && <SearchingOverlay searchProgress={searchProgress} />}
        {isOptimizing && !searchProgress && <OptimizingOverlay sources={sources} />}

        {playUrl && optimizeComplete ? (
          <Suspense fallback={<div className="w-full h-full flex items-center justify-center text-muted">加载播放器...</div>}>
            <Player
              key={playUrl}
              url={playUrl}
              title={currentDetail.vod_name}
              currentTime={currentTime}
              onTimeUpdate={onTimeUpdate}
            />
          </Suspense>
        ) : !isOptimizing && optimizeComplete ? (
          <div className="w-full h-full flex items-center justify-center text-muted">选择集数开始播放</div>
        ) : null}

        {sourceSwitching && (
          <div className="absolute top-3 right-3 z-10 px-3 py-1.5 bg-black/70 backdrop-blur-sm rounded-lg flex items-center gap-2">
            <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-primary" />
            <span className="text-xs text-white/90">切换源中...</span>
          </div>
        )}
      </div>
    </div>
  );
}
