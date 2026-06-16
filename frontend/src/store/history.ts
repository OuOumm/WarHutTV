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
        site_key: video.site_key,
        vod_pic: video.vod_pic,
        vod_name: video.vod_name,
      });
    } else {
      await db.watchHistory.add({
        ...video,
        watchedAt: Date.now(),
        episode,
      });
    }
  },

  async updateSource(vodId: string | number, siteKey: string, newVodId: string | number): Promise<void> {
    const existing = await db.watchHistory.where('vod_id').equals(vodId).first();
    if (existing) {
      await db.watchHistory.update(existing.id!, {
        site_key: siteKey,
        vod_id: newVodId,
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
