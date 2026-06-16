import { db } from './db';
import type { WatchHistory } from './db';
import type { VideoItem } from '../types';

export const historyStore = {
  async add(video: VideoItem, episode?: string): Promise<void> {
    const existing = await db.watchHistory.where('vod_id').equals(video.vod_id).first();

    if (existing) {
      await db.watchHistory.update(existing.id!, {
        watchedAt: Date.now(),
        episode: episode || existing.episode,
      });
    } else {
      await db.watchHistory.add({
        ...video,
        watchedAt: Date.now(),
        episode,
      });
    }
  },

  async updateProgress(vodId: string | number, progress: number, duration: number): Promise<void> {
    const existing = await db.watchHistory.where('vod_id').equals(vodId).first();
    if (existing) {
      await db.watchHistory.update(existing.id!, {
        progress,
        duration,
      });
    }
  },

  async remove(vodId: string | number): Promise<void> {
    await db.watchHistory.where('vod_id').equals(vodId).delete();
  },

  async getAll(): Promise<WatchHistory[]> {
    return db.watchHistory.orderBy('watchedAt').reverse().toArray();
  },

  async getRecent(limit: number = 10): Promise<WatchHistory[]> {
    return db.watchHistory.orderBy('watchedAt').reverse().limit(limit).toArray();
  },

  async clear(): Promise<void> {
    await db.watchHistory.clear();
  },
};
