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
    // 先获取要删除的记录，以便按名称删除所有相同记录
    const record = await db.watchHistory.where('vod_id').equals(vodId).first();
    if (record) {
      // 删除所有相同名称的记录
      await db.watchHistory.where('vod_name').equals(record.vod_name).delete();
    } else {
      // 如果没找到，直接按 id 删除
      await db.watchHistory.where('vod_id').equals(vodId).delete();
    }
  },

  async removeByName(vodName: string): Promise<void> {
    await db.watchHistory.where('vod_name').equals(vodName).delete();
  },

  async getAll(): Promise<WatchHistory[]> {
    return db.watchHistory.orderBy('watchedAt').reverse().toArray();
  },

  async getRecent(limit: number = 10): Promise<WatchHistory[]> {
    // 获取所有记录，按时间倒序
    const allRecords = await db.watchHistory.orderBy('watchedAt').reverse().toArray();
    // 按 vod_name 去重，只保留每个电影的最新记录
    const seen = new Set<string>();
    const uniqueRecords: WatchHistory[] = [];
    for (const record of allRecords) {
      const name = record.vod_name || '';
      if (!seen.has(name)) {
        seen.add(name);
        uniqueRecords.push(record);
      }
    }
    return uniqueRecords.slice(0, limit);
  },

  async clear(): Promise<void> {
    await db.watchHistory.clear();
  },
};
