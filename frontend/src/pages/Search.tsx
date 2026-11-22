import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import SearchBar from '../components/SearchBar';
import VideoCard from '../components/VideoCard';
import PageContainer from '../components/PageContainer';
import { useAutoFillColumns, AUTO_FILL_GRID, CARD_COLUMN_GAP } from '../components/gridColumns';
import type { VideoItem } from '../types';
import { streamSearchResults } from '../api/searchStream';
import { readSearchCache, writeSearchCache, writeSearchScroll } from '../store/searchCache';
import { addSearchHistory } from '../store/searchHistory';
import { filterYellowItems, isExactMatch, isExactMatchEnabled } from '../utils/filter';
import { aggregateKey, sortAggregated, sortItems, type SortMode } from '../utils/searchSort';

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
  sort,
  onSortChange,
  sources,
  activeSource,
  onSourceChange,
}: {
  viewMode: 'agg' | 'all';
  aggregatedLength: number;
  resultsLength: number;
  exactMatch: boolean;
  toggleExactMatch: () => void;
  onViewChange: () => void;
  sort: SortMode;
  onSortChange: (mode: SortMode) => void;
  sources: string[];
  activeSource: string;
  onSourceChange: (source: string) => void;
}) => (
  <div className="mb-6 space-y-3">
    <div className="flex items-center justify-between flex-wrap gap-3">
      <h2 className="text-xl font-bold text-text">
        搜索结果
        <span className="ml-2 text-sm font-normal text-muted">
          {viewMode === 'agg' ? aggregatedLength : resultsLength} 个结果
        </span>
      </h2>
      <div className="flex items-center gap-3 flex-wrap">
        <label className="flex items-center gap-2 text-sm text-muted">
          <span className="hidden sm:inline">排序</span>
          <select
            value={sort}
            onChange={(e) => onSortChange(e.target.value as SortMode)}
            aria-label="结果排序"
            className="px-2.5 py-1.5 text-sm bg-glass border border-glass-border rounded-lg text-text focus:outline-none focus:ring-2 focus:ring-primary/40"
          >
            <option value="default">默认</option>
            <option value="year-desc">年份（新→旧）</option>
            <option value="year-asc">年份（旧→新）</option>
            <option value="sources">源数量（多→少）</option>
          </select>
        </label>
        <Toggle label="精确匹配" checked={exactMatch} onChange={toggleExactMatch} />
        <Toggle
          label="聚合"
          checked={viewMode === 'agg'}
          onChange={onViewChange}
        />
      </div>
    </div>

    {sources.length > 1 && (
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-muted">来源</span>
        <button
          type="button"
          onClick={() => onSourceChange('')}
          aria-pressed={activeSource === ''}
          className={`px-2.5 py-1 rounded-full text-xs transition-colors border ${
            activeSource === ''
              ? 'bg-primary text-deep border-primary font-medium'
              : 'bg-glass text-muted border-glass-border hover:text-text'
          }`}
        >
          全部
        </button>
        {sources.map((source) => (
          <button
            key={source}
            type="button"
            onClick={() => onSourceChange(source)}
            aria-pressed={activeSource === source}
            className={`px-2.5 py-1 rounded-full text-xs transition-colors border max-w-[12rem] truncate ${
              activeSource === source
                ? 'bg-primary text-deep border-primary font-medium'
                : 'bg-glass text-muted border-glass-border hover:text-text'
            }`}
          >
            {source}
          </button>
        ))}
      </div>
    )}
  </div>
);

