import { db } from './db';
import type { WatchHistory } from './db';
import type { VideoItem } from '../types';

function makePlaybackKey(siteKey: string, vodId: string | number, episode?: string): string {
  return `${siteKey}:${vodId}:${episode || ''}`;
}

export const historyStore = {
  async add(video: VideoItem, episode?: string): Promise<void> {
    const playbackKey = makePlaybackKey(video.site_key || '', video.vod_id, episode);
    // 用 playback_key(含 site) 或 vod_id 找同一条记录，避免换源/重进时产生重复记录
    const existing =
      (await db.watchHistory.where('playback_key').equals(playbackKey).first()) ??
      (await db.watchHistory.where('vod_id').equals(video.vod_id).first());

    if (existing) {
      await db.watchHistory.update(existing.id!, {
        watchedAt: Date.now(),
        episode: episode || existing.episode,
        site_key: video.site_key,
        vod_pic: video.vod_pic,
        vod_name: video.vod_name,
        playback_key: playbackKey,
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

  async updateSource(vodId: string | number, _siteKey?: string): Promise<void> {
    // 历史记录身份固定为播放 URL 的 (site, vod_id)，不随优化源改变，
    // 否则续播会因双键不一致产生重复记录。仅保持 playback_key 前缀一致即可。
    const existing = await db.watchHistory.where('vod_id').equals(vodId).first();
    if (existing) {
      await db.watchHistory.update(existing.id!, {
        playback_key: makePlaybackKey(existing.site_key || '', vodId, existing.episode),
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
    // 优先按 vod_id(=播放 URL 的 id，稳定主键)找同一条记录，找不到再退回 playback_key。
    // 始终把 playback_key 重写为当前集 + 刷新 watchedAt，确保续播定位到最近观看的集。
    const existing =
      (await db.watchHistory.where('vod_id').equals(vodId).first()) ??
      (await db.watchHistory.where('playback_key').equals(playbackKey).first());
    if (existing) {
      await db.watchHistory.update(existing.id!, {
        progress,
        duration,
        episode: episode ?? existing.episode,
        playback_key: playbackKey,
        watchedAt: Date.now(),
      });
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
