import apiClient from './client';
import { apiCacheStore } from '../store/apiCache';
import type { DoubanItem, DoubanResult } from '../types';

interface DoubanCategoryItem {
  id: string;
  title: string;
  pic?: {
    normal?: string;
    large?: string;
  };
  rating?: {
    value?: number;
  };
  card_subtitle?: string;
}

interface DoubanListItem {
  id: string;
  title: string;
  cover: string;
  rate: string;
  card_subtitle?: string;
}

interface DoubanRecommendItem extends DoubanCategoryItem {
  type?: string;
  year?: string;
}

interface DoubanCategoryResponse {
  items?: DoubanCategoryItem[];
}

interface DoubanListResponse {
  subjects?: DoubanListItem[];
}

interface DoubanRecommendResponse {
  items?: DoubanRecommendItem[];
}

/**
 * 豆瓣数据统一走后端 `/api/douban/*` 代理：
 * - 浏览器直连第三方镜像时，`User-Agent`/`Referer` 会被浏览器丢弃，对反爬无效；
 *   现在由服务端设置，真正生效。
 * - 镜像可用性/CORS/限流不再由第三方决定，后端按顺序回退到官方域名。
 * - 缓存从 localStorage 迁到 IndexedDB（Dexie），有统一 TTL 与清理入口，
 *   不会再无限占用 5MB 配额。
 */
async function fetchDouban<TResponse>(
  cacheKey: string,
  path: string,
  params: Record<string, string>,
  mapItems: (data: TResponse) => DoubanItem[],
): Promise<DoubanResult> {
  const cached = await apiCacheStore.get<DoubanResult>('douban', cacheKey);
  if (cached) return cached;

  try {
    const response = await apiClient.get<TResponse>(`/douban/${path}`, {
      params,
      timeout: 15000,
    });
    const result: DoubanResult = {
      code: 200,
      message: 'ok',
      list: mapItems(response.data),
    };
    await apiCacheStore.set('douban', cacheKey, result);
    return result;
  } catch (error) {
    console.warn('[douban] request failed', path, error);
    // Surface the failure instead of an empty list that looks like "no data".
    return { code: 500, message: '获取豆瓣数据失败，请稍后重试', list: [] };
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

  return fetchDouban<DoubanCategoryResponse>(
    cacheKey,
    `rexxar/api/v2/subject/recent_hot/${kind}`,
    {
      start: String(pageStart),
      limit: String(pageLimit),
      category,
      type,
    },
    (data) =>
      (data.items || []).map((item) => ({
        id: item.id,
        title: item.title,
        poster: item.pic?.normal || item.pic?.large || '',
        rate: item.rating?.value ? item.rating.value.toFixed(1) : '',
        year: item.card_subtitle?.match(/(\d{4})/)?.[1] || '',
      })),
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

  return fetchDouban<DoubanListResponse>(
    cacheKey,
    'j/search_subjects',
    {
      type,
      tag,
      sort: 'recommend',
      page_limit: String(pageLimit),
      page_start: String(pageStart),
    },
    (data) =>
      (data.subjects || []).map((item) => ({
        id: item.id,
        title: item.title,
        poster: item.cover,
        rate: item.rate,
        year: item.card_subtitle?.match(/(\d{4})/)?.[1] || '',
      })),
  );
}

/**
 * 豆瓣推荐 API：用于动漫的「番剧 / 剧场版」分类
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

  const selectedCategories: Record<string, string> = {};
  if (category) selectedCategories['类型'] = category;
  if (format) selectedCategories['形式'] = format;

  const tags: string[] = [];
  if (category) tags.push(category);
  if (!category && format) tags.push(format);
  if (region) tags.push(region);
  if (year) tags.push(year);

  const requestParams: Record<string, string> = {
    refresh: '0',
    start: String(pageStart),
    count: String(pageLimit),
    selected_categories: JSON.stringify(selectedCategories),
    uncollect: 'false',
    score_range: '0,10',
    tags: tags.join(','),
  };
  if (sort) requestParams.sort = sort;

  return fetchDouban<DoubanRecommendResponse>(
    cacheKey,
    `rexxar/api/v2/${kind}/recommend`,
    requestParams,
    (data) =>
      (data.items || [])
        .filter((item) => item.type === 'movie' || item.type === 'tv')
        .map((item) => ({
          id: item.id,
          title: item.title,
          poster: item.pic?.normal || item.pic?.large || '',
          rate: item.rating?.value ? item.rating.value.toFixed(1) : '',
          year: item.year || '',
        })),
  );
}
