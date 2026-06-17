import apiClient from './client';
import { apiCacheStore } from '../store/apiCache';
import type { BangumiCalendarData } from '../types';

export async function getBangumiCalendar(): Promise<BangumiCalendarData[]> {
  // 检查缓存
  const cached = await apiCacheStore.get<BangumiCalendarData[]>('bangumi', 'calendar');
  if (cached) return cached;

  try {
    const response = await apiClient.get('/bangumi/calendar', { timeout: 3000 });
    const raw = response.data;
    // Base64 decode if needed
    let data;
    try {
      data = JSON.parse(atob(raw));
    } catch {
      data = raw;
    }
    const result = data.map((item: BangumiCalendarData) => ({
      ...item,
      items: item.items.filter((bangumi) => bangumi.images),
    }));
    
    // 存入缓存
    await apiCacheStore.set('bangumi', 'calendar', result);
    return result;
  } catch {
    return [];
  }
}
