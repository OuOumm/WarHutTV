import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import VideoCard from '../components/VideoCard';
import LazyGrid from '../components/LazyGrid';
import { getDoubanCategories } from '../api/douban';
import type { DoubanItem } from '../types';

interface SelectorOption {
  label: string;
  value: string;
}

const moviePrimaryOptions: SelectorOption[] = [
  { label: '热门', value: '热门' },
  { label: '最新', value: '最新' },
  { label: '豆瓣高分', value: '豆瓣高分' },
  { label: '冷门佳片', value: '冷门佳片' },
];

const movieSecondaryOptions: SelectorOption[] = [
  { label: '全部', value: '全部' },
  { label: '华语', value: '华语' },
  { label: '欧美', value: '欧美' },
  { label: '韩国', value: '韩国' },
  { label: '日本', value: '日本' },
];

const tvPrimaryOptions: SelectorOption[] = [
  { label: '最近热门', value: '最近热门' },
];

const tvSecondaryOptions: SelectorOption[] = [
  { label: '全部', value: 'tv' },
  { label: '国产', value: 'tv_domestic' },
  { label: '欧美', value: 'tv_american' },
  { label: '日本', value: 'tv_japanese' },
  { label: '韩国', value: 'tv_korean' },
];

const showPrimaryOptions: SelectorOption[] = [
  { label: '最近热门', value: '最近热门' },
];

const showSecondaryOptions: SelectorOption[] = [
  { label: '全部', value: 'show' },
  { label: '国内', value: 'show_domestic' },
  { label: '国外', value: 'show_foreign' },
];

