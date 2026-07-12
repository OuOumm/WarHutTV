import { db } from './db';

/**
 * Per-episode "watched" tracking, keyed by `vod_name` (the show title) rather
 * than `vod_id`. This is deliberate: switching playback sources changes the
 * `vod_id` but keeps the same title, so a single watched-set under the title
 * naturally stays in sync across sources. Episode names are matched across
 * sources to drive the highlight in the episode grid.
 */
export const watchedStore = {
  /** Return the list of watched episode names for a given show title. */
  async getWatched(vodName: string): Promise<string[]> {
    if (!vodName) return [];
    const rec = await db.watchedEpisodes.where('vod_name').equals(vodName).first();
    return rec?.episodes ?? [];
  },

  /** Mark an episode as watched; returns the full updated watched list. */
  async markWatched(vodName: string, episodeName: string): Promise<string[]> {
    if (!vodName || !episodeName) return [];
    const rec = await db.watchedEpisodes.where('vod_name').equals(vodName).first();
    if (!rec) {
      const episodes = [episodeName];
      await db.watchedEpisodes.add({ vod_name: vodName, episodes, updatedAt: Date.now() });
      return episodes;
    }
    if (rec.episodes.includes(episodeName)) return rec.episodes;
    const episodes = [...rec.episodes, episodeName];
    await db.watchedEpisodes.update(rec.id!, { episodes, updatedAt: Date.now() });
    return episodes;
  },
};
