import { useCallback } from 'react';
import apiClient from '../../api/client';
import { detailCacheStore } from '../../store/detailCache';
import { favoritesStore } from '../../store/favorites';
import { historyStore } from '../../store/history';
import { parseEpisodes, resolveResumeEpisode, episodePageIndex } from './playUtils';
import type { DetailResponse, Episode, VideoDetail } from './types';
import type { PlayControllerDeps } from './playContext';

/**
 * Loads the video detail for the current `:site/:id`, hydrates favorites +
 * resume progress + history, then kicks off source optimization exactly once.
 */
export function useDetailLoader(deps: PlayControllerDeps, startOptimize: (title: string, episodes: Episode[], baseVodId: string | number) => Promise<void>) {
  const { dispatch, site, id, toast, optimizeStarted } = deps;

  const loadDetail = useCallback(async () => {
    dispatch({
      type: 'patch',
      payload: { loading: true, isOptimizing: true, optimizeComplete: false, playUrl: '' },
    });

    if (site && /^\d+$/.test(site)) {
      dispatch({
        type: 'patch',
        payload: {
          loading: false,
          isOptimizing: false,
          detail: {
            vod_id: id || '',
            vod_name: '播放源无效',
            vod_pic: '',
            vod_content: '历史记录中的播放源已失效，请清空历史记录后重新搜索。',
            vod_play_url: '',
          } satisfies VideoDetail,
        },
      });
      return;
    }

    try {
      const cacheKey = `${site}:${id}`;
      let data = await detailCacheStore.get<DetailResponse>(cacheKey);
      if (!data) {
        const response = await apiClient.get<DetailResponse>('/detail', { params: { site, ids: id } });
        data = response.data;
        if (data) await detailCacheStore.set(cacheKey, data);
      }

      const detailList = data?.list || [];
      if (detailList.length === 0) return;

      const videoDetail = detailList[0];
      const epList: Episode[] = videoDetail.vod_play_url ? parseEpisodes(videoDetail.vod_play_url) : [];

      const targetEp = resolveResumeEpisode(epList, deps.initialEpisode);

      dispatch({
        type: 'patch',
        payload: {
          detail: videoDetail,
          currentSource: site || '',
          episodes: epList,
          currentEpisode: targetEp,
          episodePage: episodePageIndex(epList, targetEp, deps.episodesPerPage),
        },
      });

      const fav = await favoritesStore.isFavorite(id!);
      dispatch({ type: 'patch', payload: { isFavorite: fav } });

      await historyStore.add({ ...videoDetail, vod_id: id!, site_key: site }, targetEp?.name);
      dispatch({ type: 'patch', payload: { historyVodId: id! } });

      if (!optimizeStarted.current) {
        optimizeStarted.current = true;
        await startOptimize(videoDetail.vod_name, epList, id!);
      }
    } catch (err) {
      const error = err as { response?: { data?: { error?: string } }; message?: string };
      console.error('加载详情失败:', error);
      dispatch({ type: 'patch', payload: { isOptimizing: false } });
      const errorMsg = error.response?.data?.error || error.message || '加载失败';
      toast(errorMsg, 'error');
    } finally {
      dispatch({ type: 'patch', payload: { loading: false } });
    }
  }, [site, id, startOptimize, toast, dispatch, optimizeStarted, deps.initialEpisode, deps.episodesPerPage]);

  return { loadDetail };
}
