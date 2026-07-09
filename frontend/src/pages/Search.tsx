import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import SearchBar from '../components/SearchBar';
import VideoCard from '../components/VideoCard';
import PageContainer from '../components/PageContainer';
import { useAutoFillColumns, AUTO_FILL_GRID, CARD_COLUMN_GAP } from '../components/gridColumns';
import type { VideoItem } from '../types';
import { streamSearchResults } from '../api/searchStream';
import { filterYellowItems, isExactMatch } from '../utils/filter';

interface StreamProgress {
  completed: number;
  total: number;
  currentSite: string;
}

interface SiteSearchResult {
  list: VideoItem[];
  site_key: string;
  name: string;
}

// Local Toggle component — eliminates duplicated toggle switch markup
const Toggle = ({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }) => (
  <label className="flex items-center gap-2 cursor-pointer select-none group">
    <span className="text-sm text-muted group-hover:text-text transition-colors">{label}</span>
    <div className="relative">
      <input type="checkbox" className="sr-only peer" checked={checked} onChange={onChange} />
      <div className="w-9 h-5 bg-surface rounded-full peer-checked:bg-primary transition-colors" />
      <div className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-4 shadow-sm" />
    </div>
  </label>
);

// ── Extracted sub-components ──────────────────────────────────────

const SearchProgressBar = ({ streamProgress, resultCount }: { streamProgress: StreamProgress; resultCount: number }) => (
  <div className="mb-6 bg-surface/50 backdrop-blur-sm rounded-xl p-4 border border-glass-border">
    <div className="flex items-center gap-3 mb-2">
      <div className="flex-shrink-0">
        <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
      <div className="flex-1">
        <div className="text-sm text-text font-medium">
          正在搜索 {streamProgress.completed}/{streamProgress.total} 个源
        </div>
      </div>
      {resultCount > 0 && (
        <div className="text-sm text-primary font-medium">
          已找到 {resultCount} 个结果
        </div>
      )}
    </div>
    <div className="w-full h-1.5 bg-card rounded-full overflow-hidden">
      <div
        className="h-full bg-primary rounded-full transition-all duration-300 ease-out"
        style={{ width: `${streamProgress.total > 0 ? (streamProgress.completed / streamProgress.total) * 100 : 0}%` }}
      />
    </div>
  </div>
);

const SourceCountBadge = ({ sourceCount }: { sourceCount: number }) => (
  sourceCount > 1 ? (
    <div className="mt-1.5 flex justify-center">
      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-500/10 text-blue-400 text-xs font-medium rounded-full">
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
        {sourceCount} 个源
      </span>
    </div>
  ) : null
);

const SearchResultHeader = ({
  viewMode,
  aggregatedLength,
  resultsLength,
  exactMatch,
  toggleExactMatch,
  onViewChange,
}: {
  viewMode: 'agg' | 'all';
  aggregatedLength: number;
  resultsLength: number;
  exactMatch: boolean;
  toggleExactMatch: () => void;
  onViewChange: () => void;
}) => (
  <div className="mb-6 flex items-center justify-between flex-wrap gap-3">
    <h2 className="text-xl font-bold text-text">
      搜索结果
      <span className="ml-2 text-sm font-normal text-muted">
        {viewMode === 'agg' ? aggregatedLength : resultsLength} 个结果
      </span>
    </h2>
    <div className="flex items-center gap-3">
      <Toggle label="精确匹配" checked={exactMatch} onChange={toggleExactMatch} />
      <Toggle
        label="聚合"
        checked={viewMode === 'agg'}
        onChange={onViewChange}
      />
    </div>
  </div>
);

