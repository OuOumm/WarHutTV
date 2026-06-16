import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

import VideoCard from '../components/VideoCard';
import ScrollableRow from '../components/ScrollableRow';
import CapsuleSwitch from '../components/CapsuleSwitch';
import { getDoubanCategories } from '../api/douban';
import { getBangumiCalendar } from '../api/bangumi';
import { historyStore } from '../store/history';
import { favoritesStore } from '../store/favorites';
import type { DoubanItem, BangumiCalendarData } from '../types';

const SectionHeader = ({ title, href }: { title: string; href?: string }) => (
  <div className="mb-4 flex items-center justify-between">
    <h2 className="text-xl font-bold text-gray-800 dark:text-gray-200">{title}</h2>
    {href && (
      <Link to={href} className="flex items-center text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
        查看更多
        <svg className="w-4 h-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
      </Link>
    )}
  </div>
);

const Home = () => {
  const [activeTab, setActiveTab] = useState('home');
  const [hotMovies, setHotMovies] = useState<DoubanItem[]>([]);
  const [hotTvShows, setHotTvShows] = useState<DoubanItem[]>([]);
  const [hotVariety, setHotVariety] = useState<DoubanItem[]>([]);
  const [bangumiData, setBangumiData] = useState<BangumiCalendarData[]>([]);
  const [continueWatching, setContinueWatching] = useState<any[]>([]);
  const [favoriteItems, setFavoriteItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  

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

  const getTodayBangumi = () => {
    const today = new Date();
    const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const currentWeekday = weekdays[today.getDay()];
    const todayData = bangumiData.find((item) => item.weekday.en === currentWeekday);
    return todayData?.items || [];
  };

  return (
    <div className="px-2 sm:px-10 py-4 sm:py-8 overflow-visible">
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

      <div className="max-w-[95%] mx-auto">
        {activeTab === 'home' ? (
          loading ? (
            <div className="space-y-8">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i}>
                  <div className="h-6 w-32 bg-gray-200 dark:bg-gray-800 rounded animate-pulse mb-4" />
                  <div className="flex space-x-6 overflow-hidden px-4 sm:px-6 py-2">
                    {Array.from({ length: 6 }).map((_, j) => (
                      <div key={j} className="min-w-[120px] w-[140px] sm:min-w-[160px] sm:w-[180px] flex-shrink-0">
                        <div className="aspect-[2/3] bg-gray-200 dark:bg-gray-800 rounded-lg animate-pulse" />
                        <div className="mt-2 h-4 bg-gray-200 dark:bg-gray-800 rounded animate-pulse" />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-8">
              {continueWatching.length > 0 && (
                <section className="mb-8">
                  <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-xl font-bold text-gray-800 dark:text-gray-200">继续观看</h2>
                    <button onClick={async () => { await historyStore.clear(); setContinueWatching([]); }} className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">清空</button>
                  </div>
                  <ScrollableRow>
                    {continueWatching.map((item: any) => (
                      <VideoCard key={item.vod_id} video={item} from="vod" showActions onDelete={() => setContinueWatching(prev => prev.filter((i: any) => i.vod_id !== item.vod_id))} />
                    ))}
                  </ScrollableRow>
                </section>
              )}

              {hotMovies.length > 0 && (
                <section className="mb-8">
                  <SectionHeader title="热门电影" href="/douban?type=movie" />
                  <ScrollableRow>
                    {hotMovies.map((movie) => (
                      <VideoCard key={movie.id} douban={movie} from="douban" />
                    ))}
                  </ScrollableRow>
                </section>
              )}

              {hotTvShows.length > 0 && (
                <section className="mb-8">
                  <SectionHeader title="热门剧集" href="/douban?type=tv" />
                  <ScrollableRow>
                    {hotTvShows.map((show) => (
                      <VideoCard key={show.id} douban={show} from="douban" />
                    ))}
                  </ScrollableRow>
                </section>
              )}

              {getTodayBangumi().length > 0 && (
                <section className="mb-8">
                  <SectionHeader title="新番放送" href="/douban?type=anime" />
                  <ScrollableRow>
                    {getTodayBangumi().map((anime) => (
                      <VideoCard key={anime.id} bangumi={anime} from="bangumi" />
                    ))}
                  </ScrollableRow>
                </section>
              )}

              {hotVariety.length > 0 && (
                <section className="mb-8">
                  <SectionHeader title="热门综艺" href="/douban?type=show" />
                  <ScrollableRow>
                    {hotVariety.map((show) => (
                      <VideoCard key={show.id} douban={show} from="douban" />
                    ))}
                  </ScrollableRow>
                </section>
              )}

              {!loading && hotMovies.length === 0 && hotTvShows.length === 0 && (
                <div className="text-center text-gray-500 dark:text-gray-400 py-16">
                  <p className="text-lg">欢迎使用 WarHutTV</p>
                  <p className="mt-2">使用搜索栏查找影片</p>
                </div>
              )}
            </div>
          )
        ) : (
          <section>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-800 dark:text-gray-200">我的收藏</h2>
              {favoriteItems.length > 0 && (
                <button onClick={async () => { await favoritesStore.clear(); setFavoriteItems([]); }} className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">清空</button>
              )}
            </div>
            {favoriteItems.length === 0 ? (
              <div className="text-center text-gray-500 dark:text-gray-400 py-16">暂无收藏内容</div>
            ) : (
              <div className="grid grid-cols-3 gap-x-2 gap-y-12 sm:grid-cols-[repeat(auto-fill,180px)] sm:gap-x-8 sm:gap-y-20 px-4 sm:px-6 py-1 sm:py-2 pb-12 sm:pb-14">
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
          </section>
        )}
      </div>
    </div>
  );
};

export default Home;



