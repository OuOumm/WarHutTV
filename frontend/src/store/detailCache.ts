import { db } from './db';

const CACHE_TTL = 2 * 60 * 60 * 1000; // 2小时

export const detailCacheStore = {
  async get<T = unknown>(cacheKey: string): Promise<T | null> {
    const cached = await db.detailCache.where('cacheKey').equals(cacheKey).first();
    if (cached && Date.now() - cached.cachedAt < CACHE_TTL) {
      return cached.data as T;
    }
    // 过期则删除
    if (cached) {
      await db.detailCache.where('cacheKey').equals(cacheKey).delete();
    }
    return null;
  },

  async set(cacheKey: string, data: unknown): Promise<void> {
    const existing = await db.detailCache.where('cacheKey').equals(cacheKey).first();
    if (existing) {
      await db.detailCache.update(existing.id!, { data, cachedAt: Date.now() });
    } else {
      await db.detailCache.add({ cacheKey, data, cachedAt: Date.now() });
    }
  },

  async clear(): Promise<void> {
    await db.detailCache.clear();
  },

  // 清理过期缓存。
  // 注意：apiCache 与 detailCache 共用同一张 db.detailCache 表，但 api_cache:
  // 前缀的行有更长的 TTL（24h–7d，见 apiCache.ts）。这里只清「非 api_cache:」
  // 前缀的详情缓存，避免误删长效 API 缓存（曾经的串扰 bug）。
  async cleanExpired(): Promise<void> {
    const threshold = Date.now() - CACHE_TTL;
    const rows = await db.detailCache.toArray();
    const expired = rows
      .filter((r) => !r.cacheKey.startsWith('api_cache:') && r.cachedAt < threshold)
      .map((r) => r.id!);
    if (expired.length > 0) {
      await db.detailCache.bulkDelete(expired);
    }
  },
};
