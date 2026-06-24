import { useState, useEffect, useRef, useCallback, lazy, Suspense } from 'react';
import { useParams } from 'react-router-dom';
import apiClient from '../api/client';

// 动态导入 Player 组件 - 减少初始包大小
const Player = lazy(() => import('../components/Player'));
import type { VideoDetail, VideoItem } from '../types';
import { historyStore } from '../store/history';
import { processImageUrl } from '../utils/image';
import type { SpeedTestResult } from '../utils/speedtest';
import { SearchingOverlay } from '../components/SearchingOverlay';
import { OptimizingOverlay } from '../components/OptimizingOverlay';

interface Episode {
  name: string;
  url: string;
}

interface SourceItem {
  key: string;
  name: string;
  poster?: string;
  episodeCount?: number;
  speed?: SpeedTestResult | null;
  status: 'pending' | 'testing' | 'done' | 'error';
  vodId: string | number;
}

interface SearchSiteItem extends VideoItem {
  source_name?: string;
}

interface SearchSiteData {
  site_key: string;
  name?: string;
  list?: SearchSiteItem[];
  source_name?: string;
}

// 测速结果 with source detail
interface SpeedTestResultWithDetail {
  source: SourceItem;
  result: SpeedTestResult;
  vodDetail: VideoDetail | null;
}

// 使用 useMemo 缓存解析结果
function parseEpisodes(playUrl: string): Episode[] {
  const episodeMap = new Map<string, Episode>();
  // 处理可能由 $$$ 拼接的多源剧集数据
  playUrl.split('$$$').forEach(segment => {
    segment.split('#').filter(e => e.trim()).forEach(e => {
      const parts = e.split('$');
      const name = parts[0] || '播放';
      const newUrl = parts[1] || '';
      if (!episodeMap.has(name)) {
        // 同名保留第一次出现的剧集，避免 $$$ 拼接导致的重复
        episodeMap.set(name, { name, url: newUrl });
      } else if (newUrl.includes('.m3u8')) {
        // 后出现的剧集若为 m3u8 链接则覆盖旧的非 m3u8 链接（m3u8 画质更优）
        episodeMap.set(name, { name, url: newUrl });
      }
    });
  });
  return Array.from(episodeMap.values());
}

// SourceStatus helper — 取代重复 IIFE
function SourceStatusBadge({ source }: { source: { status: string; speed?: { loadSpeed: string; pingTime: string | number } | null } }) {
  if (source.status === 'testing') return <span className="text-primary animate-pulse">测速中...</span>;
  if (source.speed) return <span><span className="text-blue-400">{source.speed.loadSpeed}</span> <span className="text-orange-500">{source.speed.pingTime}ms</span></span>;
  return <span className="text-muted">无测速数据</span>;
}

// parseSpeed moved to module level
function parseSpeed(speedStr: string): number {
  const match = speedStr.match(/([\d.]+)\s*(KB|MB|GB)\/s/i);
  if (!match) return 0;
  const value = parseFloat(match[1]);
  const unit = match[2].toUpperCase();
  if (unit === 'GB') return value * 1024;
  if (unit === 'MB') return value;
  return value / 1024;
}

// Module-level: 无响应式依赖，纯数据处理函数
async function getPlayableUrlModule(url: string, sourceKey?: string) {
  if (!url) return url;
  if (url.includes('.m3u8')) {
    const adEnabled = localStorage.getItem('enable_blockad') !== 'false';
    if (adEnabled) {
      const { fetchAndFilterM3U8 } = await import('../utils/adblock');
      return await fetchAndFilterM3U8(url);
    }
    const encodedUrl = encodeURIComponent(url);
    return sourceKey
      ? `/api/proxy/m3u8?url=${encodedUrl}&moontv-source=${encodeURIComponent(sourceKey)}`
      : `/api/proxy/m3u8?url=${encodedUrl}`;
  }
  return url;
}

