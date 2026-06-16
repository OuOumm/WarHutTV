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

function getProxyBase(): string {
  const proxy = localStorage.getItem('doubanProxy') || 'tencent';
  switch (proxy) {
    case 'ali':
      return 'https://m.douban.cmliussss.com';
    case 'direct':
      return 'https://m.douban.com';
    case 'tencent':
    default:
      return 'https://m.douban.cmliussss.net';
  }
}

function getListProxyBase(): string {
  const proxy = localStorage.getItem('doubanProxy') || 'tencent';
  switch (proxy) {
    case 'ali':
      return 'https://movie.douban.cmliussss.com';
    case 'direct':
      return 'https://movie.douban.com';
    case 'tencent':
    default:
      return 'https://movie.douban.cmliussss.net';
  }
}

async function fetchWithTimeout(url: string, timeout = 10000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        'Referer': 'https://movie.douban.com/',
      },
    });
    clearTimeout(timer);
    return response;
  } catch (error) {
    clearTimeout(timer);
    throw error;
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

  const cached = getCache(cacheKey);
  if (cached) return cached;

  const base = getProxyBase();
  const url = `${base}/rexxar/api/v2/subject/recent_hot/${kind}?start=${pageStart}&limit=${pageLimit}&category=${category}&type=${type}`;

  try {
    const response = await fetchWithTimeout(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();

    const list: DoubanItem[] = (data.items || []).map((item: any) => ({
      id: item.id,
      title: item.title,
      poster: item.pic?.normal || item.pic?.large || '',
      rate: item.rating?.value ? item.rating.value.toFixed(1) : '',
      year: item.card_subtitle?.match(/(\d{4})/)?.[1] || '',
    }));

    const result: DoubanResult = { code: 200, message: 'ok', list };
    setCache(cacheKey, result);
    return result;
  } catch (error) {
    console.error('获取豆瓣分类数据失败:', error);
    return { code: 500, message: '获取失败', list: [] };
  }
}

export async function getDoubanList(params: {
  tag: string;
  type: string;
  pageLimit?: number;
  pageStart?: number;
}): Promise<DoubanResult> {
  const { tag, type, pageLimit = 20, pageStart = 0 } = params;
  const cacheKey = `list:${tag}:${type}:${pageLimit}:${pageStart}`;

  const cached = getCache(cacheKey);
  if (cached) return cached;

  const base = getListProxyBase();
  const url = `${base}/j/search_subjects?type=${type}&tag=${tag}&sort=recommend&page_limit=${pageLimit}&page_start=${pageStart}`;

  try {
    const response = await fetchWithTimeout(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();

    const list: DoubanItem[] = (data.subjects || []).map((item: any) => ({
      id: item.id,
      title: item.title,
      poster: item.cover,
      rate: item.rate,
      year: item.card_subtitle?.match(/(\d{4})/)?.[1] || '',
    }));

    const result: DoubanResult = { code: 200, message: 'ok', list };
    setCache(cacheKey, result);
    return result;
  } catch (error) {
    console.error('获取豆瓣列表数据失败:', error);
    return { code: 500, message: '获取失败', list: [] };
  }
}
