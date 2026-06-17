import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import Player from '../components/Player';
import apiClient from '../api/client';
import type { VideoDetail } from '../types';
import { favoritesStore } from '../store/favorites';
import { historyStore } from '../store/history';
import { detailCacheStore } from '../store/detailCache';
import { apiCacheStore } from '../store/apiCache';
import { fetchAndFilterM3U8 } from '../utils/adblock';
import { testVideoSpeed, type SpeedTestResult } from '../utils/speedtest';
import { processImageUrl } from '../utils/image';

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
}

function parseEpisodes(playUrl: string): Episode[] {
  return playUrl.split('#').filter((e) => e.trim()).map((e) => {
    const parts = e.split('$');
    return { name: parts[0] || '播放', url: parts[1] || '' };
  });
}

// 优选动画组件
const OptimizingOverlay = ({ sources }: { sources: SourceItem[] }) => {
  const tested = sources.filter(s => s.status === 'done' || s.status === 'error').length;
  const total = sources.length;
  const currentTesting = sources.find(s => s.status === 'testing');

  return (
    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/90 backdrop-blur-sm">
      {/* 动态扫描线 */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-primary to-transparent animate-scan-line" />
        <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-primary to-transparent animate-scan-line-reverse" />
        <div className="absolute top-0 bottom-0 left-0 w-[2px] bg-gradient-to-b from-transparent via-primary to-transparent animate-scan-vertical" />
        <div className="absolute top-0 bottom-0 right-0 w-[2px] bg-gradient-to-b from-transparent via-primary to-transparent animate-scan-vertical-reverse" />
      </div>

      {/* 中心内容 */}
      <div className="relative flex flex-col items-center gap-6">
        {/* 旋转雷达 */}
        <div className="relative w-24 h-24">
          <div className="absolute inset-0 rounded-full border-2 border-primary/20" />
          <div className="absolute inset-2 rounded-full border border-primary/30" />
          <div className="absolute inset-4 rounded-full border border-primary/40" />
          <div className="absolute inset-0 origin-center animate-radar-sweep">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-0.5 h-12 bg-gradient-to-b from-primary to-transparent" />
          </div>
          {/* 信号点 */}
          {sources.filter(s => s.status === 'done' && s.speed).map((_, i) => {
            const angle = (i / sources.filter(s => s.status === 'done' && s.speed).length) * 360;
            const rad = (angle * Math.PI) / 180;
            const x = 48 + Math.cos(rad) * 30;
            const y = 48 + Math.sin(rad) * 30;
            return (
              <div
                key={i}
                className="absolute w-2 h-2 bg-green-400 rounded-full animate-ping"
                style={{ left: x, top: y, animationDelay: `${i * 0.2}s` }}
              />
            );
          })}
        </div>

        {/* 文字信息 */}
        <div className="text-center space-y-2">
          <h3 className="text-lg font-semibold text-text">正在优选最佳播放地址</h3>
          <p className="text-sm text-muted">
            {currentTesting ? (
              <span>正在测试: <span className="text-primary">{currentTesting.name}</span></span>
            ) : (
              <span>已完成 {tested}/{total} 个源</span>
            )}
          </p>
        </div>

        {/* 进度条 */}
        <div className="w-48 space-y-1.5">
          <div className="w-full h-1.5 bg-card rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-primary-dim to-primary rounded-full transition-all duration-300 ease-out"
              style={{ width: `${total > 0 ? (tested / total) * 100 : 0}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-muted">
            <span>{tested} 已测试</span>
            <span>{total - tested} 剩余</span>
          </div>
        </div>

        {/* 源列表预览 */}
        <div className="flex flex-wrap justify-center gap-1.5 max-w-[280px]">
          {sources.map((source) => (
            <div
              key={source.key}
              className={`px-2 py-0.5 rounded text-[10px] transition-all duration-200 ${
                source.status === 'testing' 
                  ? 'bg-primary/20 text-primary animate-pulse' 
                  : source.status === 'done' && source.speed
                    ? 'bg-green-900/30 text-green-400'
                    : source.status === 'error'
                      ? 'bg-red-900/30 text-red-400'
                      : 'bg-surface text-muted'
              }`}
            >
              {source.name}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const Play = () => {
  const { site, id } = useParams<{ site: string; id: string }>();
  const [detail, setDetail] = useState<VideoDetail | null>(null);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [currentEpisode, setCurrentEpisode] = useState<Episode | null>(null);
  const [playUrl, setPlayUrl] = useState('');
  const [isFavorite, setIsFavorite] = useState(false);
  const [loading, setLoading] = useState(true); // 初始为 true，避免闪烁
  const [activeTab, setActiveTab] = useState<'episodes' | 'sources'>('episodes');
  const [sources, setSources] = useState<SourceItem[]>([]);
  const [currentSource, setCurrentSource] = useState('');
  const [sourceLoading, setSourceLoading] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [searchDataCache, setSearchDataCache] = useState<any>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [toast, setToast] = useState('');
  const [historyVodId, setHistoryVodId] = useState<string | number>('');
  const [optimizeComplete, setOptimizeComplete] = useState(false);
  const [episodePage, setEpisodePage] = useState(0);
  const EPISODES_PER_PAGE = 50;
  const optimizeStarted = useRef(false);

  // m3u8 前端处理（支持去广告）
  const getPlayableUrl = async (url: string) => {
    if (!url) return url;
    if (url.includes('.m3u8')) {
      return await fetchAndFilterM3U8(url);
    }
    return url;
  };

  useEffect(() => { 
    if (site && id) {
      optimizeStarted.current = false;
      setOptimizeComplete(false);
      setPlayUrl('');
      loadDetail(); 
    }
  }, [site, id]);

  const loadDetail = async () => {
    setLoading(true);
    setIsOptimizing(true);
    
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
      } as any);
      return;
    }
    
    try {
      // 检查缓存
      const cacheKey = `${site}:${id}`;
      let data = await detailCacheStore.get(cacheKey);
      if (!data) {
        const response = await apiClient.get('/detail', { params: { site, ids: id } });
        data = response.data;
        if (data) await detailCacheStore.set(cacheKey, data);
      }
      if (data?.list?.length > 0) {
        const videoDetail = data.list[0];
        setDetail(videoDetail);
        setCurrentSource(site || '');
        
        // 解析集数但不设置播放URL
        if (videoDetail.vod_play_url) {
          const epList = parseEpisodes(videoDetail.vod_play_url);
          setEpisodes(epList);
          if (epList.length > 0) {
            setCurrentEpisode(epList[0]);
            // 不在这里设置 playUrl，等优选完成后再设置
          }
        }
        
        const fav = await favoritesStore.isFavorite(id!);
        setIsFavorite(fav);
        
        const history = await historyStore.getRecent(100);
        const savedRecord = history.find((h: any) => String(h.vod_id) === String(id));
        if (savedRecord && savedRecord.progress && savedRecord.progress > 0) {
          setCurrentTime(savedRecord.progress);
          const minutes = Math.floor(savedRecord.progress / 60);
          const seconds = Math.floor(savedRecord.progress % 60);
          setToast(`已从 ${minutes}:${seconds.toString().padStart(2, '0')} 继续播放`);
          setTimeout(() => setToast(''), 3000);
        }

        await historyStore.add({ ...videoDetail, vod_id: id!, site_key: site });
        setHistoryVodId(id!);
        
        // 自动开始优选
        if (!optimizeStarted.current) {
          optimizeStarted.current = true;
          await startOptimize(videoDetail.vod_name);
        }
      }
    } catch (err: any) { 
      console.error('加载详情失败:', err); 
      setIsOptimizing(false);
      const errorMsg = err.response?.data?.error || err.message || '加载失败';
      setToast(errorMsg);
      setTimeout(() => setToast(''), 5000);
    } finally { 
      setLoading(false); 
    }
  };

  const startOptimize = async (title: string) => {
    setSourceLoading(true);
    try {
      // 检查搜索缓存
      const searchCacheKey = `search:${title}`;
      let data = await apiCacheStore.get('search', searchCacheKey);
      
      if (!data) {
        const response = await apiClient.get('/search', { params: { wd: title } });
        data = response.data;
        if (data) await apiCacheStore.set('search', searchCacheKey, data);
      }
      const sourceList: SourceItem[] = [];
      
      // data 是数组 [{site_key, name, list}, ...]
      if (Array.isArray(data)) {
        data.forEach((item: any) => {
          if (item?.list?.length > 0) {
            const firstItem = item.list[0];
            sourceList.push({ 
              key: item.site_key, 
              name: firstItem.source_name || item.name || item.site_key, 
              poster: firstItem.vod_pic, 
              episodeCount: item.list.length, 
              speed: null, 
              status: 'pending' 
            });
          }
        });
      }
      
      if (sourceList.length === 0) {
        // 没有找到其他源，使用原始源
        setIsOptimizing(false);
        setOptimizeComplete(true);
        const epList = episodes;
        if (epList.length > 0 && epList[0].url) {
          getPlayableUrl(epList[0].url).then(setPlayUrl);
        }
        return;
      }
      
      setSources(sourceList);
      setSearchDataCache(data);
      setSourceLoading(false);
      
      // 并发测速所有源
      const testPromises = sourceList.map(async (source, index) => {
        // 更新状态为测试中
        setSources(prev => prev.map((s, i) => i === index ? { ...s, status: 'testing' as const } : s));
        
        try {
          // data 是数组，需要根据 site_key 查找
          const siteData = Array.isArray(data) 
            ? data.find((item: any) => item.site_key === source.key)
            : data[source.key];
          if (siteData?.list?.length > 0) {
            const vodDetail = await getCachedDetail(source.key, siteData.list[0].vod_id);
            const epUrl = vodDetail?.vod_play_url?.split('#')[0]?.split('$')[1];
            if (epUrl && epUrl.includes('.m3u8')) {
              const result = await testVideoSpeed(epUrl);
              setSources(prev => prev.map((s, i) => i === index ? { ...s, speed: result, status: 'done' as const } : s));
              return { source, result, vodDetail };
            }
          }
          setSources(prev => prev.map((s, i) => i === index ? { ...s, status: 'done' as const } : s));
        } catch {
          setSources(prev => prev.map((s, i) => i === index ? { ...s, status: 'error' as const } : s));
        }
        return null;
      });

      const results = await Promise.allSettled(testPromises);
      
      // 找出最佳源
      const validResults = results
        .filter(r => r.status === 'fulfilled' && (r as PromiseFulfilledResult<any>).value !== null)
        .map(r => (r as PromiseFulfilledResult<any>).value);
      
      if (validResults.length > 0) {
        // 按速度排序，选择最快的（需要统一单位）
        const parseSpeed = (speedStr: string): number => {
          const match = speedStr.match(/([\d.]+)\s*(KB|MB|GB)\/s/i);
          if (!match) return 0;
          const value = parseFloat(match[1]);
          const unit = match[2].toUpperCase();
          if (unit === 'GB') return value * 1024;
          if (unit === 'MB') return value;
          return value / 1024; // KB 转 MB
        };
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
        
        // 切换到最佳源并设置播放URL
        setCurrentSource(bestSource.key);
        if (bestDetail) {
          setDetail(bestDetail);
          if (bestDetail.vod_play_url) {
            const epList = parseEpisodes(bestDetail.vod_play_url);
            setEpisodes(epList);
            if (epList.length > 0) {
              setCurrentEpisode(epList[0]);
              getPlayableUrl(epList[0].url).then(setPlayUrl); // 现在才设置播放URL
            }
          }
          // 更新历史记录
          await historyStore.updateSource(historyVodId, bestSource.key, bestDetail.vod_id);
          setHistoryVodId(bestDetail.vod_id);
        }
      } else {
        // 没有有效结果，使用原始源
        const epList = episodes;
        if (epList.length > 0 && epList[0].url) {
          getPlayableUrl(epList[0].url).then(setPlayUrl);
        }
      }
      
    } catch (err) {
      console.error('优选失败:', err);
      // 优选失败，使用原始源
      const epList = episodes;
      if (epList.length > 0 && epList[0].url) {
        getPlayableUrl(epList[0].url).then(setPlayUrl);
      }
    } finally {
      setSourceLoading(false);
      setOptimizeComplete(true);
      // 延迟关闭动画，让用户看到完成状态
      setTimeout(() => setIsOptimizing(false), 800);
    }
  };

  const getCachedDetail = async (sourceKey: string, vodId: string) => {
    const cacheKey = `${sourceKey}:${vodId}`;
    const cached = await detailCacheStore.get(cacheKey);
    if (cached) return cached?.list?.[0];
    const res = await apiClient.get('/detail', { params: { site: sourceKey, ids: vodId } });
    const data = res.data?.list?.[0];
    if (res.data) await detailCacheStore.set(cacheKey, res.data);
    return data;
  };

  const handleSourceSwitch = async (sourceKey: string) => {
    if (sourceKey === currentSource) return;
    setCurrentSource(sourceKey);
    setLoading(true);
    try {
      const response = searchDataCache ? { data: searchDataCache } : await apiClient.get('/search', { params: { wd: detail?.vod_name || '' } });
      // data 是数组，需要根据 site_key 查找
      const siteData = Array.isArray(response.data) 
        ? response.data.find((item: any) => item.site_key === sourceKey)
        : response.data[sourceKey];
      if (siteData?.list?.length > 0) {
        const item = siteData.list[0];
        const newDetail = await getCachedDetail(sourceKey, item.vod_id);
        if (newDetail) {
          setDetail(newDetail);
          if (newDetail.vod_play_url) {
            const epList = parseEpisodes(newDetail.vod_play_url);
            setEpisodes(epList);
            if (epList.length > 0) { setCurrentEpisode(epList[0]); if (epList[0].url) getPlayableUrl(epList[0].url).then(setPlayUrl); }
          }
          setActiveTab('episodes');
          await historyStore.updateSource(historyVodId, sourceKey, item.vod_id);
          setHistoryVodId(item.vod_id);
        }
      }
    } catch (err) { console.error('切换源失败:', err); } finally { setLoading(false); }
  };

  const handleEpisodeClick = (ep: Episode) => {
    setCurrentEpisode(ep);
    if (ep.url) {
      getPlayableUrl(ep.url).then(setPlayUrl);
    } else {
      apiClient.get('/play', { params: { site: currentSource, ids: id, episode: ep.name } })
        .then((res) => { if (res.data.url) getPlayableUrl(res.data.url).then(setPlayUrl); }).catch(console.error);
    }
  };

  const toggleFavorite = async () => { if (!detail) return; const result = await favoritesStore.toggle(detail); setIsFavorite(result); };

  // 加载中显示加载动画
  if (loading && !isOptimizing) return <div className="flex justify-center items-center h-[60vh]"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  // 未找到视频（且不在优化中）
  if (!detail && !isOptimizing) return <div className="text-center text-muted py-8">未找到视频</div>;
  // 优化中但 detail 还没加载，使用占位符
  const currentDetail = detail || { vod_id: id || '', vod_name: '', vod_pic: '', vod_play_url: '' } as any;

  return (
    <div>
      {toast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[1000] px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg shadow-lg">
          {toast}
        </div>
      )}

      <div className="flex flex-col gap-4 py-4 px-5 lg:px-[3rem] 2xl:px-20">
        <div className="py-1">
          <h1 className="text-xl font-semibold text-text">
            {currentDetail.vod_name}
            {currentEpisode && <span className="text-muted">{` > ${currentEpisode.name}`}</span>}
          </h1>
        </div>

        <div className="grid gap-4 lg:h-[500px] xl:h-[650px] grid-cols-1 md:grid-cols-4">
          <div className="md:col-span-3 h-full">
            <div className="relative w-full h-[300px] lg:h-full bg-black rounded-xl overflow-hidden ring-1 ring-white/10 shadow-2xl">
              {/* 优选动画覆盖层 */}
              {isOptimizing && <OptimizingOverlay sources={sources} />}
              
              {playUrl && optimizeComplete ? (
                <Player url={playUrl} title={currentDetail.vod_name} currentTime={currentTime} onTimeUpdate={(t) => { setCurrentTime(t); if (historyVodId) historyStore.updateProgress(historyVodId, t, 0); }} />
              ) : !isOptimizing && optimizeComplete ? (
                <div className="w-full h-full flex items-center justify-center text-muted">选择集数开始播放</div>
              ) : null}
            </div>
          </div>

          <div className="md:col-span-1 h-[300px] lg:h-full">
            <div className="h-full bg-card rounded-xl overflow-hidden flex flex-col">
              <div className="flex border-b border-glass-border flex-shrink-0">
                <button onClick={() => setActiveTab('episodes')} className={`flex-1 px-3 py-2.5 text-sm font-medium transition-colors ${activeTab === 'episodes' ? 'text-primary border-b-2 border-primary bg-deep' : 'text-muted'}`}>
                  播放集数
                </button>
                <button onClick={() => setActiveTab('sources')} className={`flex-1 px-3 py-2.5 text-sm font-medium transition-colors ${activeTab === 'sources' ? 'text-primary border-b-2 border-primary bg-deep' : 'text-muted'}`}>
                  换源
                </button>
              </div>

              <div className="flex-1 overflow-y-auto bg-deep">
                {activeTab === 'episodes' ? (
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
                    {/* 集数按钮 */}
                    <div className="p-2 grid grid-cols-5 gap-1.5">
                      {episodes.slice(episodePage * EPISODES_PER_PAGE, (episodePage + 1) * EPISODES_PER_PAGE).map((ep, index) => (
                        <button key={index} onClick={() => handleEpisodeClick(ep)} className={`px-2 py-1.5 text-xs rounded-md transition-colors truncate ${currentEpisode?.name === ep.name ? 'bg-primary text-deep' : 'bg-surface text-muted hover:bg-card'}`} title={ep.name}>
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
                            {(() => {
                              if (source.status === 'testing') return <span className="text-primary animate-pulse">测速中...</span>;
                              if (source.speed) return <span><span className="text-blue-400">{source.speed.loadSpeed}</span> <span className="text-orange-500">{source.speed.pingTime}ms</span></span>;
                              return <span className="text-muted">无测速数据</span>;
                            })()}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
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

      <style>{`
        @keyframes scan-line {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        @keyframes scan-line-reverse {
          0% { transform: translateX(100%); }
          100% { transform: translateX(-100%); }
        }
        @keyframes scan-vertical {
          0% { transform: translateY(-100%); }
          100% { transform: translateY(100%); }
        }
        @keyframes scan-vertical-reverse {
          0% { transform: translateY(100%); }
          100% { transform: translateY(-100%); }
        }
        @keyframes radar-sweep {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        .animate-scan-line { animation: scan-line 2s linear infinite; }
        .animate-scan-line-reverse { animation: scan-line-reverse 2s linear infinite; }
        .animate-scan-vertical { animation: scan-vertical 3s linear infinite; }
        .animate-scan-vertical-reverse { animation: scan-vertical-reverse 3s linear infinite; }
        .animate-radar-sweep { animation: radar-sweep 2s linear infinite; }
      `}</style>
    </div>
  );
};

export default Play;
