import { db } from './db';
import type { WatchHistory } from './db';
import type { VideoItem } from '../types';

function makePlaybackKey(siteKey: string, vodId: string | number, episode?: string): string {
  return `${siteKey}:${vodId}:${episode || ''}`;
}

export const historyStore = {
  async add(video: VideoItem, episode?: string): Promise<void> {
    const playbackKey = makePlaybackKey(video.site_key || '', video.vod_id, episode);
    const existing = await db.watchHistory.where('playback_key').equals(playbackKey).first();

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
        playback_key: playbackKey,
      });
    }
  },

  async updateSource(vodId: string | number, siteKey: string, newVodId: string | number): Promise<void> {
    const existing = await db.watchHistory.where('vod_id').equals(vodId).first();
    if (existing) {
      await db.watchHistory.update(existing.id!, {
        site_key: siteKey,
        vod_id: newVodId,
        playback_key: makePlaybackKey(siteKey, newVodId, existing.episode),
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

  /** Update progress isolated by source + episode context */
  async updateProgressByContext(
    siteKey: string,
    vodId: string | number,
    episode: string | undefined,
    progress: number,
    duration: number,
  ): Promise<void> {
    const playbackKey = makePlaybackKey(siteKey, vodId, episode);
    const existing = await db.watchHistory.where('playback_key').equals(playbackKey).first();
    if (existing) {
      await db.watchHistory.update(existing.id!, { progress, duration, episode: episode ?? existing.episode });
    } else {
      // Fallback to vod_id lookup for backward compatibility
      const fallback = await db.watchHistory.where('vod_id').equals(vodId).first();
      if (fallback) {
        await db.watchHistory.update(fallback.id!, {
          progress,
          duration,
          episode: episode ?? fallback.episode,
          playback_key: playbackKey,
        });
      }
    }
  },

  /** Get history isolated by source + episode context, with vod_id fallback */
  async getByContext(siteKey: string, vodId: string | number, episode?: string): Promise<WatchHistory | undefined> {
    const playbackKey = makePlaybackKey(siteKey, vodId, episode);
    const record = await db.watchHistory.where('playback_key').equals(playbackKey).first();
    if (record) return record;
    // Fallback to vod_id lookup for backward compatibility
    return db.watchHistory.where('vod_id').equals(vodId).first();
  },

  async remove(vodId: string | number): Promise<void> {
    const record = await db.watchHistory.where('vod_id').equals(vodId).first();
    if (record) {
      await db.watchHistory.where('vod_name').equals(record.vod_name).delete();
    } else {
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
    const allRecords = await db.watchHistory.orderBy('watchedAt').reverse().toArray();
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

  async getByVodId(vodId: string | number): Promise<WatchHistory | undefined> {
    return db.watchHistory.where('vod_id').equals(vodId).first();
  },

  async clear(): Promise<void> {
    await db.watchHistory.clear();
  },
};
