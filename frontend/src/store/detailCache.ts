import { db } from './db';

const CACHE_TTL = 2 * 60 * 60 * 1000; // 2小时

export const detailCacheStore = {
  async get(cacheKey: string): Promise<any | null> {
    const cached = await db.detailCache.where('cacheKey').equals(cacheKey).first();
    if (cached && Date.now() - cached.cachedAt < CACHE_TTL) {
      return cached.data;
    }
    // 过期则删除
    if (cached) {
      await db.detailCache.where('cacheKey').equals(cacheKey).delete();
    }
    return null;
  },

  async set(cacheKey: string, data: any): Promise<void> {
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

  // 清理过期缓存
  async cleanExpired(): Promise<void> {
    const threshold = Date.now() - CACHE_TTL;
    await db.detailCache.where('cachedAt').below(threshold).delete();
  },
};
