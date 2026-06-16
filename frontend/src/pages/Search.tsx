import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import SearchBar from '../components/SearchBar';
import VideoCard from '../components/VideoCard';
import apiClient from '../api/client';
import type { VideoItem } from '../types';
import { filterYellowItems } from '../utils/filter';

const Search = () => {
  const [searchParams] = useSearchParams();
  const keyword = searchParams.get('wd') || '';
  const [results, setResults] = useState<VideoItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const getDefaultAggregate = () => {
    try {
      const v = localStorage.getItem('defaultAggregateSearch');
      return v !== null ? JSON.parse(v) : true;
    } catch { return true; }
  };

  const [viewMode, setViewMode] = useState<'agg' | 'all'>(getDefaultAggregate() ? 'agg' : 'all');

  useEffect(() => {
    if (keyword) searchVideos(keyword);
  }, [keyword]);

  const searchVideos = async (wd: string) => {
    setLoading(true);
    setError('');
    try {
      const response = await apiClient.get('/search', { params: { wd } });
      const allResults: VideoItem[] = [];
      const data = response.data;
      if (Array.isArray(data)) {
        allResults.push(...data);
      } else if (typeof data === 'object') {
        Object.values(data).forEach((siteResult: any) => {
          if (siteResult?.list) allResults.push(...siteResult.list);
        });
      }
      setResults(filterYellowItems(allResults));
    } catch (err: any) {
      setError(err.response?.data?.error || '搜索失败');
    } finally {
      setLoading(false);
    }
  };

  // 聚合结果：按标题+年份分组
  const aggregatedResults = useMemo(() => {
    const map = new Map<string, VideoItem[]>();
    const keyOrder: string[] = [];

    results.forEach((item) => {
      const key = `${(item.vod_name || '').replaceAll(' ', '')}-${item.vod_year || 'unknown'}`;
      const arr = map.get(key) || [];
      if (arr.length === 0) keyOrder.push(key);
      arr.push(item);
      map.set(key, arr);
    });

    return keyOrder.map((key) => {
      const group = map.get(key)!;
      const sourceNames = Array.from(new Set(group.map((g) => (g as any).source_name).filter(Boolean)));
      return {
        key,
        title: group[0].vod_name,
        poster: group[0].vod_pic,
        year: group[0].vod_year || 'unknown',
        vod_id: group[0].vod_id,
        type_id: group[0].type_id,
        sourceCount: sourceNames.length || group.length,
        sources: sourceNames,
        item: group[0],
      };
    });
  }, [results]);

  return (
    <div className="px-4 sm:px-10 py-4 sm:py-8 overflow-visible mb-10">
      <div className="mb-8">
        <div className="max-w-2xl mx-auto">
          <SearchBar />
        </div>
      </div>

      <div className="max-w-[95%] mx-auto mt-12 overflow-visible">
        {loading && (
          <div className="flex justify-center items-center h-40">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500" />
          </div>
        )}

        {error && (
          <div className="text-center text-red-500 py-8">{error}</div>
        )}

        {!loading && !error && results.length === 0 && keyword && (
          <div className="text-center text-gray-500 dark:text-gray-400 py-8">未找到相关结果</div>
        )}

        {results.length > 0 && (
          <>
            {/* 标题 + 聚合开关 */}
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-800 dark:text-gray-200">
                搜索结果
                <span className="ml-2 text-sm font-normal text-gray-500 dark:text-gray-400">
                  {viewMode === 'agg' ? aggregatedResults.length : results.length} 个结果
                </span>
              </h2>
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <span className="text-sm text-gray-700 dark:text-gray-300">聚合</span>
                <div className="relative">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={viewMode === 'agg'}
                    onChange={() => setViewMode(viewMode === 'agg' ? 'all' : 'agg')}
                  />
                  <div className="w-9 h-5 bg-gray-300 rounded-full peer-checked:bg-green-500 transition-colors dark:bg-gray-600" />
                  <div className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-4" />
                </div>
              </label>
            </div>

            {/* 结果网格 */}
            <div className="grid grid-cols-3 gap-x-2 gap-y-12 sm:grid-cols-[repeat(auto-fill,minmax(160px,1fr))] sm:gap-x-8 sm:gap-y-20">
              {viewMode === 'agg'
                ? aggregatedResults.map((agg) => (
                    <div key={agg.key} className="w-full">
                      <VideoCard video={agg.item} from="vod" />
                      {agg.sourceCount > 1 && (
                        <div className="mt-1.5 flex justify-center">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-500/10 text-blue-600 dark:text-blue-400 text-xs font-medium rounded-full">
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                            {agg.sourceCount} 个源
                          </span>
                        </div>
                      )}
                    </div>
                  ))
                : results.map((item) => (
                    <div key={`${item.vod_id}-${item.type_name}`} className="w-full">
                      <VideoCard video={item} from="vod" />
                    </div>
                  ))
              }
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Search;
