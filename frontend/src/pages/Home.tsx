import { useState, useEffect, useRef, useMemo, useCallback, memo } from 'react';
import { Link } from 'react-router-dom';

import VideoCard from '../components/VideoCard';
import ScrollableRow from '../components/ScrollableRow';
import CapsuleSwitch from '../components/CapsuleSwitch';
import { getDoubanCategories } from '../api/douban';
import { getBangumiCalendar } from '../api/bangumi';
import { historyStore } from '../store/history';
import { favoritesStore } from '../store/favorites';
import { useConfig } from '../store/config';
import type { DoubanItem, BangumiCalendarData } from '../types';

// Section with scroll reveal
const Section = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); observer.disconnect(); } },
      { threshold: 0.1, rootMargin: '50px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`transition-all duration-500 ease-out ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
      } ${className}`}
    >
      {children}
    </div>
  );
};

const SectionHeader = ({ title, href, icon }: { title: string; href?: string; icon?: React.ReactNode }) => (
  <div className="mb-4 flex items-center justify-between">
    <h2 className="text-xl font-bold text-text flex items-center gap-2.5">
      {icon && <span className="text-primary/80">{icon}</span>}
      {title}
    </h2>
    {href && (
      <Link to={href} className="flex items-center text-sm text-muted hover:text-primary transition-colors duration-200 group/link">
        查看更多
        <svg className="w-4 h-4 ml-1 transition-transform duration-200 group-hover/link:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
      </Link>
    )}
  </div>
);

// Section icons - 提取为静态常量，避免每次渲染重新创建
const FilmIcon = memo(() => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
  </svg>
));

const TvIcon = memo(() => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
  </svg>
));

const StarIcon = memo(() => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
  </svg>
));

const ClockIcon = memo(() => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
));

const Home = () => {
  const [activeTab, setActiveTab] = useState('home');
  const [hotMovies, setHotMovies] = useState<DoubanItem[]>([]);
  const [hotTvShows, setHotTvShows] = useState<DoubanItem[]>([]);
  const [hotVariety, setHotVariety] = useState<DoubanItem[]>([]);
  const [bangumiData, setBangumiData] = useState<BangumiCalendarData[]>([]);
  const [continueWatching, setContinueWatching] = useState<any[]>([]);
  const [favoriteItems, setFavoriteItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { siteName } = useConfig();
  

  useEffect(() => {
    loadCachedData();
    refreshData();
  }, []);

  useEffect(() => {
    if (activeTab === 'favorites') {
      favoritesStore.getAll().then(setFavoriteItems).catch(() => {});
    }
  }, [activeTab]);

  const loadCachedData = (): boolean => {
    try {
      let hit = false;
      const moviesRaw = localStorage.getItem('douban_cache_cat:movie:热门:全部:20:0');
      const tvRaw = localStorage.getItem('douban_cache_cat:tv:tv:tv:20:0');
      const bangumiRaw = localStorage.getItem('bangumi_calendar');

      if (moviesRaw) {
        const entry = JSON.parse(moviesRaw);
        if (Date.now() < entry.expiry) { setHotMovies(entry.data.list || []); hit = true; }
      }
      if (tvRaw) {
        const entry = JSON.parse(tvRaw);
        if (Date.now() < entry.expiry) { setHotTvShows(entry.data.list || []); hit = true; }
      }
      if (bangumiRaw) {
        const entry = JSON.parse(bangumiRaw);
        if (Date.now() < entry.expiry) { setBangumiData(entry.data || []); hit = true; }
      }
      return hit;
    } catch {
      return false;
    }
  };

  const refreshData = async () => {
    try {
      const primary = await Promise.allSettled([
        getDoubanCategories({ kind: 'movie', category: '热门', type: '全部' }),
        getDoubanCategories({ kind: 'tv', category: 'tv', type: 'tv' }),
      ]);
      if (primary[0].status === 'fulfilled' && primary[0].value.code === 200) setHotMovies(primary[0].value.list);
      if (primary[1].status === 'fulfilled' && primary[1].value.code === 200) setHotTvShows(primary[1].value.list);

      const varietyRes = await getDoubanCategories({ kind: 'tv', category: 'show', type: 'show' });
      if (varietyRes.code === 200) setHotVariety(varietyRes.list);
    } catch (err) {
      console.error('刷新数据失败:', err);
    }

    historyStore.getRecent(20).then(setContinueWatching).catch(() => {});
    favoritesStore.getAll().then(setFavoriteItems).catch(() => {});
    getBangumiCalendar().then(setBangumiData).catch(() => {});

    
    setLoading(false);
  };

  // 使用 useMemo 缓存今日番剧数据，避免每次渲染重新计算
  const todayBangumi = useMemo(() => {
    const today = new Date();
    const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const currentWeekday = weekdays[today.getDay()];
    const todayData = bangumiData.find((item) => item.weekday.en === currentWeekday);
    return todayData?.items || [];
  }, [bangumiData]);

  // 使用 useCallback 缓存清空历史记录的函数
  const handleClearHistory = useCallback(async () => {
    await historyStore.clear();
    setContinueWatching([]);
  }, []);

  // 使用 useCallback 缓存清空收藏夹的函数
  const handleClearFavorites = useCallback(async () => {
    await favoritesStore.clear();
    setFavoriteItems([]);
  }, []);

  return (
    <div className="px-2 sm:px-10 py-4 sm:py-8 overflow-visible page-enter">
      <div className="mb-8 flex justify-center">
        <CapsuleSwitch
          options={[
            { label: '首页', value: 'home' },
            { label: '收藏夹', value: 'favorites' },
          ]}
          active={activeTab}
          onChange={setActiveTab}
        />
      </div>

      {activeTab === 'home' ? (
          loading ? (
            <div className="space-y-8">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i}>
                  <div className="h-6 w-32 bg-surface rounded-lg animate-pulse mb-4" />
                  <div className="grid grid-cols-5 sm:grid-cols-8 gap-3 sm:gap-5">
                    {Array.from({ length: 10 }).map((_, j) => (
                      <div key={j} className="w-full">
                        <div className="aspect-[2/3] bg-surface rounded-xl animate-pulse" />
                        <div className="mt-2.5 h-4 bg-surface rounded animate-pulse w-3/4" />
                        <div className="mt-1.5 h-3 bg-surface/60 rounded animate-pulse w-1/2" />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-10">
              {continueWatching.length > 0 && (
                <Section>
                  <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-xl font-bold text-text flex items-center gap-2.5">
                      <ClockIcon />
                      继续观看
                    </h2>
                    <button onClick={handleClearHistory} className="text-sm text-muted hover:text-primary transition-colors">清空</button>
                  </div>
                  <ScrollableRow>
                    {continueWatching.map((item: any) => (
                      <VideoCard 
                        key={item.vod_name} 
                        video={item} 
                        from="vod" 
                        showActions 
                        onDelete={async () => {
                          await historyStore.removeByName(item.vod_name);
                          setContinueWatching(prev => prev.filter((i: any) => i.vod_name !== item.vod_name));
                        }} 
                      />
                    ))}
                  </ScrollableRow>
                </Section>
              )}

              {hotMovies.length > 0 && (
                <Section>
                  <SectionHeader title="热门电影" href="/douban?type=movie" icon={<FilmIcon />} />
                  <ScrollableRow>
                    {hotMovies.map((movie) => (
                      <VideoCard key={movie.id} douban={movie} from="douban" />
                    ))}
                  </ScrollableRow>
                </Section>
              )}

              {hotTvShows.length > 0 && (
                <Section>
                  <SectionHeader title="热门剧集" href="/douban?type=tv" icon={<TvIcon />} />
                  <ScrollableRow>
                    {hotTvShows.map((show) => (
                      <VideoCard key={show.id} douban={show} from="douban" />
                    ))}
                  </ScrollableRow>
                </Section>
              )}

              {todayBangumi.length > 0 && (
                <Section>
                  <SectionHeader title="新番放送" href="/douban?type=anime" icon={<StarIcon />} />
                  <ScrollableRow>
                    {todayBangumi.map((anime) => (
                      <VideoCard key={anime.id} bangumi={anime} from="bangumi" />
                    ))}
                  </ScrollableRow>
                </Section>
              )}

              {hotVariety.length > 0 && (
                <Section>
                  <SectionHeader title="热门综艺" href="/douban?type=show" icon={<StarIcon />} />
                  <ScrollableRow>
                    {hotVariety.map((show) => (
                      <VideoCard key={show.id} douban={show} from="douban" />
                    ))}
                  </ScrollableRow>
                </Section>
              )}

              {!loading && hotMovies.length === 0 && hotTvShows.length === 0 && (
                <div className="text-center text-muted py-20">
                  <div className="w-16 h-16 rounded-full bg-surface mx-auto mb-4 flex items-center justify-center">
                    <svg className="w-8 h-8 text-primary/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                  <p className="text-lg text-text/80">欢迎使用 {siteName}</p>
                  <p className="mt-2 text-sm">使用搜索栏查找你想看的影片</p>
                </div>
              )}
            </div>
          )
        ) : (
          <Section>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-text">我的收藏</h2>
              {favoriteItems.length > 0 && (
                <button onClick={handleClearFavorites} className="text-sm text-muted hover:text-primary transition-colors">清空</button>
              )}
            </div>
            {favoriteItems.length === 0 ? (
              <div className="text-center text-muted py-20">
                <div className="w-16 h-16 rounded-full bg-surface mx-auto mb-4 flex items-center justify-center">
                  <svg className="w-8 h-8 text-primary/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                  </svg>
                </div>
                <p className="text-lg text-text/80">暂无收藏内容</p>
                <p className="mt-2 text-sm">浏览影片时点击爱心图标收藏</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-x-2 gap-y-12 sm:grid-cols-[repeat(auto-fill,180px)] sm:gap-x-6 sm:gap-y-16 px-4 sm:px-6 py-1 sm:py-2 pb-12 sm:pb-14">
                {favoriteItems.map((item: any) => (
                  <div key={item.vod_id} className="w-full">
                    <VideoCard video={item} from="vod" showActions onDelete={async () => {
                      await favoritesStore.remove(item.vod_id);
                      setFavoriteItems(prev => prev.filter((i: any) => i.vod_id !== item.vod_id));
                    }} />
                  </div>
                ))}
              </div>
            )}
          </Section>
        )}
    </div>
  );
};

export default Home;
