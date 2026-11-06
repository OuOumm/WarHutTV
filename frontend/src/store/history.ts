import { db } from './db';
import type { WatchHistory } from './db';

function makeKey(siteKey: string, vodId: string | number): string {
  return `${siteKey}:${vodId}`;
}

export interface WatchHistoryInput {
  vod_name: string;
  vod_pic: string;
  episode: string | null;
  episodeIndex?: number | null;
  progress: number;
  duration: number;
}

/**
 * Minimal continue-watching store.
 *
 * Exactly one record per video, keyed by `${site_key}:${vod_id}` (the stable
 * URL identity — never the chosen playback source). Each record holds only
 * the last watched episode + its playback progress. Resume is driven entirely
 * by the deep-link params (`?ep=&t=`) that the continue-watching card writes,
 * so it works regardless of which source ends up playing.
 */
export const historyStore = {
  /** Upsert the "where I left off" record for a video. */
  async record(siteKey: string, vodId: string | number, data: WatchHistoryInput): Promise<void> {
    const key = makeKey(siteKey, vodId);
    const row: WatchHistory = {
      key,
      vod_id: vodId,
      site_key: siteKey,
      vod_name: data.vod_name,
      vod_pic: data.vod_pic,
      episode: data.episode,
      episodeIndex: data.episodeIndex ?? null,
      progress: data.progress,
      duration: data.duration,
      watchedAt: Date.now(),
    };

    // Single-transaction upsert. The old read-then-write could interleave two
    // flushes (visibility + unload fire back to back) and either throw a
    // ConstraintError on the unique `key` index or lose the newer position.
    await db.transaction('rw', db.watchHistory, async () => {
      const existing = await db.watchHistory.where('key').equals(key).first();
      if (existing?.id != null) {
        await db.watchHistory.put({ ...row, id: existing.id });
      } else {
        await db.watchHistory.add(row);
      }
    });
  },

  async get(siteKey: string, vodId: string | number): Promise<WatchHistory | undefined> {
    return db.watchHistory.where('key').equals(makeKey(siteKey, vodId)).first();
  },

  async getRecent(limit: number = 10): Promise<WatchHistory[]> {
    return db.watchHistory.orderBy('watchedAt').reverse().limit(limit).toArray();
  },

  async remove(siteKey: string, vodId: string | number): Promise<void> {
    const rec = await db.watchHistory.where('key').equals(makeKey(siteKey, vodId)).first();
    if (rec?.id != null) await db.watchHistory.delete(rec.id);
  },

  async clear(): Promise<void> {
    await db.watchHistory.clear();
  },
};
