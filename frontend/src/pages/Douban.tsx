import { useState, useEffect, useCallback, useRef, useLayoutEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import VideoCard from '../components/VideoCard';
import PageContainer from '../components/PageContainer';
import VideoGrid from '../components/VideoGrid';
import { useAutoFillColumns, AUTO_FILL_GRID, CARD_COLUMN_GAP } from '../components/gridColumns';
import WeekdaySelector, { getTodayWeekday } from '../components/WeekdaySelector';
import { getDoubanCategories, getDoubanRecommends } from '../api/douban';
import { getBangumiCalendar } from '../api/bangumi';
import type { DoubanItem, BangumiItem } from '../types';

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

// 动漫一级分类
const animePrimaryOptions: SelectorOption[] = [
  { label: '每日放送', value: '每日放送' },
  { label: '番剧', value: '番剧' },
  { label: '剧场版', value: '剧场版' },
];

// 动漫地区筛选（番剧/剧场版）
const animeRegionOptions: SelectorOption[] = [
  { label: '全部', value: 'all' },
  { label: '日本', value: '日本' },
  { label: '华语', value: '华语' },
  { label: '欧美', value: '欧美' },
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
  const activeIndex = options.findIndex((o) => o.value === value);
  const btnRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [indicator, setIndicator] = useState<{ left: number; width: number }>({ left: 0, width: 0 });

  useLayoutEffect(() => {
    const btn = btnRefs.current[activeIndex];
    if (!btn) return;
    // Get offset relative to the container
    const container = btn.parentElement as HTMLElement;
    if (!container) return;
    const cRect = container.getBoundingClientRect();
    const bRect = btn.getBoundingClientRect();
    setIndicator({
      left: bRect.left - cRect.left,
      width: bRect.width,
    });
  }, [activeIndex]);

  return (
    <div className="relative inline-flex items-center bg-surface rounded-lg p-1">
      <div
        className="absolute top-1 bottom-1 bg-card rounded-md shadow-sm transition-all duration-200"
        style={{
          width: indicator.width,
          left: indicator.left,
          pointerEvents: 'none',
        }}
      />
      {options.map((opt, i) => (
        <button
          key={opt.value}
          ref={(el) => { btnRefs.current[i] = el; }}
          onClick={() => onChange(opt.value)}
          className={`relative z-10 px-3 py-1.5 text-sm rounded-md transition-colors whitespace-nowrap ${
            value === opt.value
              ? 'text-primary font-medium'
              : 'text-muted hover:text-text'
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

  // 番剧日历数据（每日放送）
  const [bangumiData, setBangumiData] = useState<{ weekday: { en: string }; items: BangumiItem[] }[]>([]);

  const getDefaultPrimary = () => {
    if (type === 'movie') return '热门';
    if (type === 'anime') return '每日放送';
    return '最近热门';
  };

  const getDefaultSecondary = () => {
    if (type === 'movie') return '全部';
    if (type === 'tv') return 'tv';
    if (type === 'show') return 'show';
    if (type === 'anime') return 'all'; // 地区
    return '全部';
  };

  const [primarySelection, setPrimarySelection] = useState(getDefaultPrimary);
  const [secondarySelection, setSecondarySelection] = useState(getDefaultSecondary);
  const [selectedWeekday, setSelectedWeekday] = useState(getTodayWeekday);

  // type 变化时重置选择器
  useEffect(() => {
    setPrimarySelection(getDefaultPrimary());
    setSecondarySelection(getDefaultSecondary());
    setPage(0);
    setData([]);
    setHasMore(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type]);

  const primaryOptions = type === 'movie' ? moviePrimaryOptions
    : type === 'tv' ? tvPrimaryOptions
    : type === 'show' ? showPrimaryOptions
    : type === 'anime' ? animePrimaryOptions
    : [];

  const secondaryOptions = type === 'movie' ? movieSecondaryOptions
    : type === 'tv' ? tvSecondaryOptions
    : type === 'show' ? showSecondaryOptions
    : type === 'anime' ? animeRegionOptions
    : [];

  // 动漫"每日放送"模式下，加载一次 bangumi 日历
  useEffect(() => {
    if (type !== 'anime' || primarySelection !== '每日放送') return;
    if (bangumiData.length > 0) return;
    getBangumiCalendar().then(setBangumiData).catch(() => {});
  }, [type, primarySelection, bangumiData.length]);

  const loadData = useCallback(async (pageNum: number, reset: boolean) => {
    // 动漫"每日放送"模式不走分页网络请求，由日历数据驱动，单独处理
    if (type === 'anime' && primarySelection === '每日放送') {
      setLoading(true);
      try {
        const calendar = bangumiData.length > 0 ? bangumiData : await getBangumiCalendar();
        const weekdayData = calendar.find((item) => item.weekday.en === selectedWeekday);
        const items = weekdayData?.items || [];
        const list: DoubanItem[] = items.map((item) => ({
          id: String(item.id),
          title: item.name_cn || item.name,
          poster: item.images?.large || item.images?.common || item.images?.medium || '',
          rate: item.rating?.score ? item.rating.score.toFixed(1) : '',
          year: item.air_date?.split('-')?.[0] || '',
        }));
        setData(list);
        setHasMore(false); // 每日放送不分页
      } catch {
        setData([]);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
      return;
    }

    try {
      if (reset) setLoading(true);
      else setLoadingMore(true);

      let result;
      // 动漫 番剧/剧场版：走豆瓣 recommend API，category=动画
      if (type === 'anime') {
        const kind = primarySelection === '番剧' ? 'tv' : 'movie';
        const format = primarySelection === '番剧' ? '电视剧' : '';
        result = await getDoubanRecommends({
          kind,
          category: '动画',
          format,
          region: secondarySelection,
          pageLimit: 25,
          pageStart: pageNum * 25,
        });
      } else {
        result = await getDoubanCategories({
          kind: type === 'movie' ? 'movie' : 'tv',
          category: primarySelection,
          type: secondarySelection,
          pageLimit: 25,
          pageStart: pageNum * 25,
        });
      }

      if (result.code === 200) {
        if (result.list.length > 0) {
          setData((prev) => reset ? result.list : [...prev, ...result.list]);
        }
        setHasMore(result.list.length > 0);
      } else {
        setHasMore(false);
      }
    } catch (err) {
      console.error(err);
      setHasMore(false);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [type, primarySelection, secondarySelection, selectedWeekday, bangumiData]);

  useEffect(() => {
    loadData(0, true);
  }, [loadData]);

  // 每日放送切换星期时重新渲染（基于已有 bangumiData，无需新网络请求）
  useEffect(() => {
    if (type === 'anime' && primarySelection === '每日放送' && bangumiData.length > 0) {
      loadData(0, true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedWeekday]);

  useEffect(() => {
    if (!hasMore || loadingMore || loading) return;
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
  }, [hasMore, loadingMore, loading]);

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

  // 固定卡片宽、自动填充列数（最少 2 列），首屏内卡片用 eager 加载
  const columns = useAutoFillColumns(150, 24, 2);
  const eagerCount = columns * Math.ceil((typeof window !== 'undefined' ? window.innerHeight : 800) / 340);

  const getTitle = () => {
    return type === 'movie' ? '电影' : type === 'tv' ? '电视剧' : type === 'show' ? '综艺' : '动漫';
  };

  const getDescription = () => {
    if (type === 'anime' && primarySelection === '每日放送') {
      return '来自 Bangumi 番组计划的精选内容';
    }
    return '来自豆瓣的精选内容';
  };

  // 动漫每日放送模式：不显示地区二级选择器，改显示星期选择器
  const showWeekdaySelector = type === 'anime' && primarySelection === '每日放送';
  const showSecondarySelector = type !== 'anime' || primarySelection !== '每日放送';

  return (
    <PageContainer>
      {/* Title */}
      <div className="mb-6 sm:mb-8 space-y-4 sm:space-y-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-text">{getTitle()}</h1>
          <p className="text-sm sm:text-base text-muted">{getDescription()}</p>
        </div>

        {/* Selectors */}
        <div className="bg-glass rounded-2xl p-4 sm:p-6 border border-glass-border backdrop-blur-sm">
          <div className="space-y-3">
            {primaryOptions.length > 0 && (
              <div className="flex flex-wrap gap-2">
                <span className="text-xs sm:text-sm font-medium text-muted min-w-[48px] self-center">分类</span>
                <Selector options={primaryOptions} value={primarySelection} onChange={handlePrimaryChange} />
              </div>
            )}
            {showWeekdaySelector && (
              <div className="flex gap-2 items-center">
                <span className="text-xs sm:text-sm font-medium text-muted min-w-[48px] self-center">星期</span>
                <div className="overflow-x-auto scrollbar-hide min-w-0">
                  <WeekdaySelector value={selectedWeekday} onChange={setSelectedWeekday} className="min-w-max" />
                </div>
              </div>
            )}
            {showSecondarySelector && secondaryOptions.length > 0 && (
              <div className="flex flex-wrap gap-2">
                <span className="text-xs sm:text-sm font-medium text-muted min-w-[48px] self-center">
                  {type === 'anime' ? '地区' : '类型'}
                </span>
                <Selector options={secondaryOptions} value={secondarySelection} onChange={handleSecondaryChange} />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-[95%] mx-auto mt-8 overflow-visible content-fade-in">
        {loading ? (
          <VideoGrid variant="search">
            {Array.from({ length: 25 }).map((_, i) => (
              <div key={i}>
                <div className="aspect-[2/3] bg-card rounded-lg animate-pulse" />
                <div className="mt-2 h-4 bg-card rounded animate-pulse" />
              </div>
            ))}
          </VideoGrid>
        ) : (
          <div
            className="gap-y-8"
            style={{ display: 'grid', gridTemplateColumns: AUTO_FILL_GRID, columnGap: CARD_COLUMN_GAP }}
          >
            {data.map((item, i) => (
              <div key={item.id} className="w-full">
                <VideoCard douban={item} from="douban" eager={i < eagerCount} />
              </div>
            ))}
          </div>
        )}

        {/* Load more */}
        {hasMore && !loading && (
          <div ref={loadingRef} className={loadingMore ? 'flex justify-center mt-12 py-8' : 'h-px'}>
            {loadingMore && (
              <div className="flex items-center gap-2">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
                <span className="text-muted">加载中...</span>
              </div>
            )}
          </div>
        )}

        {!hasMore && !loading && (
          <div className="text-center text-muted py-8">
            {data.length > 0 ? '已加载全部内容' : '暂无相关内容'}
          </div>
        )}
      </div>
    </PageContainer>
  );
}
