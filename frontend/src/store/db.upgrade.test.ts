import { describe, it, expect, beforeAll } from 'vitest';
import Dexie from 'dexie';
import { db } from './db';
import type { WatchHistory } from './db';

/**
 * Guardrail for legacy-1: the v5 migration must change *only* the schema
 * (add the `&key` unique index) and must NOT wipe existing watchHistory.
 *
 * This reproduces a pre-v5 (version 4) database with legacy rows that lack the
 * `key` field, then opens the production `db` (which declares up to version 5)
 * to trigger the 4→5 upgrade. If the removed `.upgrade(t => ...clear())` ever
 * regresses, the seeded rows would disappear and these assertions would fail.
 */

// Mirror of the PRE-v5 schema (versions 1–4) used only to seed legacy data.
class LegacyDB extends Dexie {
  watchHistory!: Dexie.Table<Record<string, unknown>, number>;
  constructor() {
    super('WarHutTV');
    this.version(1).stores({
      favorites: '++id',
      watchHistory: '++id, vod_id, vod_name, watchedAt',
    });
    this.version(2).stores({
      favorites: '++id',
      watchHistory: '++id, vod_id, vod_name, watchedAt',
      detailCache: '++id, cacheKey, cachedAt',
    });
    this.version(3).stores({
      favorites: '++id',
      watchHistory: '++id, vod_id, vod_name, watchedAt, playback_key',
      detailCache: '++id, cacheKey, cachedAt',
    });
    this.version(4).stores({
      favorites: '++id',
      watchHistory: '++id, vod_id, vod_name, watchedAt, playback_key',
      detailCache: '++id, cacheKey, cachedAt',
      watchedEpisodes: '++id, vod_name',
    });
  }
}

function deleteDatabase(name: string): Promise<void> {
  return new Promise((resolve) => {
    const req = indexedDB.deleteDatabase(name);
    req.onsuccess = () => resolve();
    req.onerror = () => resolve();
    req.onblocked = () => resolve();
  });
}

describe('db v5 migration guardrail (legacy-1: must NOT clear watchHistory)', () => {
  beforeAll(async () => {
    // Deterministic start regardless of worker / IDB reuse by sibling files.
    await deleteDatabase('WarHutTV');

    const legacy = new LegacyDB();
    await legacy.watchHistory.bulkAdd([
      { vod_id: 'old-1', vod_name: '老片A', watchedAt: 100 },
      { vod_id: 'old-2', vod_name: '老片B', watchedAt: 200 },
    ]);
    await legacy.close();

    // Opening the production db (up to v5) runs the 4→5 schema upgrade.
    await db.open();
  });

  it('preserves legacy watchHistory rows after the v5 upgrade', async () => {
    const all = await db.watchHistory.toArray();
    expect(all).toHaveLength(2);
    const names = all.map((r) => r.vod_name).sort();
    expect(names).toEqual(['老片A', '老片B']);
  });

  it('adds the &key unique index without dropping legacy rows', async () => {
    const indexNames = db.watchHistory.schema.indexes.map((i) => i.name);
    expect(indexNames).toContain('key');

    const rec = await db.watchHistory.where('vod_name').equals('老片A').first();
    expect(rec).toBeDefined();
    expect(rec!.vod_id).toBe('old-1');
  });

  it('still allows new rows with a unique key (legacy unset keys do not conflict)', async () => {
    const newRow: WatchHistory = {
      key: 'newsite:999',
      vod_id: '999',
      site_key: 'newsite',
      vod_name: '新片',
      vod_pic: '',
      episode: null,
      episodeIndex: null,
      progress: 0,
      duration: 0,
      watchedAt: 300,
    };
    await db.watchHistory.add(newRow);

    const added = await db.watchHistory.where('key').equals('newsite:999').first();
    expect(added).toBeDefined();
    // legacy rows remain untouched
    expect(await db.watchHistory.where('vod_name').equals('老片A').first()).toBeDefined();
  });
});
