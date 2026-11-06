import { useCallback } from 'react';
import { PlayerViewport } from './play/PlayerViewport';
import { SourcePanel } from './play/SourcePanel';
import { usePlayController } from './play/usePlayController';
import { VideoInfo } from './play/VideoInfo';
import { useToast } from '../components/ToastProvider';

const Play = () => {
  const controller = usePlayController();
  const { toast } = useToast();

  // The player only reports unrecoverable stream failures; surfacing them as a
  // toast is what tells the user to switch sources instead of staring at a
  // spinner forever.
  const handlePlayerError = useCallback(
    (message: string) => toast(message, 'error', 5000),
    [toast],
  );

  if (controller.loading && !controller.isOptimizing) {
    return (
      <div className="flex justify-center items-center h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!controller.detail && !controller.isOptimizing) {
    return <div className="text-center text-muted py-8">未找到视频</div>;
  }

  return (
    <div>
      <div className="flex flex-col gap-4 py-4 px-3 sm:px-5 lg:px-8">
        <div className="py-1 flex flex-wrap items-center gap-x-3 gap-y-2">
          <h1 className="text-xl font-semibold text-text">
            {controller.currentDetail.vod_name}
            {controller.currentEpisode && <span className="text-lg text-muted font-normal"> - {controller.currentEpisode.name}</span>}
          </h1>
        </div>

        <div className="grid gap-4 lg:h-[500px] xl:h-[650px] grid-cols-1 md:grid-cols-4">
          <PlayerViewport
            currentDetail={controller.currentDetail}
            currentTime={controller.currentTime}
            isOptimizing={controller.isOptimizing}
            optimizeComplete={controller.optimizeComplete}
            playUrl={controller.playUrl}
            searchProgress={controller.searchProgress}
            sourceSwitching={controller.sourceSwitching}
            sources={controller.sources}
            startFromZero={controller.switchStartsFromZero}
            onTimeUpdate={controller.handleTimeUpdate}
            onFlush={controller.handleFlush}
            onNext={controller.handleNextEpisode}
            onEnded={controller.handleNextEpisode}
            onError={handlePlayerError}
            hasNext={controller.hasNextEpisode}
          />

          <SourcePanel
            activeTab={controller.activeTab}
            currentDetail={controller.currentDetail}
            currentEpisode={controller.currentEpisode}
            currentSource={controller.currentSource}
            episodePage={controller.episodePage}
            episodes={controller.episodes}
            episodesPerPage={controller.episodesPerPage}
            sourceListRef={controller.sourceListRef}
            sourceLoading={controller.sourceLoading}
            sources={controller.sources}
            watchedEpisodes={controller.watchedEpisodes}
            onActiveTabChange={controller.setActiveTab}
            onEpisodeClick={controller.handleEpisodeClick}
            onEpisodePageChange={controller.setEpisodePage}
            onSourceSwitch={controller.handleSourceSwitch}
          />
        </div>

        <VideoInfo
          currentDetail={controller.currentDetail}
          currentSource={controller.currentSource}
          isFavorite={controller.isFavorite}
          site={controller.site}
          sources={controller.sources}
          onClearInvalidHistory={controller.clearInvalidHistory}
          onToggleFavorite={controller.toggleFavorite}
        />
      </div>
    </div>
  );
};

export default Play;
