import Dexie, { type Table } from 'dexie';
import type { VideoItem } from '../types';

export interface Favorite extends VideoItem {
  id?: number;
  addedAt: number;
}

export interface WatchHistory extends VideoItem {
  id?: number;
  watchedAt: number;
  progress?: number;
  duration?: number;
  episode?: string;
  playback_key?: string;
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
  }
}

export const db = new WarHutTVDatabase();
