import Dexie, { type Table } from 'dexie';
import type { VideoItem } from '../types';

export interface Favorite extends VideoItem {
  id?: number;
  addedAt: number;
}

/** Minimal "where I left off" record — one row per video, keyed by `site:vod_id`. */
export interface WatchHistory {
  id?: number;
  key: string;
  vod_id: string | number;
  site_key: string;
  vod_name: string;
  vod_pic: string;
  /** Last watched episode name (or null for single-file videos). */
  episode: string | null;
  /**
   * Position of the last watched episode within its source's episode list.
   * Lets resume fall back to the correct index when episode names differ
   * across sources (name-only matching can't always reconcile them).
   */
  episodeIndex?: number | null;
  /** Seconds into `episode`. */
  progress: number;
  duration: number;
  watchedAt: number;
}

export interface DetailCache {
  id?: number;
  cacheKey: string;
  data: unknown;
  cachedAt: number;
}

export interface WatchedEpisode {
  id?: number;
  vod_name: string;
  episodes: string[];
  updatedAt: number;
}

class WarHutTVDatabase extends Dexie {
  favorites!: Table<Favorite>;
  watchHistory!: Table<WatchHistory>;
  detailCache!: Table<DetailCache>;
  watchedEpisodes!: Table<WatchedEpisode>;

  constructor() {
    super('WarHutTV');
    this.version(1).stores({
      favorites: '++id, vod_id, vod_name, addedAt',
      watchHistory: '++id, vod_id, vod_name, watchedAt',
    });
    this.version(2).stores({
      favorites: '++id, vod_id, vod_name, addedAt',
      watchHistory: '++id, vod_id, vod_name, watchedAt',
      detailCache: '++id, cacheKey, cachedAt',
    });
    this.version(3).stores({
      favorites: '++id, vod_id, vod_name, addedAt',
      watchHistory: '++id, vod_id, vod_name, watchedAt, playback_key',
      detailCache: '++id, cacheKey, cachedAt',
    });
    this.version(4).stores({
      favorites: '++id, vod_id, vod_name, addedAt',
      watchHistory: '++id, vod_id, vod_name, watchedAt, playback_key',
      detailCache: '++id, cacheKey, cachedAt',
      watchedEpisodes: '++id, vod_name',
    });
    // v5: simplified continue-watching — one record per video keyed by `site:vod_id`,
    // storing only last episode + progress. `&key` unique index dedups by site:vod_id.
    // Schema change only; existing history rows are preserved (rows missing `key`
    // are indexed as unset, which Dexie's unique index does NOT treat as a conflict).
    this.version(5).stores({
      favorites: '++id, vod_id, vod_name, addedAt',
      watchHistory: '++id, &key, vod_id, vod_name, watchedAt',
      detailCache: '++id, cacheKey, cachedAt',
      watchedEpisodes: '++id, vod_name',
    });
    // v6: backfill `key` on the rows v5 left unindexed. Without this they are
    // invisible to `where('key')` lookups (resume) yet still occupy the table,
    // so the old history silently never came back. Rows that cannot produce a
    // key (no vod_id) are dropped — they were already unreachable.
    this.version(6)
      .stores({
        favorites: '++id, vod_id, vod_name, addedAt',
        watchHistory: '++id, &key, vod_id, vod_name, watchedAt',
        detailCache: '++id, cacheKey, cachedAt',
        watchedEpisodes: '++id, vod_name',
      })
      .upgrade(async (tx) => {
        const table = tx.table<WatchHistory>('watchHistory');
        const rows = await table.toArray();
        const orphans: number[] = [];
        const repaired: WatchHistory[] = [];

        for (const row of rows) {
          if (row.key) continue;
          const vodId = row.vod_id;
          if (vodId === undefined || vodId === null || vodId === '') {
            if (row.id != null) orphans.push(row.id);
            continue;
          }
          repaired.push({
            ...row,
            key: `${row.site_key || 'default'}:${vodId}`,
            watchedAt: row.watchedAt ?? Date.now(),
            episode: row.episode ?? null,
            progress: row.progress ?? 0,
            duration: row.duration ?? 0,
          });
        }

        if (repaired.length > 0) await table.bulkPut(repaired);
        if (orphans.length > 0) await table.bulkDelete(orphans);
      });
  }
}

export const db = new WarHutTVDatabase();
