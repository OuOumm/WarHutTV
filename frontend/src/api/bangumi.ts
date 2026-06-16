import apiClient from './client';
import type { BangumiCalendarData } from '../types';

const CACHE_KEY = 'bangumi_calendar';
const CACHE_TTL = 12 * 60 * 60 * 1000; // 12小时

function getCached(): BangumiCalendarData[] | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const entry = JSON.parse(raw);
    if (Date.now() > entry.expiry) {
      localStorage.removeItem(CACHE_KEY);
      return null;
    }
    return entry.data;
  } catch {
    return null;
  }
}

function setCache(data: BangumiCalendarData[]) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({
      data,
      expiry: Date.now() + CACHE_TTL,
    }));
  } catch {}
}

export async function getBangumiCalendar(): Promise<BangumiCalendarData[]> {
  const cached = getCached();
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
    setCache(result);
    return result;
  } catch {
    return [];
  }
}