const Search = () => {
  const [searchParams] = useSearchParams();
  const keyword = searchParams.get('wd') || '';
  // Seed from the session cache so coming back from the play page renders the
  // previous results immediately instead of an empty page plus a re-search.
  const [results, setResults] = useState<VideoItem[]>(() => {
    if (!keyword) return [];
    const cached = readSearchCache(keyword);
    return cached ? filterYellowItems(cached.results) : [];
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [streamProgress, setStreamProgress] = useState<StreamProgress | null>(null);
  const searchAbortRef = useRef<AbortController | null>(null);
  // 默认关闭：精确匹配会把「凡人修仙传」这类片名全滤掉，导致进度显示
  // 「已找到 338 个」而标题却写「0 个结果」。只有用户主动开启过才打开。
  const [exactMatch, setExactMatch] = useState(() => {
    try {
      return isExactMatchEnabled(localStorage.getItem('searchExactMatch'));
    } catch { return false; }
  });

  const getDefaultAggregate = () => {
    try {
      const v = localStorage.getItem('defaultAggregateSearch');
      return v !== null ? JSON.parse(v) : true;
    } catch { return true; }
  };

  const [viewMode, setViewMode] = useState<'agg' | 'all'>(getDefaultAggregate() ? 'agg' : 'all');
  const [sort, setSort] = useState<SortMode>('default');
  const [activeSource, setActiveSource] = useState('');
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
    if (!keyword) return;

    // Record the keyword here rather than in the search box: the box is only
    // one of several entry points. Clicking a 豆瓣/Bangumi recommendation on the
    // home page navigates straight to `/search?wd=…`, and a bookmarked or
    // pasted URL never goes through the form at all. Recording on display
    // covers every path, and repeated keywords just move to the front.
    addSearchHistory(keyword);

    // A fresh cache hit means these results are already on screen from the
    // initialiser above. Re-running the SSE search would throw them away and
    // make "back" cost another few seconds.
    const cached = readSearchCache(keyword);
    if (cached) {
      setStreamProgress(null);
      setLoading(false);
      if (cached.scrollY > 0) {
        // Restore once the grid has painted and the document is tall enough to
        // accept the offset.
        requestAnimationFrame(() => {
          requestAnimationFrame(() => window.scrollTo(0, cached.scrollY));
        });
      }
      return;
    }

    searchVideos(keyword);
    return () => {
      searchAbortRef.current?.abort();
      searchAbortRef.current = null;
    };
  }, [keyword]);

  // Remember the reading position so returning to this keyword lands in the
  // same spot.
  //
  // Recorded on click (capture phase, so it runs before the card's <Link>
  // navigates) rather than from a scroll listener: `ScrollToTop` resets the
  // window on every pathname change, and that reset can beat both the listener
  // and the unmount cleanup, overwriting the real offset with 0.
  const rememberScroll = useCallback(() => {
    if (!keyword) return;
    try {
      writeSearchScroll(keyword, window.scrollY);
    } catch {
      // A failed save only costs the scroll position, never the results.
    }
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
      // Discarded/timed-out sources are not results, but they still count as
      // finished — without this the progress bar stalls at "24/27".
      onErrorEvent: (data) => {
        setStreamProgress(prev => ({
          completed: data.completed ?? prev?.completed ?? 0,
          total: data.total ?? prev?.total ?? 0,
          currentSite: data.discarded ? `${data.name} 超时丢弃` : (data.name || '失败'),
        }));
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

        // Cache for the back-navigation path. A fresh search also resets the
        // remembered reading position, because the user is looking at the top.
        writeSearchCache(wd, filterYellowItems(flatList));
        writeSearchScroll(wd, 0);

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

  // 按来源筛选（点击头部某一行源名），空串表示全部
  const sourceOptions = useMemo(() => {
    const names = new Set<string>();
    results.forEach((item) => {
      if (item.source_name) names.add(item.source_name);
    });
    return Array.from(names).sort((a, b) => a.localeCompare(b, 'zh-Hans-CN'));
  }, [results]);

  // 精确匹配 + 来源筛选后的结果
  const filteredResults = useMemo(() => {
    let list = results;
    if (exactMatch && keyword) {
      list = list.filter((item) => isExactMatch(item.vod_name || '', keyword));
    }
    if (activeSource) {
      list = list.filter((item) => item.source_name === activeSource);
    }
    return list;
  }, [results, keyword, exactMatch, activeSource]);

  // 聚合结果
  const aggregatedResults = useMemo(() => {
    const map = new Map<string, VideoItem[]>();
    const keyOrder: string[] = [];

    filteredResults.forEach((item) => {
      // 复用 normalizeString（去空格+标点+转小写），否则《片名》与「片名」会被
      // 拆成两张卡片——这里原来只做了 replaceAll(' ','')。
      const key = aggregateKey(item);
      const arr = map.get(key) || [];
      if (arr.length === 0) keyOrder.push(key);
      arr.push(item);
      map.set(key, arr);
    });

    const aggregated = keyOrder.map((key) => {
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

    // Sorting is applied at render time only; the streaming order is preserved
    // in `results` so switching back to "默认" is instant and lossless.
    return sortAggregated(aggregated, sort);
  }, [filteredResults, sort]);

  // The non-aggregated grid honours the same ordering. "sources" needs the
  // per-title source counts from the aggregation step above.
  const sortedResults = useMemo(() => {
    const counts = new Map<string, number>();
    if (sort === 'sources') {
      aggregatedResults.forEach((agg) => counts.set(agg.key, agg.sourceCount));
    }
    return sortItems(filteredResults, sort, counts);
  }, [filteredResults, sort, aggregatedResults]);

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
          <div className="content-fade-in" onClickCapture={rememberScroll}>
            <SearchResultHeader
              viewMode={viewMode}
              aggregatedLength={aggregatedResults.length}
              resultsLength={filteredResults.length}
              exactMatch={exactMatch}
              toggleExactMatch={toggleExactMatch}
              onViewChange={handleViewChange}
              sort={sort}
              onSortChange={setSort}
              sources={sourceOptions}
              activeSource={activeSource}
              onSourceChange={setActiveSource}
            />

            {viewMode === 'agg' ? (
              <div
                className="gap-y-12 sm:gap-y-20"
                style={{ display: 'grid', gridTemplateColumns: AUTO_FILL_GRID, columnGap: CARD_COLUMN_GAP }}
              >
                {aggregatedResults.map((agg, i) => (
                  <div key={`${i}-${agg.item.vod_id}`} className="w-full">
                    <VideoCard video={agg.item} from="vod" animate={false} eager={i < eagerCount} showFavorite linkState={{ searchKeyword: keyword }} />
                    <SourceCountBadge sourceCount={agg.sourceCount} />
                  </div>
                ))}
              </div>
            ) : (
              <div
                className="gap-y-12 sm:gap-y-20"
                style={{ display: 'grid', gridTemplateColumns: AUTO_FILL_GRID, columnGap: CARD_COLUMN_GAP }}
              >
                {sortedResults.map((item, i) => (
                  <div key={`${i}-${item.vod_id}`} className="w-full">
                    <VideoCard video={item} from="vod" animate={false} eager={i < eagerCount} showFavorite linkState={{ searchKeyword: keyword }} />
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
