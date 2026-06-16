import type { DoubanItem, DoubanResult } from '../types';

const CACHE_TTL = 2 * 60 * 60 * 1000; // 2小时

interface CacheEntry {
  data: DoubanResult;
  expiry: number;
}

function getCache(key: string): DoubanResult | null {
  try {
    const raw = localStorage.getItem(`douban_cache_${key}`);
    if (!raw) return null;
    const entry: CacheEntry = JSON.parse(raw);
    if (Date.now() > entry.expiry) {
      localStorage.removeItem(`douban_cache_${key}`);
      return null;
    }
    return entry.data;
  } catch {
    return null;
  }
}

function setCache(key: string, data: DoubanResult) {
  try {
    const entry: CacheEntry = { data, expiry: Date.now() + CACHE_TTL };
    localStorage.setItem(`douban_cache_${key}`, JSON.stringify(entry));
  } catch {
    // storage full, ignore
  }
}

const PROXY_BASES = {
  tencent: { api: 'https://m.douban.cmliussss.net', list: 'https://movie.douban.cmliussss.net' },
  ali: { api: 'https://m.douban.cmliussss.com', list: 'https://movie.douban.cmliussss.com' },
  direct: { api: 'https://m.douban.com', list: 'https://movie.douban.com' },
} as const;

function getProxyBases() {
  const proxy = (localStorage.getItem('doubanProxy') || 'tencent') as keyof typeof PROXY_BASES;
  return PROXY_BASES[proxy] || PROXY_BASES.tencent;
}

async function fetchWithTimeout(url: string, timeout = 10000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        'Referer': 'https://movie.douban.com/',
      },
    });
  } finally {
    clearTimeout(timer);
  }
}

async function fetchDoubanAPI(
  cacheKey: string,
  url: string,
  mapItems: (data: any) => DoubanItem[],
  errorLabel: string,
): Promise<DoubanResult> {
  const cached = getCache(cacheKey);
  if (cached) return cached;

  try {
    const response = await fetchWithTimeout(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    const result: DoubanResult = { code: 200, message: 'ok', list: mapItems(data) };
    setCache(cacheKey, result);
    return result;
  } catch (error) {
    console.error(`${errorLabel}:`, error);
    return { code: 500, message: '获取失败', list: [] };
  }
}

export async function getDoubanCategories(params: {
  kind: 'tv' | 'movie';
  category: string;
  type: string;
  pageLimit?: number;
  pageStart?: number;
}): Promise<DoubanResult> {
  const { kind, category, type, pageLimit = 20, pageStart = 0 } = params;
  const cacheKey = `cat:${kind}:${category}:${type}:${pageLimit}:${pageStart}`;
  const { api } = getProxyBases();
  const url = `${api}/rexxar/api/v2/subject/recent_hot/${kind}?start=${pageStart}&limit=${pageLimit}&category=${category}&type=${type}`;

  return fetchDoubanAPI(cacheKey, url, (data) =>
    (data.items || []).map((item: any) => ({
      id: item.id,
      title: item.title,
      poster: item.pic?.normal || item.pic?.large || '',
      rate: item.rating?.value ? item.rating.value.toFixed(1) : '',
      year: item.card_subtitle?.match(/(\d{4})/)?.[1] || '',
    })),
    '获取豆瓣分类数据失败',
  );
}

export async function getDoubanList(params: {
  tag: string;
  type: string;
  pageLimit?: number;
  pageStart?: number;
}): Promise<DoubanResult> {
  const { tag, type, pageLimit = 20, pageStart = 0 } = params;
  const cacheKey = `list:${tag}:${type}:${pageLimit}:${pageStart}`;
  const { list } = getProxyBases();
  const url = `${list}/j/search_subjects?type=${type}&tag=${tag}&sort=recommend&page_limit=${pageLimit}&page_start=${pageStart}`;

  return fetchDoubanAPI(cacheKey, url, (data) =>
    (data.subjects || []).map((item: any) => ({
      id: item.id,
      title: item.title,
      poster: item.cover,
      rate: item.rate,
      year: item.card_subtitle?.match(/(\d{4})/)?.[1] || '',
    })),
    '获取豆瓣列表数据失败',
  );
}

/**
 * 豆瓣推荐 API：用于动漫的「番剧 / 剧场版」分类
 * 对应 LunaTV 的 getDoubanRecommends
 */
export async function getDoubanRecommends(params: {
  kind: 'tv' | 'movie';
  pageLimit?: number;
  pageStart?: number;
  category?: string;
  format?: string;
  region?: string;
  year?: string;
  sort?: string;
}): Promise<DoubanResult> {
  const { kind, pageLimit = 25, pageStart = 0 } = params;
  // 'all' 是占位值，请求时清空
  let { category, format, region, year, sort } = params;
  if (category === 'all') category = '';
  if (format === 'all') format = '';
  if (region === 'all') region = '';
  if (year === 'all') year = '';
  if (sort === 'T') sort = '';

  const cacheKey = `rec:${kind}:${category || ''}:${format || ''}:${region || ''}:${year || ''}:${sort || ''}:${pageLimit}:${pageStart}`;
  const cached = getCache(cacheKey);
  if (cached) return cached;

  const { api } = getProxyBases();

  // 构造 selected_categories
  const selectedCategories: Record<string, string> = {};
  if (category) selectedCategories['类型'] = category;
  if (format) selectedCategories['形式'] = format;

  // 构造 tags
  const tags: string[] = [];
  if (category) tags.push(category);
  if (!category && format) tags.push(format);
  if (region) tags.push(region);
  if (year) tags.push(year);

  const reqParams = new URLSearchParams();
  reqParams.append('refresh', '0');
  reqParams.append('start', String(pageStart));
  reqParams.append('count', String(pageLimit));
  reqParams.append('selected_categories', JSON.stringify(selectedCategories));
  reqParams.append('uncollect', 'false');
  reqParams.append('score_range', '0,10');
  reqParams.append('tags', tags.join(','));
  if (sort) reqParams.append('sort', sort);

  const url = `${api}/rexxar/api/v2/${kind}/recommend?${reqParams.toString()}`;

  return fetchDoubanAPI(cacheKey, url, (data) =>
    (data.items || [])
      .filter((item: any) => item.type === 'movie' || item.type === 'tv')
      .map((item: any) => ({
        id: item.id,
        title: item.title,
        poster: item.pic?.normal || item.pic?.large || '',
        rate: item.rating?.value ? item.rating.value.toFixed(1) : '',
        year: item.year || '',
      })),
    '获取豆瓣推荐数据失败',
  );
}