async function applyHistoryProgress(
  setCurrentTime: (t: number) => void,
  setToast: (t: string) => void,
  currentSiteKey: string,
  vodId: string | number,
  episodeName?: string
) {
  try {
    const record = await historyStore.getByContext(currentSiteKey, vodId, episodeName);
    if (record?.progress && record.progress > 0) {
      setCurrentTime(record.progress);
      const minutes = Math.floor(record.progress / 60);
      const seconds = Math.floor(record.progress % 60);
      setToast(`已从 ${minutes}:${seconds.toString().padStart(2, '0')} 继续播放`);
      setTimeout(() => setToast(''), 3000);
    }
  } catch (err) { console.warn('Play: failed to apply history progress', err); }
}

const Play = () => {
  const { site, id } = useParams<{ site: string; id: string }>();
  const [detail, setDetail] = useState<VideoDetail | null>(null);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [currentEpisode, setCurrentEpisode] = useState<Episode | null>(null);
  const [playUrl, setPlayUrl] = useState('');
  const [isFavorite, setIsFavorite] = useState(false);
  const [loading, setLoading] = useState(true); // 初始为 true，避免闪烁
  const [sourceSwitching, setSourceSwitching] = useState(false); // 源切换中，不显示全屏 loading
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
  const [searchProgress, setSearchProgress] = useState<{ completed: number; total: number; currentSite: string } | null>(null);
  const EPISODES_PER_PAGE = 50;
  const optimizeStarted = useRef(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  const playRequestId = useRef(0); // 用于异步竞态保护 (Issue 7)
  const switchRequestId = useRef(0); // 用于源切换异步竞态保护
  const sourceListRef = useRef<HTMLDivElement>(null); // 换源列表自动滚动

  // Module-level function, stable identity
  const getPlayableUrl = getPlayableUrlModule;

  // 优选完成后，尝试从历史记录读取播放进度（按 site + vodId + episode 隔离）
  // applyHistoryProgress moved to module level


  // 换源列表自动滚动到当前选中源
  useEffect(() => {
    if (!sourceListRef.current) return;
    const active = sourceListRef.current.querySelector('[data-active="true"]');
    if (active) {
      // 滚动到容器中央位置
      const container = sourceListRef.current;
      const elRect = active.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      const offset = elRect.top - containerRect.top - (containerRect.height / 2) + (elRect.height / 2);
      container.scrollBy({ top: offset, behavior: 'smooth' });
    }
  }, [currentSource, sources]);

  useEffect(() => { 
    if (site && id) {
      optimizeStarted.current = false;
      loadDetail();
    }
    
    // 组件卸载时关闭 EventSource
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [site, id]);

  async function loadDetail() {
    setLoading(true);
    setIsOptimizing(true);
    setOptimizeComplete(false);
    setPlayUrl('');
    
    // 验证 site 参数是否有效（不是纯数字）
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
      // 检查缓存
      const cacheKey = `${site}:${id}`;
      const { detailCacheStore } = await import('../store/detailCache');
      let data = await detailCacheStore.get(cacheKey);
      if (!data) {
        const response = await apiClient.get('/detail', { params: { site, ids: id } });
        data = response.data;
        if (data) await detailCacheStore.set(cacheKey, data);
      }
      if (data?.list?.length > 0) {
        const videoDetail = data.list[0] as VideoDetail;
        setDetail(videoDetail);
        setCurrentSource(site || '');
        
        // 解析集数但不设置播放URL
        let epList: Episode[] = [];
        if (videoDetail.vod_play_url) {
          epList = parseEpisodes(videoDetail.vod_play_url);
          setEpisodes(epList);
          if (epList.length > 0) {
            setCurrentEpisode(epList[0]);
            // 不在这里设置 playUrl，等优选完成后再设置
          }
        }
        
        const { favoritesStore } = await import('../store/favorites');
        const fav = await favoritesStore.isFavorite(id!);
        setIsFavorite(fav);
        
        // 使用 site + vodId + episode 隔离查询历史进度 (Issue 3)
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
        
        // 自动开始优选 - 显式传入 epList 和 id，避免依赖未同步的 React state (Issue 2)
        if (!optimizeStarted.current) {
          optimizeStarted.current = true;
          await startOptimize(videoDetail.vod_name, epList, id!);
        }
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
  };

  // startOptimize 接受显式参数，不依赖未同步的 React state (Issue 2)
  const startOptimize = async (title: string, initialEpisodes: Episode[], baseVodId: string | number) => {
    setSourceLoading(true);
    setSearchProgress({ completed: 0, total: 0, currentSite: '' });
    
    try {
      // 优先从 sessionStorage 读取搜索页面的结果
      let data: SearchSiteData[] | null = null;
      try {
        const cached = sessionStorage.getItem(`search_results:${title}`);
        if (cached) {
          data = JSON.parse(cached) as SearchSiteData[];
          console.log('复用搜索页面结果');
        }
      } catch (err) {
        console.warn('Play: failed to parse sessionStorage cache', err);
      }
      
      // 如果没有缓存，使用流式搜索
      if (!data) {
        data = await streamSearch(title);
      }
      
      if (!data || !Array.isArray(data) || data.length === 0) {
        // 没有找到其他源，使用原始源
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
      
      // 构建源列表
      const sourceList: SourceItem[] = [];
      const { filterYellowItems, isExactMatch } = await import('../utils/filter');
      data.forEach((item) => {
        if (item?.list && item.list.length > 0) {
          // 过滤黄色内容
          let filteredList = filterYellowItems(item.list);
          // 精确匹配筛选
          filteredList = filteredList.filter((item: { vod_name?: string }) => isExactMatch(item.vod_name || '', title));
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
      
      // 只有一个源时，跳过测速直接使用
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
      
      // 并发测速所有源
      const testPromises = sourceList.map(async (source, index) => {
        setSources(prev => prev.map((s, i) => i === index ? { ...s, status: 'testing' as const } : s));
        
        try {
          const siteData = data!.find((item) => item.site_key === source.key);
          if (siteData?.list && siteData.list.length > 0) {
            const vodDetail = await getCachedDetail(source.key, source.vodId);
            const epUrl = vodDetail?.vod_play_url?.split('#')[0]?.split('$')[1];
            if (epUrl && epUrl.includes('.m3u8')) {
              const { testVideoSpeed } = await import('../utils/speedtest');
              const result = await testVideoSpeed(epUrl);
              setSources(prev => prev.map((s, i) => i === index ? { ...s, speed: result, status: 'done' as const } : s));
              return { source, result, vodDetail } as SpeedTestResultWithDetail;
            }
          }
          setSources(prev => prev.map((s, i) => i === index ? { ...s, status: 'done' as const } : s));
        } catch (err) {
          console.warn(`Play: speed test failed for source ${source.key}`, err);
          setSources(prev => prev.map((s, i) => i === index ? { ...s, status: 'error' as const } : s));
        }
        return null;
      });

      const results = await Promise.allSettled(testPromises);
      
      // 找出最佳源
      const validResults: SpeedTestResultWithDetail[] = [];
      for (const r of results) {
        if (r.status === 'fulfilled' && r.value !== null) {
          validResults.push(r.value);
        }
      }
      
      if (validResults.length > 0) {
        validResults.sort((a, b) => {
          const speedA = parseSpeed(a.result.loadSpeed);
          const speedB = parseSpeed(b.result.loadSpeed);
          return speedB - speedA;
        });
        
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
        // 所有测速都失败，选择第一个源
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
        // 没有可用源，使用原始源
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

  // 流式搜索函数 (Issue 5: 增加超时和错误兜底)
  const streamSearch = (wd: string): Promise<SearchSiteData[]> => {
    return new Promise((resolve) => {
      const token = localStorage.getItem('token') || '';
      const url = `/api/search/stream?wd=${encodeURIComponent(wd)}&token=${token}`;
      
      const eventSource = new EventSource(url);
      eventSourceRef.current = eventSource;
      const allResults: SearchSiteData[] = [];
      let siteCount = 0;
      
      // 30 秒总超时，避免一直卡在搜索状态 (Issue 5)
      const timeoutId = setTimeout(() => {
        console.warn('Play: search timeout, resolving with partial results');
        eventSource.close();
        eventSourceRef.current = null;
        resolve(allResults);
      }, 30000);
      
      eventSource.addEventListener('start', (e) => {
        const data = JSON.parse(e.data) as { site_count: number };
        siteCount = data.site_count;
        setSearchProgress({ completed: 0, total: siteCount, currentSite: '' });
      });
      
      eventSource.addEventListener('result', (e) => {
        const data = JSON.parse(e.data) as { data: SearchSiteData; completed: number; total: number; name: string };
        const siteResult = data.data;
        if (siteResult) {
          allResults.push(siteResult);
        }
        setSearchProgress({
          completed: data.completed,
          total: data.total,
          currentSite: data.name,
        });
      });
      
      eventSource.addEventListener('done', () => {
        clearTimeout(timeoutId);
        eventSource.close();
        eventSourceRef.current = null;
        // 缓存结果
        try {
          sessionStorage.setItem(`search_results:${wd}`, JSON.stringify(allResults));
        } catch (err) {
          console.warn('Play: failed to cache search results', err);
        }
        resolve(allResults);
      });
      
      eventSource.addEventListener('error', () => {
        // 任何错误都主动关闭并 resolve 已有结果，避免浏览器自动重连卡死 (Issue 5)
        clearTimeout(timeoutId);
        eventSource.close();
        eventSourceRef.current = null;
        resolve(allResults);
      });
      
      eventSource.addEventListener('timeout', () => {
        clearTimeout(timeoutId);
        eventSource.close();
        eventSourceRef.current = null;
        resolve(allResults);
      });

    });
  };

  const getCachedDetail = async (sourceKey: string, vodId: string | number): Promise<VideoDetail | undefined> => {
    const cacheKey = `${sourceKey}:${vodId}`;
    const { detailCacheStore } = await import('../store/detailCache');
    const cached = await detailCacheStore.get(cacheKey);
    if (cached) return cached?.list?.[0] as VideoDetail | undefined;
    const res = await apiClient.get('/detail', { params: { site: sourceKey, ids: vodId } });
    const data = res.data?.list?.[0] as VideoDetail | undefined;
    if (res.data) await detailCacheStore.set(cacheKey, res.data);
    return data;
  };

  const handleSourceSwitch = useCallback(async (sourceKey: string) => {
    if (sourceKey === currentSource) return;
    const requestId = ++switchRequestId.current; // 异步竞态保护 (Issue 7)
    setCurrentSource(sourceKey);
    setSourceSwitching(true);
    try {
      // 从 searchDataCache 中查找源数据
      let siteData: SearchSiteData | undefined;
      if (searchDataCache && Array.isArray(searchDataCache)) {
        siteData = searchDataCache.find((item) => item.site_key === sourceKey);
      }
      if (!siteData) {
        // 缓存中没有，用流式搜索重新获取
        const freshData = await streamSearch(detail?.vod_name || '');
        if (requestId !== switchRequestId.current) return; // 已被新请求取代
        if (freshData) {
          setSearchDataCache(freshData);
          siteData = freshData.find((item) => item.site_key === sourceKey);
        }
      }
      if (siteData?.list && siteData.list.length > 0) {
        const { filterYellowItems } = await import('../utils/filter');
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
              // 保留当前进度，换源后跳转到当前播放位置
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
    } catch (err) { console.error('切换源失败:', err); } finally { setSourceSwitching(false); }
  }, [currentSource, detail?.vod_name, getPlayableUrl, historyVodId, searchDataCache, applyHistoryProgress]);

  const handleEpisodeClick = useCallback((ep: Episode) => {
    setCurrentEpisode(ep);
    setCurrentTime(0); // 切换集数时重置进度 (Issue 3)
    const requestId = ++playRequestId.current; // 异步竞态保护 (Issue 7)
    if (ep.url) {
      getPlayableUrl(ep.url, currentSource).then(url => {
        if (requestId !== playRequestId.current) return; // 已被新请求取代
        setPlayUrl(url);
      });
    } else {
      apiClient.get('/play', { params: { site: currentSource, ids: id, episode: ep.name } })
        .then((res) => { 
          if (res.data?.url) {
            getPlayableUrl(res.data.url, currentSource).then(url => {
              if (requestId !== playRequestId.current) return;
              setPlayUrl(url);
            });
          }
        }).catch(console.error);
    }
  }, [currentSource, id, getPlayableUrl]);

  const toggleFavorite = useCallback(async () => { 
    if (!detail) return; 
    const { favoritesStore } = await import('../store/favorites');
    const result = await favoritesStore.toggle(detail); 
    setIsFavorite(result); 
  }, [detail]);

  // 加载中显示加载动画
  if (loading && !isOptimizing) return <div className="flex justify-center items-center h-[60vh]"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  // 未找到视频（且不在优化中）
  if (!detail && !isOptimizing) return <div className="text-center text-muted py-8">未找到视频</div>;
  // 优化中但 detail 还没加载，使用占位符
  const currentDetail = detail || { vod_id: id || '', vod_name: '', vod_pic: '', vod_play_url: '' } satisfies VideoDetail;

  return (
    <div>
      {toast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[1000] px-4 py-2 text-sm font-medium rounded-lg shadow-lg backdrop-blur-xl" style={{
          background: 'var(--color-primary-glow)',
          border: '1px solid var(--color-glass-border)',
          color: 'var(--color-primary)',
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.2), 0 0 12px var(--color-primary-glow)',
        }}>
          {toast}
        </div>
      )}

      <div className="flex flex-col gap-4 py-4 px-3 sm:px-5 lg:px-8">
        <div className="py-1">
          <h1 className="text-xl font-semibold text-text">
            {currentDetail.vod_name}
            {currentEpisode && <span className="
              text-lg text-muted font-normal"> - {currentEpisode.name}</span>}
          </h1>
        </div>

        <div className="grid gap-4 lg:h-[500px] xl:h-[650px] grid-cols-1 md:grid-cols-4">
          <div className="md:col-span-3 h-full">
            <div className="relative w-full h-[300px] lg:h-full bg-black rounded-xl overflow-hidden ring-1 ring-white/10 shadow-2xl">
              {/* 搜索播放源动画 */}
              {searchProgress && <SearchingOverlay searchProgress={searchProgress} />}
              {/* 优选动画覆盖层 */}
              {isOptimizing && !searchProgress && <OptimizingOverlay sources={sources} />}
              
              {playUrl && optimizeComplete ? (
                <Suspense fallback={<div className="w-full h-full flex items-center justify-center text-muted">加载播放器...</div>}>
                  <Player
                    url={playUrl}
                    title={currentDetail.vod_name}
                    currentTime={currentTime}
                    onTimeUpdate={(t) => {
                      setCurrentTime(t);
                      if (historyVodId) {
                        // 按 site + vodId + episode 隔离保存进度 (Issue 3)
                        historyStore.updateProgressByContext(
                          currentSource,
                          historyVodId,
                          currentEpisode?.name,
                          t,
                          0,
                        );
                      }
                    }}
                  />
                </Suspense>
              ) : !isOptimizing && optimizeComplete ? (
                <div className="w-full h-full flex items-center justify-center text-muted">选择集数开始播放</div>
              ) : null}
              {/* 源切换提示，不遮挡播放器 */}
              {sourceSwitching && (
                <div className="absolute top-3 right-3 z-10 px-3 py-1.5 bg-black/70 backdrop-blur-sm rounded-lg flex items-center gap-2">
                  <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-primary" />
                  <span className="text-xs text-white/90">切换源中...</span>
                </div>
              )}
            </div>
          </div>

          <div className="md:col-span-1 h-[300px] lg:h-full overflow-hidden">
            <div className="h-full bg-card rounded-xl overflow-hidden flex flex-col">
              {/* 只有一集时只显示换源，不显示集数标签 */}
              {episodes.length <= 1 ? (
                /* 只有换源 - min-h-0 确保 flex 子项可收缩，配合 overflow-y-auto 实现滚动 */
                <div ref={sourceListRef} className="flex-1 min-h-0 max-h-full overflow-y-auto bg-deep">
                  {sourceLoading ? (
                    <div className="flex justify-center py-4"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" /></div>
                  ) : sources.length === 0 ? (
                    <div className="text-center text-muted text-sm py-4">暂无其他播放源</div>
                  ) : (
                    <div className="space-y-1.5">
                      {sources.map((source) => (
                        <div key={source.key} onClick={() => handleSourceSwitch(source.key)} data-active={currentSource === source.key ? "true" : undefined} className={`flex gap-2.5 p-2 rounded-lg cursor-pointer transition-colors ${currentSource === source.key ? 'bg-primary-glow ring-1 ring-primary' : 'hover:bg-surface'}`}>
                          <div className="w-12 h-16 flex-shrink-0 rounded overflow-hidden bg-surface">
                            {source.poster ? <img src={processImageUrl(source.poster)} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-muted text-xs">暂无</div>}
                          </div>
                          <div className="flex-1 min-w-0 flex flex-col justify-between">
                            <div>
                              <div className="flex items-center justify-between">
                                <span className="text-sm font-medium text-text truncate">{currentDetail.vod_name}</span>
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
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                /* 多集时显示标签切换 */
                <>
                  <div className="flex border-b border-glass-border flex-shrink-0">
                    <button onClick={() => setActiveTab('episodes')} className={`flex-1 px-3 py-2.5 text-sm font-medium transition-colors ${activeTab === 'episodes' ? 'text-primary border-b-2 border-primary bg-deep' : 'text-muted'}`}>
                      播放集数
                    </button>
                    <button onClick={() => setActiveTab('sources')} className={`flex-1 px-3 py-2.5 text-sm font-medium transition-colors ${activeTab === 'sources' ? 'text-primary border-b-2 border-primary bg-deep' : 'text-muted'}`}>
                      换源
                    </button>
                  </div>

                  <div className="flex-1 min-h-0 max-h-full overflow-y-auto bg-deep">                    {activeTab === 'episodes' ? (
                      <>
                        {/* 分页标签 - 固定在顶部 */}
                        {episodes.length > EPISODES_PER_PAGE && (
                          <div className="sticky top-0 z-10 bg-surface border-b border-glass-border px-2 py-1.5">
                            <div className="flex gap-1 overflow-x-auto scrollbar-hide">
                              {Array.from({ length: Math.ceil(episodes.length / EPISODES_PER_PAGE) }, (_, i) => {
                                const start = i * EPISODES_PER_PAGE + 1;
                                const end = Math.min((i + 1) * EPISODES_PER_PAGE, episodes.length);
                                return (
                                  <button
                                    key={i}
                                    onClick={() => setEpisodePage(i)}
                                    className={`px-2.5 py-1 text-[11px] font-medium rounded-md flex-shrink-0 transition-all ${
                                      episodePage === i 
                                        ? 'bg-primary text-deep shadow-sm' 
                                        : 'text-muted hover:text-text hover:bg-card'
                                    }`}
                                  >
                                    {start}-{end}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}
                        {/* 集数按钮 — grid-cols-4 避免窄面板下 CJK 文字被 truncate */}
                        <div className="p-2 grid grid-cols-4 gap-1.5">
                          {episodes.slice(episodePage * EPISODES_PER_PAGE, (episodePage + 1) * EPISODES_PER_PAGE).map((ep, index) => (
                            <button key={index} onClick={() => handleEpisodeClick(ep)} className={`px-1.5 py-1.5 text-xs rounded-md transition-colors truncate ${currentEpisode?.name === ep.name ? 'bg-primary text-deep' : 'bg-surface text-muted hover:bg-card'}`} title={ep.name}>
                              {ep.name}
                            </button>
                          ))}
                        </div>
                      </>
                    ) : sourceLoading ? (
                      <div className="flex justify-center py-4"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" /></div>
                    ) : sources.length === 0 ? (
                      <div className="text-center text-muted text-sm py-4">暂无其他播放源</div>
                    ) : (
                      <div className="space-y-1.5">
                        {sources.map((source) => (
                          <div key={source.key} onClick={() => handleSourceSwitch(source.key)} className={`flex gap-2.5 p-2 rounded-lg cursor-pointer transition-colors ${currentSource === source.key ? 'bg-primary-glow ring-1 ring-primary' : 'hover:bg-surface'}`}>
                            <div className="w-12 h-16 flex-shrink-0 rounded overflow-hidden bg-surface">
                              {source.poster ? <img src={processImageUrl(source.poster)} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-muted text-xs">暂无</div>}
                            </div>
                            <div className="flex-1 min-w-0 flex flex-col justify-between">
                              <div>
                                <div className="flex items-center justify-between">
                                  <span className="text-sm font-medium text-text truncate">{currentDetail.vod_name}</span>
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
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mt-2">
          <div className="hidden md:block md:col-span-1 md:order-first">
            <div className="pr-6">
              <div className="relative aspect-[2/3] rounded-xl overflow-hidden shadow-lg">
                <img src={currentDetail.vod_pic || '/placeholder.jpg'} alt={currentDetail.vod_name} className="w-full h-full object-cover" />
              </div>
            </div>
          </div>

          <div className="md:col-span-3">
            <div className="p-4">
              <h1 className="text-2xl sm:text-3xl font-bold text-text mb-2 flex items-center gap-3">
                {currentDetail.vod_name}
                <button onClick={toggleFavorite} className="flex-shrink-0 hover:opacity-80 transition-opacity">
                  {isFavorite ? (
                    <svg className="h-7 w-7" viewBox="0 0 24 24" fill="#ef4444" stroke="#ef4444" strokeWidth="2"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" /></svg>
                  ) : (
                    <svg className="h-7 w-7 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1"><path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>
                  )}
                </button>
              </h1>

              <div className="flex flex-wrap items-center gap-3 text-base mb-4">
                {currentDetail.type_name && <span className="text-primary font-semibold">{currentDetail.type_name}</span>}
                {currentDetail.vod_year && <span className="text-muted">{currentDetail.vod_year}</span>}
                <span className="border border-glass-border px-2 py-0.5 rounded text-muted text-sm">
                  {sources.find(s => s.key === currentSource)?.name || site}
                </span>
                {currentDetail.vod_remarks && <span className="text-muted">{currentDetail.vod_remarks}</span>}
              </div>

              {currentDetail.vod_content && (
                <div className="text-base leading-relaxed text-muted" style={{ whiteSpace: 'pre-line' }}>
                  {currentDetail.vod_content.replace(/<[^>]*>/g, '')}
                  {site && /^\d+$/.test(site) && (
                    <div className="mt-4">
                      <button 
                        onClick={async () => { 
                          await historyStore.clear(); 
                          window.location.href = '/'; 
                        }} 
                        className="px-4 py-2 bg-primary text-deep rounded-lg hover:opacity-90 transition-opacity"
                      >
                        清空历史记录并返回首页
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Play;