const Search = () => {
  const [searchParams] = useSearchParams();
  const keyword = searchParams.get('wd') || '';
  const [results, setResults] = useState<VideoItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [streamProgress, setStreamProgress] = useState<StreamProgress | null>(null);
  const searchAbortRef = useRef<AbortController | null>(null);
  const [exactMatch, setExactMatch] = useState(() => {
    try {
      return localStorage.getItem('searchExactMatch') !== 'false';
    } catch { return true; }
  });

  const getDefaultAggregate = () => {
    try {
      const v = localStorage.getItem('defaultAggregateSearch');
      return v !== null ? JSON.parse(v) : true;
    } catch { return true; }
  };

  const [viewMode, setViewMode] = useState<'agg' | 'all'>(getDefaultAggregate() ? 'agg' : 'all');
  const searchColumns = useAutoFillColumns(150, 24, 2);
  // 首屏内的卡片用 eager 加载（消除 Chrome 懒加载干预），约一列数 × 视口可容纳行数
  const eagerCount = searchColumns * Math.ceil((typeof window !== 'undefined' ? window.innerHeight : 800) / 420);

  // 保存精确匹配设置
  const toggleExactMatch = () => {
    const newValue = !exactMatch;
    setExactMatch(newValue);
    try {
      localStorage.setItem('searchExactMatch', String(newValue));
    } catch {
      // Ignore storage failures; the in-memory toggle state is already updated.
    }
  };

  const handleViewChange = useCallback(() => {
    setViewMode(prev => prev === 'agg' ? 'all' : 'agg');
  }, []);

  useEffect(() => {
    if (keyword) searchVideos(keyword);
    return () => {
      searchAbortRef.current?.abort();
      searchAbortRef.current = null;
    };
  }, [keyword]);

  // SSE 流式搜索
  const searchVideos = (wd: string) => {
    setLoading(true);
    setError('');
    setResults([]);
    setStreamProgress({ completed: 0, total: 0, currentSite: '' });

    searchAbortRef.current?.abort();
    const controller = new AbortController();
    searchAbortRef.current = controller;

    // 只维护一个 siteResults 数组
    const siteResults: SiteSearchResult[] = [];

    streamSearchResults<SiteSearchResult>(wd, {
      onStart: (data) => {
        setStreamProgress({ completed: 0, total: data.site_count, currentSite: '' });
      },
      onResult: (data) => {
        const siteResult = data.data;
        if (siteResult) {
          // 添加 site_key 到 siteResult，供播放页复用
          siteResult.site_key = data.site;
          siteResult.name = data.name;
          siteResults.push(siteResult);
          // 从 siteResults 提取扁平列表用于显示
          const flatList = siteResults.flatMap(r => r.list || []);
          setResults(filterYellowItems(flatList));
        }
        setStreamProgress({
          completed: data.completed,
          total: data.total,
          currentSite: data.name,
        });
      },
      onTimeout: () => {
        setStreamProgress(prev => prev ? { ...prev, currentSite: '超时' } : null);
      },
      onDone: () => {
        setLoading(false);
        setStreamProgress(null);
        searchAbortRef.current = null;
        const flatList = siteResults.flatMap(r => r.list || []);
        setResults(filterYellowItems(flatList));

        // 存储 siteResults，供播放页面复用
        try {
          sessionStorage.setItem(`search_results:${wd}`, JSON.stringify(siteResults));
        } catch {
          // Ignore storage failures; search results remain visible in memory.
        }
      },
    }, { signal: controller.signal }).catch((err: unknown) => {
      if (controller.signal.aborted) return;
      setLoading(false);
      setStreamProgress(null);
      searchAbortRef.current = null;
      if (siteResults.length === 0) {
        const message = err instanceof Error ? err.message : '搜索连接失败';
        setError(message);
      }
    });
  };

  // 精确匹配筛选后的结果
  const filteredResults = useMemo(() => {
    if (!exactMatch || !keyword) return results;
    return results.filter((item) => isExactMatch(item.vod_name || '', keyword));
  }, [results, keyword, exactMatch]);

  // 聚合结果
  const aggregatedResults = useMemo(() => {
    const map = new Map<string, VideoItem[]>();
    const keyOrder: string[] = [];

    filteredResults.forEach((item) => {
      const key = `${(item.vod_name || '').replaceAll(' ', '')}-${item.vod_year || 'unknown'}`;
      const arr = map.get(key) || [];
      if (arr.length === 0) keyOrder.push(key);
      arr.push(item);
      map.set(key, arr);
    });

    return keyOrder.map((key) => {
      const group = map.get(key)!;
      const sourceNames = Array.from(new Set(group.map((g) => g.source_name).filter(Boolean)));
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
  }, [filteredResults]);

  return (
    <PageContainer className="mb-10">
      <div className="mb-8">
        <div className="max-w-2xl mx-auto">
          <SearchBar />
        </div>
      </div>

      <div className="max-w-[95%] mx-auto mt-12 overflow-visible">
        {/* 流式搜索进度 */}
        {streamProgress && (
          <SearchProgressBar streamProgress={streamProgress} resultCount={results.length} />
        )}

        {error && (
          <div className="text-center text-red-500 py-8">{error}</div>
        )}

        {!loading && !error && results.length === 0 && keyword && !streamProgress && (
          <div className="text-center text-muted py-8">未找到相关结果</div>
        )}

        {results.length > 0 && (
          <div className="content-fade-in">
            <SearchResultHeader
              viewMode={viewMode}
              aggregatedLength={aggregatedResults.length}
              resultsLength={filteredResults.length}
              exactMatch={exactMatch}
              toggleExactMatch={toggleExactMatch}
              onViewChange={handleViewChange}
            />

            {viewMode === 'agg' ? (
              <div
                className="gap-y-12 sm:gap-y-20"
                style={{ display: 'grid', gridTemplateColumns: AUTO_FILL_GRID, columnGap: CARD_COLUMN_GAP }}
              >
                {aggregatedResults.map((agg, i) => (
                  <div key={`${i}-${agg.item.vod_id}`} className="w-full">
                    <VideoCard video={agg.item} from="vod" animate={false} eager={i < eagerCount} showFavorite />
                    <SourceCountBadge sourceCount={agg.sourceCount} />
                  </div>
                ))}
              </div>
            ) : (
              <div
                className="gap-y-12 sm:gap-y-20"
                style={{ display: 'grid', gridTemplateColumns: AUTO_FILL_GRID, columnGap: CARD_COLUMN_GAP }}
              >
                {filteredResults.map((item, i) => (
                  <div key={`${i}-${item.vod_id}`} className="w-full">
                    <VideoCard video={item} from="vod" animate={false} eager={i < eagerCount} showFavorite />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </PageContainer>
  );
};

export default Search;
