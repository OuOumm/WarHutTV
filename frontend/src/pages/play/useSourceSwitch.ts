import { useCallback } from 'react';
import { getPlayableUrl, parseEpisodes, applyResumeProgress, episodePageIndex } from './playUtils';
import { getCachedDetail } from './playApi';
import { filterYellowItems } from '../../utils/filter';
import type { SearchSiteData, VideoDetail } from './types';
import type { PlayControllerDeps } from './playContext';

/**
 * Switch the active playback source without remounting the player.
 * Preserves request ordering via `switchRequestId` so a stale switch can't
 * clobber a newer one.
 */
export function useSourceSwitch(
  deps: PlayControllerDeps,
  streamSearch: (wd: string) => Promise<SearchSiteData[]>,
) {
  const { dispatch, stateRef, setCurrentTime, toast } = deps;

  const handleSourceSwitch = useCallback(
    async (sourceKey: string) => {
      const currentSource = stateRef.current.currentSource;
      if (sourceKey === currentSource) return;
      // Persist the old source's live position before resume lookup reads it.
      // This await is the write-before-read barrier that prevents a source switch
      // from observing stale history and incorrectly resuming at 0:00.
      await deps.progressFlush?.();
      const requestId = ++deps.switchRequestId.current;
      // Only flip the switching flag here. `currentSource` is owned by
      // `applySource` and must NOT be rewritten until the new source is
      // actually loaded — otherwise a failed switch would desync the UI
      // (shown source ≠ actually playing source).
      dispatch({ type: 'patch', payload: { sourceSwitching: true, switchStartsFromZero: false } });
      try {
        let siteData: SearchSiteData | undefined;
        const searchDataCache = stateRef.current.searchDataCache;
        if (searchDataCache && Array.isArray(searchDataCache)) {
          siteData = searchDataCache.find((item) => item.site_key === sourceKey);
        }
        if (!siteData) {
          const freshData = await streamSearch(stateRef.current.detail?.vod_name || '');
          if (requestId !== deps.switchRequestId.current) return;
          if (freshData) {
            dispatch({ type: 'patch', payload: { searchDataCache: freshData } });
            siteData = freshData.find((item) => item.site_key === sourceKey);
          }
        }
        if (!siteData?.list || siteData.list.length === 0) {
          toast('该播放源暂无可用数据', 'error');
          return;
        }
        const filteredList = filterYellowItems(siteData.list);
        if (requestId !== deps.switchRequestId.current) return;
        if (filteredList.length === 0) {
          toast('该播放源内容不可用', 'error');
          return;
        }
        const item = filteredList[0];
        const newDetail = await getCachedDetail(sourceKey, item.vod_id);
        if (requestId !== deps.switchRequestId.current) return;
        if (!newDetail) {
          toast('无法加载该播放源详情', 'error');
          return;
        }
        const epList = newDetail.vod_play_url ? parseEpisodes(newDetail.vod_play_url) : [];
        const resumeEp = await applyResumeProgress(setCurrentTime, toast, deps.site, deps.id, epList);
        const url = epList.length > 0 ? await getPlayableUrl(resumeEp?.url || epList[0].url, sourceKey) : '';
        if (requestId !== deps.switchRequestId.current) return;
        dispatch({
          type: 'applySource',
          source: {
            key: sourceKey,
            detail: newDetail as VideoDetail,
            episodes: epList,
            playUrl: url,
            currentEpisode: resumeEp,
          },
          activeTab: 'episodes',
        });
        dispatch({ type: 'patch', payload: { episodePage: episodePageIndex(epList, resumeEp, deps.episodesPerPage) } });
      } catch (err) {
        console.error('切换源失败:', err);
        toast('切换源失败', 'error');
      } finally {
        // Only the latest switch request is allowed to clear the flag, so a
        // stale (superseded) request can never flicker the UI back to idle.
        if (requestId === deps.switchRequestId.current) {
          dispatch({ type: 'patch', payload: { sourceSwitching: false } });
        }
      }
    },
    [dispatch, streamSearch, setCurrentTime, toast, stateRef, deps.switchRequestId],
  );

  return { handleSourceSwitch };
}
