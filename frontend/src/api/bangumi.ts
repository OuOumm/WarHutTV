import apiClient from './client';
import { apiCacheStore } from '../store/apiCache';
import type { BangumiCalendarData } from '../types';

/**
 * Bangumi 日历由后端代理（含 12h 服务端缓存与上游回退），因此客户端超时必须
 * 长于后端首次拉取的耗时：原来的 3s 会在冷缓存时必然超时，且错误被吞成 []，
 * 表现为首页"今日番剧"长期空白。
 */
export async function getBangumiCalendar(): Promise<BangumiCalendarData[]> {
  const cached = await apiCacheStore.get<BangumiCalendarData[]>('bangumi', 'calendar');
  if (cached) return cached;

  try {
    const response = await apiClient.get<BangumiCalendarData[]>('/bangumi/calendar', {
      timeout: 20000,
    });

    const result = (response.data ?? []).map((item) => ({
      ...item,
      items: (item.items ?? []).filter((bangumi) => bangumi.images),
    }));

    await apiCacheStore.set('bangumi', 'calendar', result);
    return result;
  } catch (error) {
    // Don't pretend "no data" is "no anime this season": log it so the failure
    // is diagnosable, and let the caller render its own empty state.
    console.warn('[bangumi] failed to load calendar', error);
    return [];
  }
}
