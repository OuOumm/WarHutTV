import { db } from './db';
import type { Favorite } from './db';
import type { VideoItem } from '../types';

export const favoritesStore = {
  async add(video: VideoItem): Promise<void> {
    const exists = await db.favorites.where('vod_id').equals(video.vod_id).first();
    if (!exists) {
      await db.favorites.add({
        ...video,
        addedAt: Date.now(),
      });
    }
  },

  async remove(vodId: string | number): Promise<void> {
    await db.favorites.where('vod_id').equals(vodId).delete();
  },

  async toggle(video: VideoItem): Promise<boolean> {
    const exists = await db.favorites.where('vod_id').equals(video.vod_id).first();
    if (exists) {
      await this.remove(video.vod_id);
      return false;
    } else {
      await this.add(video);
      return true;
    }
  },

  async isFavorite(vodId: string | number): Promise<boolean> {
    const exists = await db.favorites.where('vod_id').equals(vodId).first();
    return !!exists;
  },

  async getAll(): Promise<Favorite[]> {
    return db.favorites.orderBy('addedAt').reverse().toArray();
  },

  async clear(): Promise<void> {
    await db.favorites.clear();
  },
};
