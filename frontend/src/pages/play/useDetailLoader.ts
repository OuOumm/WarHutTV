import { useCallback } from 'react';
import apiClient from '../../api/client';
import { detailCacheStore } from '../../store/detailCache';
import { favoritesStore } from '../../store/favorites';
import { historyStore } from '../../store/history';
import { getCachedConfig } from '../../store/configCache';
import { parseEpisodes, resolveResumeEpisode, episodePageIndex } from './playUtils';
import type { DetailResponse, Episode, VideoDetail } from './types';
import type { PlayControllerDeps } from './playContext';

/**
 * Is `site` a key that no longer exists in the configured source list?
 *
 * The old check was `/^\d+$/.test(site)`, which assumed a source key is an
 * upstream-supplied numeric id and therefore flagged every legitimate numeric
 * key as "expired history". The truth lives in `api_site`; when the config is
 * not available (signed out, where `api_site` is withheld) we cannot tell, so
 * we let the request through and surface the backend's own error instead of
 * inventing a fake detail payload.
 */
function isUnknownSite(site: string | undefined): boolean {
  if (!site) return false;
  const apiSite = getCachedConfig()?.api_site;
  if (!apiSite || Object.keys(apiSite).length === 0) return false;
  return !(site in apiSite);
}

/**
 * Loads the video detail for the current `:site/:id`, hydrates favorites +
 * resume progress + history, then kicks off source optimization exactly once.
 */
export function useDetailLoader(deps: PlayControllerDeps, startOptimize: (title: string, episodes: Episode[]) => Promise<void>) {
  const { dispatch, site, id, toast, optimizeStarted } = deps;

  const loadDetail = useCallback(async () => {
    dispatch({
      type: 'patch',
      payload: { loading: true, isOptimizing: true, optimizeComplete: false, playUrl: '' },
    });

    if (isUnknownSite(site)) {
      dispatch({
        type: 'patch',
        payload: {
          loading: false,
          isOptimizing: false,
          detail: {
            vod_id: id || '',
            vod_name: '播放源不存在',
            vod_pic: '',
            vod_content: '该播放源已从配置中移除，请返回搜索页重新选择来源。',
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

      // Preserve any existing continue-watching record (episode + progress) so
      // re-entering the page never wipes the stored resume position.
      const existing = site && id ? await historyStore.get(site, id) : undefined;
      const targetEp = resolveResumeEpisode(epList, existing?.episode ?? null, existing?.episodeIndex ?? null);

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

      // NOTE: We intentionally do NOT write a history record here. Recording on
      // page open would push a progress-0 entry to the top of "继续观看" the
      // moment a user taps a card and backs out. The resume record is created
      // by a previous session (and persisted) and updated live by
      // `usePlaybackProgress.tick` (with fresh watchedAt + episodeIndex,
      // throttled to ~3s plus an immediate flush on pause/ended/hide) once real
      // playback time accrues.

      if (!optimizeStarted.current) {
        optimizeStarted.current = true;
        await startOptimize(videoDetail.vod_name, epList);
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
  }, [site, id, startOptimize, toast, dispatch, optimizeStarted, deps.episodesPerPage]);

  return { loadDetail };
}
