import { useCallback, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import apiClient from '../../api/client';
import { streamSearchResults } from '../../api/searchStream';
import { detailCacheStore } from '../../store/detailCache';
import { favoritesStore } from '../../store/favorites';
import { historyStore } from '../../store/history';
import type { VideoDetail } from '../../types';
import { filterYellowItems, isExactMatch } from '../../utils/filter';
import { applyHistoryProgress, getPlayableUrl, parseEpisodes, parseSpeed } from './playUtils';
import { usePlayReducer } from './usePlayReducer';
import { getCachedDetail } from './playApi';
import { useToast } from '../../components/ToastProvider';
import type {
  DetailResponse,
  Episode,
  SearchSiteData,
  SourceItem,
  SpeedTestResultWithDetail,
} from './types';

const EPISODES_PER_PAGE = 50;

export function usePlayController() {
  const { site, id } = useParams<{ site: string; id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { state, dispatch } = usePlayReducer();

  // Mirror the latest reducer state for use inside async callbacks without
  // stale-closure bugs (the former code relied on functional setState updates).
  const stateRef = useRef(state);
  stateRef.current = state;

  const optimizeStarted = useRef(false);
  const searchAbortRef = useRef<AbortController | null>(null);
  const playRequestId = useRef(0);
  const switchRequestId = useRef(0);
  const sourceListRef = useRef<HTMLDivElement>(null);

  const setCurrentTime = useCallback(
    (time: number) => dispatch({ type: 'patch', payload: { currentTime: time } }),
    [dispatch],
  );

  // Scroll the active source into view when the selection or list changes.
  useEffect(() => {
    if (!sourceListRef.current) return;
    const active = sourceListRef.current.querySelector('[data-active="true"]');
    if (!active) return;

    const container = sourceListRef.current;
    const elRect = active.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    const offset =
      elRect.top - containerRect.top - containerRect.height / 2 + elRect.height / 2;
    container.scrollBy({ top: offset, behavior: 'smooth' });
  }, [state.currentSource, state.sources]);

  // SSE search with abort + 30s timeout, caching results in sessionStorage.
  const streamSearch = useCallback(
    (wd: string): Promise<SearchSiteData[]> => {
      return new Promise((resolve) => {
        searchAbortRef.current?.abort();
        const controller = new AbortController();
        searchAbortRef.current = controller;
        const allResults: SearchSiteData[] = [];
        let settled = false;
        let timeoutId: ReturnType<typeof setTimeout>;

        const finish = () => {
          if (settled) return;
          settled = true;
          clearTimeout(timeoutId);
          searchAbortRef.current = null;
          resolve(allResults);
        };

        timeoutId = setTimeout(() => {
          console.warn('Play: search timeout, resolving with partial results');
          controller.abort();
          finish();
        }, 30000);

        streamSearchResults<SearchSiteData>(
          wd,
          {
            onStart: (data) =>
              dispatch({
                type: 'patch',
                payload: { searchProgress: { completed: 0, total: data.site_count, currentSite: '' } },
              }),
            onResult: (data) => {
              const siteResult = data.data;
              if (siteResult) allResults.push(siteResult);
              dispatch({
                type: 'patch',
                payload: {
                  searchProgress: {
                    completed: data.completed,
                    total: data.total,
                    currentSite: data.name,
                  },
                },
              });
            },
            onDone: () => {
              try {
                sessionStorage.setItem(`search_results:${wd}`, JSON.stringify(allResults));
              } catch (err) {
                console.warn('Play: failed to cache search results', err);
              }
              finish();
            },
            onTimeout: finish,
          },
          { signal: controller.signal },
        ).catch((err: unknown) => {
          if (!controller.signal.aborted) {
            console.warn('Play: stream search failed', err);
          }
          finish();
        });
      });
    },
    [dispatch],
  );

  const startOptimize = useCallback(
    async (title: string, initialEpisodes: Episode[], baseVodId: string | number) => {
      dispatch({
        type: 'patch',
        payload: { sourceLoading: true, searchProgress: { completed: 0, total: 0, currentSite: '' } },
      });

      try {
        let data: SearchSiteData[] | null = null;
        try {
          const cached = sessionStorage.getItem(`search_results:${title}`);
          if (cached) data = JSON.parse(cached) as SearchSiteData[];
        } catch (err) {
          console.warn('Play: failed to parse sessionStorage cache', err);
        }

        if (!data) data = await streamSearch(title);

        const playFallback = async () => {
          if (initialEpisodes.length > 0 && initialEpisodes[0].url) {
            const url = await getPlayableUrl(initialEpisodes[0].url, site);
            dispatch({ type: 'patch', payload: { playUrl: url } });
          }
          await applyHistoryProgress(setCurrentTime, toast, site || '', baseVodId, initialEpisodes[0]?.name);
        };

        if (!data || !Array.isArray(data) || data.length === 0) {
          await playFallback();
          dispatch({ type: 'patch', payload: { optimizeComplete: true, searchProgress: null } });
          setTimeout(() => dispatch({ type: 'patch', payload: { isOptimizing: false } }), 500);
          return;
        }

        const sourceList: SourceItem[] = [];
        data.forEach((item) => {
          if (item?.list && item.list.length > 0) {
            let filteredList = filterYellowItems(item.list);
            filteredList = filteredList.filter((entry) => isExactMatch(entry.vod_name || '', title));
            if (filteredList.length === 0) return;

            const firstItem = filteredList[0];
            sourceList.push({
              key: item.site_key,
              name: firstItem.source_name || item.name || item.site_key,
              poster: firstItem.vod_pic,
              episodeCount: filteredList.length,
              speed: null,
              status: 'pending' as const,
              vodId: firstItem.vod_id,
            });
          }
        });

        if (sourceList.length === 0) {
          await playFallback();
          dispatch({ type: 'patch', payload: { optimizeComplete: true, searchProgress: null } });
          setTimeout(() => dispatch({ type: 'patch', payload: { isOptimizing: false } }), 500);
          return;
        }

        dispatch({
          type: 'patch',
          payload: { sources: sourceList, searchDataCache: data, sourceLoading: false, searchProgress: null },
        });

        if (sourceList.length === 1) {
          const onlySource = sourceList[0];
          const siteData = data.find((item) => item.site_key === onlySource.key);
          if (siteData?.list && siteData.list.length > 0) {
            const onlyDetail = await getCachedDetail(onlySource.key, onlySource.vodId);
            if (onlyDetail) {
              const epList = onlyDetail.vod_play_url ? parseEpisodes(onlyDetail.vod_play_url) : [];
              const url = epList.length > 0 ? await getPlayableUrl(epList[0].url, onlySource.key) : '';
              dispatch({
                type: 'applySource',
                source: {
                  key: onlySource.key,
                  detail: onlyDetail,
                  episodes: epList,
                  playUrl: url,
                  historyVodId: onlyDetail.vod_id,
                },
              });
              await historyStore.updateSource(baseVodId, onlySource.key, onlyDetail.vod_id);
              await applyHistoryProgress(setCurrentTime, toast, onlySource.key, onlyDetail.vod_id, '');
            }
          }
          dispatch({ type: 'patch', payload: { optimizeComplete: true, searchProgress: null } });
          setTimeout(() => dispatch({ type: 'patch', payload: { isOptimizing: false } }), 500);
          return;
        }

        const testPromises = sourceList.map(async (source, index) => {
          dispatch({ type: 'setSourceStatus', index, status: 'testing' });

          try {
            const siteData = data!.find((item) => item.site_key === source.key);
            if (siteData?.list && siteData.list.length > 0) {
              const vodDetail = await getCachedDetail(source.key, source.vodId);
              const epUrl = vodDetail?.vod_play_url?.split('#')[0]?.split('$')[1];
              if (epUrl && epUrl.includes('.m3u8')) {
                const { testVideoSpeed } = await import('../../utils/speedtest');
                const result = await testVideoSpeed(epUrl);
                dispatch({ type: 'setSourceStatus', index, status: 'done', speed: result });
                return { source, result, vodDetail } as SpeedTestResultWithDetail;
              }
            }
            dispatch({ type: 'setSourceStatus', index, status: 'done' });
          } catch (err) {
            console.warn(`Play: speed test failed for source ${source.key}`, err);
            dispatch({ type: 'setSourceStatus', index, status: 'error' });
          }
          return null;
        });

        const results = await Promise.allSettled(testPromises);
        const validResults: SpeedTestResultWithDetail[] = [];
        for (const result of results) {
          if (result.status === 'fulfilled' && result.value !== null) {
            validResults.push(result.value);
          }
        }

        const applyPicked = async (picked: { key: string; detail: VideoDetail }) => {
          const epList = picked.detail.vod_play_url ? parseEpisodes(picked.detail.vod_play_url) : [];
          const url = epList.length > 0 ? await getPlayableUrl(epList[0].url, picked.key) : '';
          dispatch({
            type: 'applySource',
            source: {
              key: picked.key,
              detail: picked.detail,
              episodes: epList,
              playUrl: url,
              historyVodId: picked.detail.vod_id,
            },
          });
          await historyStore.updateSource(baseVodId, picked.key, picked.detail.vod_id);
          await applyHistoryProgress(setCurrentTime, toast, picked.key, picked.detail.vod_id, '');
        };

        if (validResults.length > 0) {
          validResults.sort((a, b) => parseSpeed(b.result.loadSpeed) - parseSpeed(a.result.loadSpeed));
          const best = validResults[0];
          toast(`已选择最佳源: ${best.source.name} (${best.result.loadSpeed})`);
          if (best.vodDetail) await applyPicked({ key: best.source.key, detail: best.vodDetail });
        } else if (sourceList.length > 0) {
          const firstSource = sourceList[0];
          toast(`测速失败，使用默认源: ${firstSource.name}`);
          const siteData = data.find((item) => item.site_key === firstSource.key);
          if (siteData?.list && siteData.list.length > 0) {
            const detail = await getCachedDetail(firstSource.key, firstSource.vodId);
            if (detail) await applyPicked({ key: firstSource.key, detail });
          }
        } else {
          await playFallback();
        }
      } catch (err) {
        console.error('优选失败:', err);
        if (initialEpisodes.length > 0 && initialEpisodes[0].url) {
          const url = await getPlayableUrl(initialEpisodes[0].url, site);
          dispatch({ type: 'patch', payload: { playUrl: url } });
        }
        await applyHistoryProgress(setCurrentTime, toast, site || '', baseVodId, initialEpisodes[0]?.name);
      } finally {
        dispatch({
          type: 'patch',
          payload: { sourceLoading: false, optimizeComplete: true, searchProgress: null },
        });
        setTimeout(() => dispatch({ type: 'patch', payload: { isOptimizing: false } }), 800);
      }
    },
    [site, toast, setCurrentTime, streamSearch],
  );

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

      dispatch({
        type: 'patch',
        payload: {
          detail: videoDetail,
          currentSource: site || '',
          episodes: epList,
          currentEpisode: epList.length > 0 ? epList[0] : null,
        },
      });

      const fav = await favoritesStore.isFavorite(id!);
      dispatch({ type: 'patch', payload: { isFavorite: fav } });

      const firstEpName = epList.length > 0 ? epList[0].name : undefined;
      const savedRecord = await historyStore.getByContext(site || '', id!, firstEpName);
      const savedProgress = savedRecord?.progress && savedRecord.progress > 0 ? savedRecord.progress : 0;
      if (savedProgress > 0) {
        setCurrentTime(savedProgress);
        const minutes = Math.floor(savedProgress / 60);
        const seconds = Math.floor(savedProgress % 60);
        toast(`已从 ${minutes}:${seconds.toString().padStart(2, '0')} 继续播放`);
      }

      await historyStore.add({ ...videoDetail, vod_id: id!, site_key: site }, firstEpName);
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
  }, [site, id, startOptimize, toast, setCurrentTime]);

  useEffect(() => {
    if (site && id) {
      optimizeStarted.current = false;
      loadDetail();
    }

    return () => {
      searchAbortRef.current?.abort();
      searchAbortRef.current = null;
    };
  }, [site, id, loadDetail]);

  const handleSourceSwitch = useCallback(
    async (sourceKey: string) => {
      const currentSource = stateRef.current.currentSource;
      if (sourceKey === currentSource) return;
      const requestId = ++switchRequestId.current;
      dispatch({ type: 'patch', payload: { currentSource: sourceKey, sourceSwitching: true } });
      try {
        let siteData: SearchSiteData | undefined;
        const searchDataCache = stateRef.current.searchDataCache;
        if (searchDataCache && Array.isArray(searchDataCache)) {
          siteData = searchDataCache.find((item) => item.site_key === sourceKey);
        }
        if (!siteData) {
          const freshData = await streamSearch(stateRef.current.detail?.vod_name || '');
          if (requestId !== switchRequestId.current) return;
          if (freshData) {
            dispatch({ type: 'patch', payload: { searchDataCache: freshData } });
            siteData = freshData.find((item) => item.site_key === sourceKey);
          }
        }
        if (siteData?.list && siteData.list.length > 0) {
          const filteredList = filterYellowItems(siteData.list);
          if (requestId !== switchRequestId.current) return;
          if (filteredList.length === 0) return;
          const item = filteredList[0];
          const newDetail = await getCachedDetail(sourceKey, item.vod_id);
          if (requestId !== switchRequestId.current) return;
          if (newDetail) {
            const epList = newDetail.vod_play_url ? parseEpisodes(newDetail.vod_play_url) : [];
            const url = epList.length > 0 ? await getPlayableUrl(epList[0].url, sourceKey) : '';
            if (requestId !== switchRequestId.current) return;
            dispatch({
              type: 'applySource',
              source: {
                key: sourceKey,
                detail: newDetail,
                episodes: epList,
                playUrl: url,
                historyVodId: item.vod_id,
              },
              activeTab: 'episodes',
            });
            await historyStore.updateSource(stateRef.current.historyVodId, sourceKey, item.vod_id);
            await applyHistoryProgress(setCurrentTime, toast, sourceKey, item.vod_id, '');
          }
        }
      } catch (err) {
        console.error('切换源失败:', err);
      } finally {
        dispatch({ type: 'patch', payload: { sourceSwitching: false } });
      }
    },
    [dispatch, streamSearch, setCurrentTime, toast],
  );

  const handleEpisodeClick = useCallback(
    (ep: Episode) => {
      const currentSource = stateRef.current.currentSource;
      dispatch({ type: 'patch', payload: { currentEpisode: ep, currentTime: 0 } });
      const requestId = ++playRequestId.current;
      if (ep.url) {
        getPlayableUrl(ep.url, currentSource).then((url) => {
          if (requestId !== playRequestId.current) return;
          dispatch({ type: 'patch', payload: { playUrl: url } });
        });
        return;
      }

      apiClient
        .get('/play', { params: { site: currentSource, ids: id, episode: ep.name } })
        .then((res) => {
          if (res.data?.url) {
            getPlayableUrl(res.data.url, currentSource).then((url) => {
              if (requestId !== playRequestId.current) return;
              dispatch({ type: 'patch', payload: { playUrl: url } });
            });
          }
        })
        .catch(console.error);
    },
    [id, dispatch],
  );

  const handleTimeUpdate = useCallback(
    (time: number) => {
      dispatch({ type: 'patch', payload: { currentTime: time } });
      const st = stateRef.current;
      if (!st.historyVodId) return;
      historyStore.updateProgressByContext(st.currentSource, st.historyVodId, st.currentEpisode?.name, time, 0);
    },
    [dispatch],
  );

  const toggleFavorite = useCallback(async () => {
    const detail = stateRef.current.detail;
    if (!detail) return;
    const result = await favoritesStore.toggle(detail);
    dispatch({ type: 'patch', payload: { isFavorite: result } });
  }, [dispatch]);

  const clearInvalidHistory = useCallback(async () => {
    await historyStore.clear();
    navigate('/');
  }, [navigate]);

  return {
    activeTab: state.activeTab,
    clearInvalidHistory,
    currentDetail:
      state.detail || { vod_id: id || '', vod_name: '', vod_pic: '', vod_play_url: '' } satisfies VideoDetail,
    currentEpisode: state.currentEpisode,
    currentTime: state.currentTime,
    detail: state.detail,
    episodePage: state.episodePage,
    episodes: state.episodes,
    episodesPerPage: EPISODES_PER_PAGE,
    handleEpisodeClick,
    handleSourceSwitch,
    handleTimeUpdate,
    historyVodId: state.historyVodId,
    isFavorite: state.isFavorite,
    isOptimizing: state.isOptimizing,
    loading: state.loading,
    optimizeComplete: state.optimizeComplete,
    playUrl: state.playUrl,
    searchProgress: state.searchProgress,
    setActiveTab: (tab: 'episodes' | 'sources') =>
      dispatch({ type: 'patch', payload: { activeTab: tab } }),
    setEpisodePage: (page: number) => dispatch({ type: 'patch', payload: { episodePage: page } }),
    sourceListRef,
    sourceLoading: state.sourceLoading,
    sourceSwitching: state.sourceSwitching,
    sources: state.sources,
    currentSource: state.currentSource,
    site,
    toggleFavorite,
  };
}
