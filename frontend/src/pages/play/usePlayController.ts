import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import apiClient from '../../api/client';
import { streamSearchResults } from '../../api/searchStream';
import { detailCacheStore } from '../../store/detailCache';
import { favoritesStore } from '../../store/favorites';
import { historyStore } from '../../store/history';
import type { VideoDetail } from '../../types';
import { filterYellowItems, isExactMatch } from '../../utils/filter';
import { applyHistoryProgress, getPlayableUrl, parseEpisodes, parseSpeed } from './playUtils';
import type {
  DetailResponse,
  Episode,
  SearchProgress,
  SearchSiteData,
  SourceItem,
  SpeedTestResultWithDetail,
} from './types';

const EPISODES_PER_PAGE = 50;

export function usePlayController() {
  const { site, id } = useParams<{ site: string; id: string }>();
  const [detail, setDetail] = useState<VideoDetail | null>(null);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [currentEpisode, setCurrentEpisode] = useState<Episode | null>(null);
  const [playUrl, setPlayUrl] = useState('');
  const [isFavorite, setIsFavorite] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sourceSwitching, setSourceSwitching] = useState(false);
  const [activeTab, setActiveTab] = useState<'episodes' | 'sources'>('episodes');
  const [sources, setSources] = useState<SourceItem[]>([]);
  const [currentSource, setCurrentSource] = useState('');
  const [sourceLoading, setSourceLoading] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [searchDataCache, setSearchDataCache] = useState<SearchSiteData[] | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [toast, setToast] = useState('');
  const [historyVodId, setHistoryVodId] = useState<string | number>('');
  const [optimizeComplete, setOptimizeComplete] = useState(false);
  const [episodePage, setEpisodePage] = useState(0);
  const [searchProgress, setSearchProgress] = useState<SearchProgress | null>(null);
  const optimizeStarted = useRef(false);
  const searchAbortRef = useRef<AbortController | null>(null);
  const playRequestId = useRef(0);
  const switchRequestId = useRef(0);
  const sourceListRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!sourceListRef.current) return;
    const active = sourceListRef.current.querySelector('[data-active="true"]');
    if (!active) return;

    const container = sourceListRef.current;
    const elRect = active.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    const offset = elRect.top - containerRect.top - (containerRect.height / 2) + (elRect.height / 2);
    container.scrollBy({ top: offset, behavior: 'smooth' });
  }, [currentSource, sources]);

  useEffect(() => {
    if (site && id) {
      optimizeStarted.current = false;
      loadDetail();
    }

    return () => {
      searchAbortRef.current?.abort();
      searchAbortRef.current = null;
    };
  }, [site, id]);

  async function loadDetail() {
    setLoading(true);
    setIsOptimizing(true);
    setOptimizeComplete(false);
    setPlayUrl('');

    if (site && /^\d+$/.test(site)) {
      setToast('');
      setLoading(false);
      setIsOptimizing(false);
      setDetail({
        vod_id: id || '',
        vod_name: '播放源无效',
        vod_pic: '',
        vod_content: '历史记录中的播放源已失效，请清空历史记录后重新搜索。',
        vod_play_url: '',
      } satisfies VideoDetail);
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
      setDetail(videoDetail);
      setCurrentSource(site || '');

      let epList: Episode[] = [];
      if (videoDetail.vod_play_url) {
        epList = parseEpisodes(videoDetail.vod_play_url);
        setEpisodes(epList);
        if (epList.length > 0) {
          setCurrentEpisode(epList[0]);
        }
      }

      const fav = await favoritesStore.isFavorite(id!);
      setIsFavorite(fav);

      const firstEpName = epList.length > 0 ? epList[0].name : undefined;
      const savedRecord = await historyStore.getByContext(site || '', id!, firstEpName);
      const savedProgress = savedRecord?.progress && savedRecord.progress > 0 ? savedRecord.progress : 0;
      if (savedProgress > 0) {
        setCurrentTime(savedProgress);
        const minutes = Math.floor(savedProgress / 60);
        const seconds = Math.floor(savedProgress % 60);
        setToast(`已从 ${minutes}:${seconds.toString().padStart(2, '0')} 继续播放`);
        setTimeout(() => setToast(''), 3000);
      }

      await historyStore.add({ ...videoDetail, vod_id: id!, site_key: site }, firstEpName);
      setHistoryVodId(id!);

      if (!optimizeStarted.current) {
        optimizeStarted.current = true;
        await startOptimize(videoDetail.vod_name, epList, id!);
      }
    } catch (err) {
      const error = err as { response?: { data?: { error?: string } }; message?: string };
      console.error('加载详情失败:', error);
      setIsOptimizing(false);
      const errorMsg = error.response?.data?.error || error.message || '加载失败';
      setToast(errorMsg);
      setTimeout(() => setToast(''), 5000);
    } finally {
      setLoading(false);
    }
  }

  const startOptimize = async (title: string, initialEpisodes: Episode[], baseVodId: string | number) => {
    setSourceLoading(true);
    setSearchProgress({ completed: 0, total: 0, currentSite: '' });

    try {
      let data: SearchSiteData[] | null = null;
      try {
        const cached = sessionStorage.getItem(`search_results:${title}`);
        if (cached) {
          data = JSON.parse(cached) as SearchSiteData[];
        }
      } catch (err) {
        console.warn('Play: failed to parse sessionStorage cache', err);
      }

      if (!data) {
        data = await streamSearch(title);
      }

      if (!data || !Array.isArray(data) || data.length === 0) {
        if (initialEpisodes.length > 0 && initialEpisodes[0].url) {
          const url = await getPlayableUrl(initialEpisodes[0].url, site);
          setPlayUrl(url);
        }
        setOptimizeComplete(true);
        setSearchProgress(null);
        await applyHistoryProgress(setCurrentTime, setToast, site || '', baseVodId, initialEpisodes[0]?.name);
        setTimeout(() => setIsOptimizing(false), 500);
        return;
      }

      const sourceList: SourceItem[] = [];
      data.forEach((item) => {
        if (item?.list && item.list.length > 0) {
          let filteredList = filterYellowItems(item.list);
          filteredList = filteredList.filter((item) => isExactMatch(item.vod_name || '', title));
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
        if (initialEpisodes.length > 0 && initialEpisodes[0].url) {
          const url = await getPlayableUrl(initialEpisodes[0].url, site);
          setPlayUrl(url);
        }
        setOptimizeComplete(true);
        setSearchProgress(null);
        await applyHistoryProgress(setCurrentTime, setToast, site || '', baseVodId, initialEpisodes[0]?.name);
        setTimeout(() => setIsOptimizing(false), 500);
        return;
      }

      setSources(sourceList);
      setSearchDataCache(data);
      setSourceLoading(false);
      setSearchProgress(null);

      if (sourceList.length === 1) {
        const onlySource = sourceList[0];
        setCurrentSource(onlySource.key);
        const siteData = data.find((item) => item.site_key === onlySource.key);
        if (siteData?.list && siteData.list.length > 0) {
          const onlyDetail = await getCachedDetail(onlySource.key, onlySource.vodId);
          if (onlyDetail) {
            setDetail(onlyDetail);
            if (onlyDetail.vod_play_url) {
              const epList = parseEpisodes(onlyDetail.vod_play_url);
              if (epList.length > 0) {
                setEpisodes(epList);
                setCurrentEpisode(epList[0]);
                const url = await getPlayableUrl(epList[0].url, onlySource.key);
                setPlayUrl(url);
              }
            }
            await historyStore.updateSource(baseVodId, onlySource.key, onlyDetail.vod_id);
            setHistoryVodId(onlyDetail.vod_id);
            await applyHistoryProgress(setCurrentTime, setToast, onlySource.key, onlyDetail.vod_id, '');
          }
        }
        setOptimizeComplete(true);
        setSearchProgress(null);
        setTimeout(() => setIsOptimizing(false), 500);
        return;
      }

      const testPromises = sourceList.map(async (source, index) => {
        setSources(prev => prev.map((item, itemIndex) => itemIndex === index ? { ...item, status: 'testing' as const } : item));

        try {
          const siteData = data!.find((item) => item.site_key === source.key);
          if (siteData?.list && siteData.list.length > 0) {
            const vodDetail = await getCachedDetail(source.key, source.vodId);
            const epUrl = vodDetail?.vod_play_url?.split('#')[0]?.split('$')[1];
            if (epUrl && epUrl.includes('.m3u8')) {
              const { testVideoSpeed } = await import('../../utils/speedtest');
              const result = await testVideoSpeed(epUrl);
              setSources(prev => prev.map((item, itemIndex) => itemIndex === index ? { ...item, speed: result, status: 'done' as const } : item));
              return { source, result, vodDetail } as SpeedTestResultWithDetail;
            }
          }
          setSources(prev => prev.map((item, itemIndex) => itemIndex === index ? { ...item, status: 'done' as const } : item));
        } catch (err) {
          console.warn(`Play: speed test failed for source ${source.key}`, err);
          setSources(prev => prev.map((item, itemIndex) => itemIndex === index ? { ...item, status: 'error' as const } : item));
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

      if (validResults.length > 0) {
        validResults.sort((a, b) => parseSpeed(b.result.loadSpeed) - parseSpeed(a.result.loadSpeed));

        const bestSource = validResults[0].source;
        const bestResult = validResults[0].result;
        const bestDetail = validResults[0].vodDetail;

        setToast(`已选择最佳源: ${bestSource.name} (${bestResult.loadSpeed})`);
        setTimeout(() => setToast(''), 3000);

        setCurrentSource(bestSource.key);
        if (bestDetail) {
          setDetail(bestDetail);
          if (bestDetail.vod_play_url) {
            const epList = parseEpisodes(bestDetail.vod_play_url);
            setEpisodes(epList);
            if (epList.length > 0) {
              setCurrentEpisode(epList[0]);
              const url = await getPlayableUrl(epList[0].url, bestSource.key);
              setPlayUrl(url);
            }
          }
          await historyStore.updateSource(baseVodId, bestSource.key, bestDetail.vod_id);
          setHistoryVodId(bestDetail.vod_id);
          await applyHistoryProgress(setCurrentTime, setToast, bestSource.key, bestDetail.vod_id, '');
        }
      } else if (sourceList.length > 0) {
        const firstSource = sourceList[0];
        setToast(`测速失败，使用默认源: ${firstSource.name}`);
        setTimeout(() => setToast(''), 3000);

        setCurrentSource(firstSource.key);
        const siteData = data.find((item) => item.site_key === firstSource.key);
        if (siteData?.list && siteData.list.length > 0) {
          const detail = await getCachedDetail(firstSource.key, firstSource.vodId);
          if (detail) {
            setDetail(detail);
            if (detail.vod_play_url) {
              const epList = parseEpisodes(detail.vod_play_url);
              setEpisodes(epList);
              if (epList.length > 0) {
                setCurrentEpisode(epList[0]);
                const url = await getPlayableUrl(epList[0].url, firstSource.key);
                setPlayUrl(url);
              }
            }
            await historyStore.updateSource(baseVodId, firstSource.key, detail.vod_id);
            setHistoryVodId(detail.vod_id);
            await applyHistoryProgress(setCurrentTime, setToast, firstSource.key, detail.vod_id, '');
          }
        }
      } else {
        if (initialEpisodes.length > 0 && initialEpisodes[0].url) {
          const url = await getPlayableUrl(initialEpisodes[0].url, site);
          setPlayUrl(url);
        }
        await applyHistoryProgress(setCurrentTime, setToast, site || '', baseVodId, initialEpisodes[0]?.name);
      }
    } catch (err) {
      console.error('优选失败:', err);
      if (initialEpisodes.length > 0 && initialEpisodes[0].url) {
        const url = await getPlayableUrl(initialEpisodes[0].url, site);
        setPlayUrl(url);
      }
      await applyHistoryProgress(setCurrentTime, setToast, site || '', baseVodId, initialEpisodes[0]?.name);
    } finally {
      setSourceLoading(false);
      setOptimizeComplete(true);
      setSearchProgress(null);
      setTimeout(() => setIsOptimizing(false), 800);
    }
  };

  const streamSearch = (wd: string): Promise<SearchSiteData[]> => {
    return new Promise((resolve) => {
      searchAbortRef.current?.abort();
      const controller = new AbortController();
      searchAbortRef.current = controller;
      const allResults: SearchSiteData[] = [];
      let settled = false;

      const finish = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timeoutId);
        searchAbortRef.current = null;
        resolve(allResults);
      };

      const timeoutId = setTimeout(() => {
        console.warn('Play: search timeout, resolving with partial results');
        controller.abort();
        finish();
      }, 30000);

      streamSearchResults<SearchSiteData>(wd, {
        onStart: (data) => {
          setSearchProgress({ completed: 0, total: data.site_count, currentSite: '' });
        },
        onResult: (data) => {
          const siteResult = data.data;
          if (siteResult) {
            allResults.push(siteResult);
          }
          setSearchProgress({
            completed: data.completed,
            total: data.total,
            currentSite: data.name,
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
      }, { signal: controller.signal }).catch((err: unknown) => {
        if (!controller.signal.aborted) {
          console.warn('Play: stream search failed', err);
        }
        finish();
      });
    });
  };

  const getCachedDetail = async (sourceKey: string, vodId: string | number): Promise<VideoDetail | undefined> => {
    const cacheKey = `${sourceKey}:${vodId}`;
    const cached = await detailCacheStore.get<DetailResponse>(cacheKey);
    if (cached) return cached?.list?.[0] as VideoDetail | undefined;
    const res = await apiClient.get<DetailResponse>('/detail', { params: { site: sourceKey, ids: vodId } });
    const data = res.data?.list?.[0] as VideoDetail | undefined;
    if (res.data) await detailCacheStore.set(cacheKey, res.data);
    return data;
  };

  const handleSourceSwitch = useCallback(async (sourceKey: string) => {
    if (sourceKey === currentSource) return;
    const requestId = ++switchRequestId.current;
    setCurrentSource(sourceKey);
    setSourceSwitching(true);
    try {
      let siteData: SearchSiteData | undefined;
      if (searchDataCache && Array.isArray(searchDataCache)) {
        siteData = searchDataCache.find((item) => item.site_key === sourceKey);
      }
      if (!siteData) {
        const freshData = await streamSearch(detail?.vod_name || '');
        if (requestId !== switchRequestId.current) return;
        if (freshData) {
          setSearchDataCache(freshData);
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
          setDetail(newDetail);
          if (newDetail.vod_play_url) {
            const epList = parseEpisodes(newDetail.vod_play_url);
            setEpisodes(epList);
            if (epList.length > 0) {
              setCurrentEpisode(epList[0]);
              const url = await getPlayableUrl(epList[0].url, sourceKey);
              if (requestId !== switchRequestId.current) return;
              setPlayUrl(url);
            }
          }
          setActiveTab('episodes');
          await historyStore.updateSource(historyVodId, sourceKey, item.vod_id);
          setHistoryVodId(item.vod_id);
          await applyHistoryProgress(setCurrentTime, setToast, sourceKey, item.vod_id, '');
        }
      }
    } catch (err) {
      console.error('切换源失败:', err);
    } finally {
      setSourceSwitching(false);
    }
  }, [currentSource, detail?.vod_name, historyVodId, searchDataCache]);

  const handleEpisodeClick = useCallback((ep: Episode) => {
    setCurrentEpisode(ep);
    setCurrentTime(0);
    const requestId = ++playRequestId.current;
    if (ep.url) {
      getPlayableUrl(ep.url, currentSource).then(url => {
        if (requestId !== playRequestId.current) return;
        setPlayUrl(url);
      });
      return;
    }

    apiClient.get('/play', { params: { site: currentSource, ids: id, episode: ep.name } })
      .then((res) => {
        if (res.data?.url) {
          getPlayableUrl(res.data.url, currentSource).then(url => {
            if (requestId !== playRequestId.current) return;
            setPlayUrl(url);
          });
        }
      }).catch(console.error);
  }, [currentSource, id]);

  const toggleFavorite = useCallback(async () => {
    if (!detail) return;
    const result = await favoritesStore.toggle(detail);
    setIsFavorite(result);
  }, [detail]);

  const handleTimeUpdate = useCallback((time: number) => {
    setCurrentTime(time);
    if (!historyVodId) return;
    historyStore.updateProgressByContext(
      currentSource,
      historyVodId,
      currentEpisode?.name,
      time,
      0,
    );
  }, [currentEpisode?.name, currentSource, historyVodId]);

  const clearInvalidHistory = useCallback(async () => {
    await historyStore.clear();
    window.location.href = '/';
  }, []);

  const currentDetail = detail || { vod_id: id || '', vod_name: '', vod_pic: '', vod_play_url: '' } satisfies VideoDetail;

  return {
    activeTab,
    clearInvalidHistory,
    currentDetail,
    currentEpisode,
    currentSource,
    currentTime,
    detail,
    episodePage,
    episodes,
    episodesPerPage: EPISODES_PER_PAGE,
    handleEpisodeClick,
    handleSourceSwitch,
    handleTimeUpdate,
    historyVodId,
    isFavorite,
    isOptimizing,
    loading,
    optimizeComplete,
    playUrl,
    searchProgress,
    setActiveTab,
    setEpisodePage,
    sourceListRef,
    sourceLoading,
    sourceSwitching,
    sources,
    site,
    toast,
    toggleFavorite,
  };
}
