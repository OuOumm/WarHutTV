import { PlayerViewport } from './play/PlayerViewport';
import { SourcePanel } from './play/SourcePanel';
import { usePlayController } from './play/usePlayController';
import { VideoInfo } from './play/VideoInfo';

const Play = () => {
  const controller = usePlayController();

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
      {controller.toast && (
        <div
          className="fixed top-20 left-1/2 -translate-x-1/2 z-[1000] px-4 py-2 text-sm font-medium rounded-lg shadow-lg backdrop-blur-xl"
          style={{
            background: 'var(--color-primary-glow)',
            border: '1px solid var(--color-glass-border)',
            color: 'var(--color-primary)',
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.2), 0 0 12px var(--color-primary-glow)',
          }}
        >
          {controller.toast}
        </div>
      )}

      <div className="flex flex-col gap-4 py-4 px-3 sm:px-5 lg:px-8">
        <div className="py-1">
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
            onTimeUpdate={controller.handleTimeUpdate}
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
