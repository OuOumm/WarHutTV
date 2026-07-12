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
    // storing only last episode + progress. Dropping the old `playback_key` schema.
    this.version(5).stores({
      favorites: '++id, vod_id, vod_name, addedAt',
      watchHistory: '++id, &key, vod_id, vod_name, watchedAt',
      detailCache: '++id, cacheKey, cachedAt',
      watchedEpisodes: '++id, vod_name',
    }).upgrade(async (tx) => {
      // Dev version: discard legacy history rows (different key shape) on upgrade.
      await tx.table('watchHistory').clear();
    });
  }
}

export const db = new WarHutTVDatabase();
