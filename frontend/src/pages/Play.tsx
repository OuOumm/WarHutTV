import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import Player from '../components/Player';
import apiClient from '../api/client';
import type { VideoDetail } from '../types';
import { favoritesStore } from '../store/favorites';
import { historyStore } from '../store/history';
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
  status?: 'testing' | 'done' | 'error';
}

const Play = () => {
  const { site, id } = useParams<{ site: string; id: string }>();
  const [detail, setDetail] = useState<VideoDetail | null>(null);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [currentEpisode, setCurrentEpisode] = useState<Episode | null>(null);
  const [playUrl, setPlayUrl] = useState('');
  const [isFavorite, setIsFavorite] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'episodes' | 'sources'>('episodes');
  const [sources, setSources] = useState<SourceItem[]>([]);
  const [currentSource, setCurrentSource] = useState('');
  const [sourceLoading, setSourceLoading] = useState(false);
  const [testingAll, setTestingAll] = useState(false);
    const [searchDataCache, setSearchDataCache] = useState<any>(null);

  useEffect(() => { if (site && id) loadDetail(); }, [site, id]);

  const loadDetail = async () => {
    setLoading(true);
    try {
      const response = await apiClient.get('/detail', { params: { site, ids: id } });
      const data = response.data;
      if (data?.list?.length > 0) {
        const videoDetail = data.list[0];
        setDetail(videoDetail);
        setCurrentSource(site || '');
        if (videoDetail.vod_play_url) {
          const epList: Episode[] = videoDetail.vod_play_url.split('#').filter((e: string) => e.trim()).map((e: string) => {
            const parts = e.split('$');
            return { name: parts[0] || '播放', url: parts[1] || '' };
          });
          setEpisodes(epList);
          if (epList.length > 0) {
            setCurrentEpisode(epList[0]);
            if (epList[0].url) setPlayUrl(epList[0].url);
          }
        }
        const fav = await favoritesStore.isFavorite(videoDetail.vod_id);
        setIsFavorite(fav);
        await historyStore.add(videoDetail);
          
          // 自动加载换源数据
          loadSources();
      }
    } catch (err) { console.error('加载详情失败:', err); } finally { setLoading(false); }
  };

  const loadSources = async () => {
    if (sources.length > 0) return;
    setSourceLoading(true);
    try {
      const response = await apiClient.get('/search', { params: { wd: detail?.vod_name || '' } });
      const data = response.data;
      const sourceList: SourceItem[] = [];
      if (typeof data === 'object') {
        Object.entries(data).forEach(([key, val]: [string, any]) => {
          if (val?.list?.length > 0) {
            const item = val.list[0];
            sourceList.push({
              key,
              name: item.source_name || key,
              poster: item.vod_pic,
              episodeCount: val.list.length,
              speed: null,
              status: 'done',
            });
          }
        });
      }
      setSources(sourceList);
        setSearchDataCache(data);
    } catch (err) { console.error('加载播放源失败:', err); } finally { setSourceLoading(false); }
  };

  const handleTabChange = (tab: 'episodes' | 'sources') => {
    setActiveTab(tab);
    if (tab === 'sources' && sources.length === 0) {
      loadSources().then(() => {
        setTimeout(() => testAllSources(), 500);
      });
    } else if (tab === 'sources' && sources.length > 0 && !testingAll) {
      const hasUntested = sources.some(s => s.status === 'done' && !s.speed);
      if (hasUntested) {
        setTimeout(() => testAllSources(), 300);
      }
    }
  };

  const testAllSources = useCallback(async () => {
    if (sources.length === 0) return;
    setTestingAll(true);

    const updated = [...sources];
    for (let i = 0; i < updated.length; i++) {
      updated[i] = { ...updated[i], status: 'testing', speed: null };
      setSources([...updated]);

      try {
        const searchRes = searchDataCache ? { data: { [updated[i].key]: searchDataCache[updated[i].key] } } : await apiClient.get('/search', { params: { wd: detail?.vod_name || '', site: updated[i].key } });
        const siteData = searchRes.data[updated[i].key];
        if (siteData?.list?.length > 0) {
          const item = siteData.list[0];
          const detailRes = await apiClient.get('/detail', { params: { site: updated[i].key, ids: item.vod_id } });
          if (detailRes.data?.list?.length > 0) {
            const vodDetail = detailRes.data.list[0];
            if (vodDetail.vod_play_url) {
              const firstEp = vodDetail.vod_play_url.split('#')[0];
              const epParts = firstEp.split('$');
              const epUrl = epParts[1];
              if (epUrl && epUrl.includes('.m3u8')) {
                const result = await testVideoSpeed(epUrl);
                updated[i] = { ...updated[i], speed: result, status: 'done' };
              } else {
                updated[i] = { ...updated[i], status: 'done' };
              }
            }
          }
        }
      } catch {
        updated[i] = { ...updated[i], status: 'error' };
      }
      setSources([...updated]);
    }
    setTestingAll(false);
  }, [sources, detail]);

  const handleSourceSwitch = async (sourceKey: string) => {
    if (sourceKey === currentSource) return;
    setCurrentSource(sourceKey);
    setLoading(true);
    try {
      const response = await apiClient.get('/search', { params: { wd: detail?.vod_name || '' } });
      const siteData = response.data[sourceKey];
      if (siteData?.list?.length > 0) {
        const item = siteData.list[0];
        const detailRes = await apiClient.get('/detail', { params: { site: sourceKey, ids: item.vod_id } });
        if (detailRes.data?.list?.length > 0) {
          const newDetail = detailRes.data.list[0];
          setDetail(newDetail);
          if (newDetail.vod_play_url) {
            const epList: Episode[] = newDetail.vod_play_url.split('#').filter((e: string) => e.trim()).map((e: string) => {
              const parts = e.split('$');
              return { name: parts[0] || '播放', url: parts[1] || '' };
            });
            setEpisodes(epList);
            if (epList.length > 0) {
              setCurrentEpisode(epList[0]);
              if (epList[0].url) setPlayUrl(epList[0].url);
            }
          }
          setActiveTab('episodes');
        }
      }
    } catch (err) { console.error('切换源失败:', err); } finally { setLoading(false); }
  };

  const handleEpisodeClick = (ep: Episode) => {
    setCurrentEpisode(ep);
    if (ep.url) {
      setPlayUrl(ep.url);
    } else {
      apiClient.get('/play', { params: { site: currentSource, ids: id, episode: ep.name } })
        .then((res) => { if (res.data.url) setPlayUrl(res.data.url); })
        .catch(console.error);
    }
  };

  const toggleFavorite = async () => {
    if (!detail) return;
    const result = await favoritesStore.toggle(detail);
    setIsFavorite(result);
  };

  if (loading) return <div className="flex justify-center items-center h-[60vh]"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500" /></div>;
  if (!detail) return <div className="text-center text-gray-500 dark:text-gray-400 py-8">未找到视频</div>;

  return (
    <div className="flex flex-col gap-4 py-4 px-5 lg:px-[3rem] 2xl:px-20">
      {/* 标题 */}
      <div className="py-1">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
          {detail.vod_name}
          {currentEpisode && <span className="text-gray-500 dark:text-gray-400">{` > ${currentEpisode.name}`}</span>}
        </h1>
      </div>

      {/* 播放器 + 选集/换源 */}
      <div className="grid gap-4 lg:h-[500px] xl:h-[650px] grid-cols-1 md:grid-cols-4">
        {/* 播放器 */}
        <div className="md:col-span-3 h-full">
          <div className="relative w-full h-[300px] lg:h-full bg-black rounded-xl overflow-hidden">
            {playUrl ? (
              <Player url={playUrl} title={detail.vod_name} />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-500">选择集数开始播放</div>
            )}
          </div>
        </div>

        {/* 选集/换源 */}
        <div className="md:col-span-1 h-[300px] lg:h-full">
          <div className="h-full bg-gray-100 dark:bg-gray-800 rounded-xl overflow-hidden flex flex-col">
            {/* Tab */}
            <div className="flex border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
              {episodes.length > 1 ? (
                <>
                  <button onClick={() => handleTabChange('episodes')} className={`flex-1 px-3 py-2.5 text-sm font-medium transition-colors ${activeTab === 'episodes' ? 'text-green-600 dark:text-green-400 border-b-2 border-green-600 dark:border-green-400 bg-white dark:bg-gray-800' : 'text-gray-500 dark:text-gray-400'}`}>
                    选集
                  </button>
                  <button onClick={() => handleTabChange('sources')} className={`flex-1 px-3 py-2.5 text-sm font-medium transition-colors ${activeTab === 'sources' ? 'text-green-600 dark:text-green-400 border-b-2 border-green-600 dark:border-green-400 bg-white dark:bg-gray-800' : 'text-gray-500 dark:text-gray-400'}`}>
                    换源
                  </button>
                </>
              ) : (
                <div className="w-full px-3 py-2.5 text-sm font-medium text-green-600 dark:text-green-400 border-b-2 border-green-600 dark:border-green-400 bg-white dark:bg-gray-800 text-center">
                  换源
                </div>
              )}
            </div>

            {/* 内容 */}
            <div className="flex-1 overflow-y-auto p-2 bg-white dark:bg-gray-800">
              {(activeTab === 'episodes' && episodes.length > 1) ? (
                <div className="grid grid-cols-3 gap-1.5">
                  {episodes.map((ep, index) => (
                    <button key={index} onClick={() => handleEpisodeClick(ep)} className={`px-2 py-1.5 text-xs rounded-md transition-colors truncate ${currentEpisode?.name === ep.name ? 'bg-green-600 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'}`} title={ep.name}>
                      {ep.name}
                    </button>
                  ))}
                </div>
              ) : sourceLoading ? (
                <div className="flex justify-center py-4"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-green-500" /></div>
              ) : (
                <div className="space-y-2">
                  {testingAll && (
                    <div className="text-center text-xs text-gray-400 py-1">测速中...</div>
                  )}

                  {/* 源列表 */}
                  {sources.map((source) => (
                    <div
                      key={source.key}
                      onClick={() => handleSourceSwitch(source.key)}
                      className={`flex gap-2.5 p-2 rounded-lg cursor-pointer transition-colors ${
                        currentSource === source.key
                          ? 'bg-green-50 dark:bg-green-900/20 ring-1 ring-green-500'
                          : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                      }`}
                    >
                      {/* 海报 */}
                      <div className="w-12 h-16 flex-shrink-0 rounded overflow-hidden bg-gray-200 dark:bg-gray-700">
                        {source.poster ? (
                          <img src={processImageUrl(source.poster)} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">暂无</div>
                        )}
                      </div>

                      {/* 信息 */}
                      <div className="flex-1 min-w-0 flex flex-col justify-between">
                        <div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{detail.vod_name}</span>
                            {source.speed && (
                              <span className="text-[10px] px-1.5 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded flex-shrink-0">
                                {source.speed.quality}
                              </span>
                            )}
                            {source.status === 'error' && (
                              <span className="text-[10px] px-1.5 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded flex-shrink-0">
                                检测失败
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1 mt-0.5">
                            <span className="text-[10px] px-1 py-0.5 bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300 rounded">
                              {source.name}
                            </span>
                            {source.episodeCount && (
                              <span className="text-[10px] text-gray-400">{source.episodeCount} 集</span>
                            )}
                          </div>
                        </div>
                        {/* 速度信息 */}
                        <div className="text-[10px]">
                          {source.status === 'testing' ? (
                            <span className="text-gray-400">测速中...</span>
                          ) : source.speed ? (
                            <span>
                              <span className="text-blue-600 dark:text-blue-400">{source.speed.loadSpeed}</span>
                              <span className="text-orange-500 ml-1">{source.speed.pingTime}ms</span>
                            </span>
                          ) : source.status === 'error' ? (
                            <span className="text-red-400">无测速数据</span>
                          ) : (
                            <span className="text-gray-400">无测速数据</span>
                          )}
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

      {/* 影视信息 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mt-2">
        <div className="hidden md:block md:col-span-1 md:order-first">
          <div className="pr-6">
            <div className="relative aspect-[2/3] rounded-xl overflow-hidden shadow-lg">
              <img src={detail.vod_pic || '/placeholder.jpg'} alt={detail.vod_name} className="w-full h-full object-cover" />
            </div>
          </div>
        </div>

        <div className="md:col-span-3">
          <div className="p-4">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2 flex items-center gap-3">
              {detail.vod_name}
              <button onClick={toggleFavorite} className="flex-shrink-0 hover:opacity-80 transition-opacity">
                {isFavorite ? (
                  <svg className="h-7 w-7" viewBox="0 0 24 24" fill="#ef4444" stroke="#ef4444" strokeWidth="2"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" /></svg>
                ) : (
                  <svg className="h-7 w-7 text-gray-600 dark:text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1"><path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>
                )}
              </button>
            </h1>

            <div className="flex flex-wrap items-center gap-3 text-base mb-4">
              {detail.type_name && <span className="text-green-600 font-semibold">{detail.type_name}</span>}
              {detail.vod_year && <span className="text-gray-600 dark:text-gray-400">{detail.vod_year}</span>}
              <span className="border border-gray-400 dark:border-gray-500 px-2 py-0.5 rounded text-gray-600 dark:text-gray-400 text-sm">
                {sources.find(s => s.key === currentSource)?.name || site}
              </span>
              {detail.vod_remarks && <span className="text-gray-600 dark:text-gray-400">{detail.vod_remarks}</span>}
            </div>

            {detail.vod_content && (
              <p className="text-base leading-relaxed text-gray-700 dark:text-gray-300" style={{ whiteSpace: 'pre-line' }}>
                {detail.vod_content.replace(/<[^>]*>/g, '')}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Play;