const Selector = ({
  options,
  value,
  onChange,
}: {
  options: SelectorOption[];
  value: string;
  onChange: (v: string) => void;
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [indicator, setIndicator] = useState({ left: 0, width: 0 });

  useEffect(() => {
    const idx = options.findIndex((o) => o.value === value);
    if (idx >= 0 && buttonRefs.current[idx]) {
      const btn = buttonRefs.current[idx]!;
      setIndicator({ left: btn.offsetLeft, width: btn.offsetWidth });
    }
  }, [value, options]);

  return (
    <div ref={containerRef} className="relative inline-flex items-center bg-gray-100/80 dark:bg-gray-700/50 rounded-lg p-1">
      <div
        className="absolute top-1 bottom-1 bg-white dark:bg-gray-600 rounded-md shadow-sm transition-all duration-200"
        style={{ left: indicator.left, width: indicator.width }}
      />
      {options.map((opt, i) => (
        <button
          key={opt.value}
          ref={(el) => { buttonRefs.current[i] = el; }}
          onClick={() => onChange(opt.value)}
          className={`relative z-10 px-3 py-1.5 text-sm rounded-md transition-colors whitespace-nowrap ${
            value === opt.value
              ? 'text-green-600 dark:text-green-400 font-medium'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
};

export default function DoubanPage() {
  const [searchParams] = useSearchParams();
  const type = searchParams.get('type') || 'movie';

  const [data, setData] = useState<DoubanItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadingRef = useRef<HTMLDivElement>(null);

  const getDefaultPrimary = () => {
    if (type === 'movie') return '热门';
    return '最近热门';
  };

  const getDefaultSecondary = () => {
    if (type === 'movie') return '全部';
    if (type === 'tv') return 'tv';
    if (type === 'show') return 'show';
    return '全部';
  };

  const [primarySelection, setPrimarySelection] = useState(getDefaultPrimary);
  const [secondarySelection, setSecondarySelection] = useState(getDefaultSecondary);

  useEffect(() => {
    setPrimarySelection(getDefaultPrimary());
    setSecondarySelection(getDefaultSecondary());
    setPage(0);
    setData([]);
    setHasMore(true);
  }, [type]);

  const primaryOptions = type === 'movie' ? moviePrimaryOptions
    : type === 'tv' ? tvPrimaryOptions
    : type === 'show' ? showPrimaryOptions
    : [];

  const secondaryOptions = type === 'movie' ? movieSecondaryOptions
    : type === 'tv' ? tvSecondaryOptions
    : type === 'show' ? showSecondaryOptions
    : [];

  const loadData = useCallback(async (pageNum: number, reset: boolean) => {
    try {
      if (reset) setLoading(true);
      else setLoadingMore(true);

      const result = await getDoubanCategories({
        kind: type === 'movie' ? 'movie' : 'tv',
        category: primarySelection,
        type: secondarySelection,
        pageLimit: 25,
        pageStart: pageNum * 25,
      });

      if (result.code === 200) {
        setData((prev) => reset ? result.list : [...prev, ...result.list]);
        setHasMore(result.list.length === 25);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [type, primarySelection, secondarySelection]);

  useEffect(() => {
    loadData(0, true);
  }, [loadData]);

  useEffect(() => {
    if (!hasMore || loadingMore) return;
    if (!loadingRef.current) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setPage((p) => p + 1);
        }
      },
      { threshold: 0.1 }
    );
    observerRef.current.observe(loadingRef.current);

    return () => observerRef.current?.disconnect();
  }, [hasMore, loadingMore]);

  useEffect(() => {
    if (page > 0) loadData(page, false);
  }, [page, loadData]);

  const handlePrimaryChange = (v: string) => {
    setPrimarySelection(v);
    setPage(0);
    setData([]);
    setHasMore(true);
  };

  const handleSecondaryChange = (v: string) => {
    setSecondarySelection(v);
    setPage(0);
    setData([]);
    setHasMore(true);
  };

  const getTitle = () => {
    return type === 'movie' ? '电影' : type === 'tv' ? '电视剧' : type === 'show' ? '综艺' : '动漫';
  };

  return (
    <div className="px-4 sm:px-10 py-4 sm:py-8 overflow-visible">
      {/* Title */}
      <div className="mb-6 sm:mb-8 space-y-4 sm:space-y-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 dark:text-gray-200">{getTitle()}</h1>
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">来自豆瓣的精选内容</p>
        </div>

        {/* Selectors */}
        <div className="bg-white/60 dark:bg-gray-800/40 rounded-2xl p-4 sm:p-6 border border-gray-200/30 dark:border-gray-700/30 backdrop-blur-sm">
          <div className="space-y-3">
            {primaryOptions.length > 0 && (
              <div className="flex flex-wrap gap-2">
                <Selector options={primaryOptions} value={primarySelection} onChange={handlePrimaryChange} />
              </div>
            )}
            {secondaryOptions.length > 0 && (
              <div className="flex flex-wrap gap-2">
                <Selector options={secondaryOptions} value={secondarySelection} onChange={handleSecondaryChange} />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-[95%] mx-auto mt-8 overflow-visible">
        {loading ? (
          <div className="grid grid-cols-3 gap-x-2 gap-y-12 sm:grid-cols-[repeat(auto-fill,minmax(160px,1fr))] sm:gap-x-8 sm:gap-y-20">
            {Array.from({ length: 25 }).map((_, i) => (
              <div key={i}>
                <div className="aspect-[2/3] bg-gray-200 dark:bg-gray-800 rounded-lg animate-pulse" />
                <div className="mt-2 h-4 bg-gray-200 dark:bg-gray-800 rounded animate-pulse" />
              </div>
            ))}
          </div>
        ) : (
          <LazyGrid
            items={data}
            renderItem={(item, index) => (
              <VideoCard key={`${item.id}-${index}`} douban={item} from="douban" />
            )}
          />
        )}

        {/* Load more */}
        {hasMore && !loading && (
          <div ref={loadingRef} className="flex justify-center mt-12 py-8">
            {loadingMore && (
              <div className="flex items-center gap-2">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-green-500" />
                <span className="text-gray-600 dark:text-gray-400">加载中...</span>
              </div>
            )}
          </div>
        )}

        {!hasMore && data.length > 0 && (
          <div className="text-center text-gray-500 py-8">已加载全部内容</div>
        )}

        {!loading && data.length === 0 && (
          <div className="text-center text-gray-500 py-8">暂无相关内容</div>
        )}
      </div>
    </div>
  );
}
