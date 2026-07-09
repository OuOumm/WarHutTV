import { describe, it, expect, beforeEach } from 'vitest';
import { apiCacheStore } from './apiCache';
import { db } from './db';

const DAY = 1000 * 60 * 60 * 24;

beforeEach(async () => {
  await db.detailCache.clear();
});

describe('apiCacheStore', () => {
  it('set then get returns the cached data within TTL', async () => {
    await apiCacheStore.set('search', 'batman', { list: [1, 2] });
    expect(await apiCacheStore.get('search', 'batman')).toEqual({ list: [1, 2] });
  });

  it('get returns null and deletes an already-expired entry', async () => {
    await db.detailCache.add({
      cacheKey: 'api_cache:search:old',
      data: { list: [9] },
      cachedAt: Date.now() - 30 * DAY,
    });
    expect(await apiCacheStore.get('search', 'old')).toBeNull();
    const remaining = await db.detailCache.where('cacheKey').equals('api_cache:search:old').first();
    expect(remaining).toBeUndefined();
  });

  it('cleanExpired removes only expired api_cache rows, leaving detail rows', async () => {
    await db.detailCache.add({ cacheKey: 'api_cache:config:stale', data: 1, cachedAt: Date.now() - 30 * DAY });
    await db.detailCache.add({ cacheKey: 'detail:noprefix', data: 2, cachedAt: Date.now() - 30 * DAY });
    await apiCacheStore.cleanExpired();
    expect(await db.detailCache.where('cacheKey').equals('api_cache:config:stale').first()).toBeUndefined();
    expect(await db.detailCache.where('cacheKey').equals('detail:noprefix').first()).toBeDefined();
  });

  it('keeps fresh api_cache rows after cleanExpired', async () => {
    await apiCacheStore.set('logo', 'x', 'url');
    await apiCacheStore.cleanExpired();
    expect(await apiCacheStore.get('logo', 'x')).toBe('url');
  });
});
