import { db } from './db';
import type { Favorite } from './db';
import type { VideoItem } from '../types';

/**
 * Lightweight pub/sub so any mounted card can react to favorites changes made
 * elsewhere (e.g. toggling on another card or page) without polling.
 */
const favoritesListeners = new Set<() => void>();
export function subscribeFavorites(fn: () => void): () => void {
  favoritesListeners.add(fn);
  return () => {
    favoritesListeners.delete(fn);
  };
}
function emitFavoritesChanged() {
  favoritesListeners.forEach((fn) => fn());
}

/**
 * Normalize the favorite key. Video sources are inconsistent: API lists return
 * `vod_id` as a number, while the play route stores it as a string (the URL
 * param). Dexie's `.equals()` is type-strict, so a number 42 and string "42"
 * never match — which made already-favorited items on the History page show an
 * empty heart. We always store and compare the string form to fix that.
 */
function normId(id: string | number): string {
  return String(id);
}

export const favoritesStore = {
  async add(video: VideoItem): Promise<void> {
    const id = normId(video.vod_id);
    const exists = await db.favorites.where('vod_id').equals(id).first();
    if (!exists) {
      await db.favorites.add({
        ...video,
        vod_id: id,
        addedAt: Date.now(),
      });
      emitFavoritesChanged();
    }
  },

  async remove(vodId: string | number): Promise<void> {
    await db.favorites.where('vod_id').equals(normId(vodId)).delete();
    emitFavoritesChanged();
  },

  async toggle(video: VideoItem): Promise<boolean> {
    const id = normId(video.vod_id);
    const exists = await db.favorites.where('vod_id').equals(id).first();
    if (exists) {
      await this.remove(id);
      return false;
    } else {
      await this.add(video);
      return true;
    }
  },

  async isFavorite(vodId: string | number): Promise<boolean> {
    const id = normId(vodId);
    if (await db.favorites.where('vod_id').equals(id).first()) return true;
    // Fallback for legacy records stored before vod_id was normalized to string.
    if (id !== vodId) {
      return !!(await db.favorites.where('vod_id').equals(vodId).first());
    }
    return false;
  },

  async getAll(): Promise<Favorite[]> {
    return db.favorites.orderBy('addedAt').reverse().toArray();
  },

  async clear(): Promise<void> {
    await db.favorites.clear();
    emitFavoritesChanged();
  },
};
