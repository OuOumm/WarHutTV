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
}

class WarHutTVDatabase extends Dexie {
  favorites!: Table<Favorite>;
  watchHistory!: Table<WatchHistory>;

  constructor() {
    super('WarHutTV');
    this.version(1).stores({
      favorites: '++id, vod_id, vod_name, addedAt',
      watchHistory: '++id, vod_id, vod_name, watchedAt',
    });
  }
}

export const db = new WarHutTVDatabase();
