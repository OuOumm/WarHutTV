import { useCallback } from 'react';
import { getPlayableUrl, parseEpisodes, applyHistoryProgress } from './playUtils';
import { getCachedDetail } from './playApi';
import { filterYellowItems } from '../../utils/filter';
import { historyStore } from '../../store/history';
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
      const requestId = ++deps.switchRequestId.current;
      dispatch({ type: 'patch', payload: { currentSource: sourceKey, sourceSwitching: true } });
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
        if (siteData?.list && siteData.list.length > 0) {
          const filteredList = filterYellowItems(siteData.list);
          if (requestId !== deps.switchRequestId.current) return;
          if (filteredList.length === 0) return;
          const item = filteredList[0];
          const newDetail = await getCachedDetail(sourceKey, item.vod_id);
          if (requestId !== deps.switchRequestId.current) return;
          if (newDetail) {
            const epList = newDetail.vod_play_url ? parseEpisodes(newDetail.vod_play_url) : [];
            const url = epList.length > 0 ? await getPlayableUrl(epList[0].url, sourceKey) : '';
            if (requestId !== deps.switchRequestId.current) return;
            dispatch({
              type: 'applySource',
              source: {
                key: sourceKey,
                detail: newDetail as VideoDetail,
                episodes: epList,
                playUrl: url,
                historyVodId: stateRef.current.historyVodId,
              },
              activeTab: 'episodes',
            });
            await historyStore.updateSource(stateRef.current.historyVodId);
            await applyHistoryProgress(setCurrentTime, toast, sourceKey, item.vod_id, '');
          }
        }
      } catch (err) {
        console.error('切换源失败:', err);
      } finally {
        dispatch({ type: 'patch', payload: { sourceSwitching: false } });
      }
    },
    [dispatch, streamSearch, setCurrentTime, toast, stateRef, deps.switchRequestId],
  );

  return { handleSourceSwitch };
}
