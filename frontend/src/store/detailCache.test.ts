import { describe, it, expect, beforeEach } from 'vitest';
import { detailCacheStore } from './detailCache';
import { db } from './db';

const DAY = 1000 * 60 * 60 * 24;

beforeEach(async () => {
  await db.detailCache.clear();
});

describe('detailCacheStore', () => {
  it('set then get returns data within TTL', async () => {
    await detailCacheStore.set('detailKey', { a: 1 });
    expect(await detailCacheStore.get('detailKey')).toEqual({ a: 1 });
  });

  it('cleanExpired removes expired detail rows', async () => {
    await db.detailCache.add({ cacheKey: 'expiredDetail', data: 1, cachedAt: Date.now() - DAY });
    await detailCacheStore.cleanExpired();
    expect(await db.detailCache.where('cacheKey').equals('expiredDetail').first()).toBeUndefined();
  });

  it('cleanExpired must NOT remove api_cache: rows (no cross-eviction)', async () => {
    await db.detailCache.add({ cacheKey: 'api_cache:config:fresh', data: 1, cachedAt: Date.now() });
    await db.detailCache.add({ cacheKey: 'someDetail', data: 2, cachedAt: Date.now() - DAY });
    await detailCacheStore.cleanExpired();
    // long-lived API cache preserved
    expect(await db.detailCache.where('cacheKey').equals('api_cache:config:fresh').first()).toBeDefined();
    // expired detail evicted
    expect(await db.detailCache.where('cacheKey').equals('someDetail').first()).toBeUndefined();
  });
});
