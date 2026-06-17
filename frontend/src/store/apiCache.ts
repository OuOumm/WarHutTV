import { db } from './db';

// 缓存 TTL 配置（毫秒）
const CACHE_TTL = {
  bangumi: 24 * 60 * 60 * 1000,      // 24小时
  config: 24 * 60 * 60 * 1000,       // 24小时
  liveSources: 24 * 60 * 60 * 1000,  // 24小时
  liveChannels: 24 * 60 * 60 * 1000, // 24小时
  logo: 7 * 24 * 60 * 60 * 1000,     // 7天
  search: 2 * 60 * 60 * 1000,        // 2小时
} as const;

type CacheType = keyof typeof CACHE_TTL;

// 通用缓存键前缀
const PREFIX = 'api_cache:';

export const apiCacheStore = {
  async get<T = any>(type: CacheType, key: string): Promise<T | null> {
    const cacheKey = `${PREFIX}${type}:${key}`;
    const cached = await db.detailCache.where('cacheKey').equals(cacheKey).first();
    const ttl = CACHE_TTL[type];
    
    if (cached && Date.now() - cached.cachedAt < ttl) {
      return cached.data as T;
    }
    // 过期则删除
    if (cached) {
      await db.detailCache.where('cacheKey').equals(cacheKey).delete();
    }
    return null;
  },

  async set(type: CacheType, key: string, data: any): Promise<void> {
    const cacheKey = `${PREFIX}${type}:${key}`;
    const existing = await db.detailCache.where('cacheKey').equals(cacheKey).first();
    if (existing) {
      await db.detailCache.update(existing.id!, { data, cachedAt: Date.now() });
    } else {
      await db.detailCache.add({ cacheKey, data, cachedAt: Date.now() });
    }
  },

  // 清理指定类型的缓存
  async clearType(type: CacheType): Promise<void> {
    const prefix = `${PREFIX}${type}:`;
    await db.detailCache.where('cacheKey').startsWith(prefix).delete();
  },

  // 清理所有 API 缓存
  async clearAll(): Promise<void> {
    const keys = await db.detailCache.toArray();
    const apiKeys = keys.filter(k => k.cacheKey.startsWith(PREFIX));
    await db.detailCache.bulkDelete(apiKeys.map(k => k.id!));
  },

  // 清理过期缓存
  async cleanExpired(): Promise<void> {
    const keys = await db.detailCache.toArray();
    const now = Date.now();
    const expired = keys.filter(k => {
      if (!k.cacheKey.startsWith(PREFIX)) return false;
      // 提取类型
      const type = k.cacheKey.replace(PREFIX, '').split(':')[0] as CacheType;
      const ttl = CACHE_TTL[type] || 0;
      return now - k.cachedAt >= ttl;
    });
    if (expired.length > 0) {
      await db.detailCache.bulkDelete(expired.map(k => k.id!));
    }
  },
};
