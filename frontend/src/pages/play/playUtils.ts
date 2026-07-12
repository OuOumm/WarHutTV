import { historyStore } from '../../store/history';
import type { ToastType } from '../../components/ToastProvider';
import type { Episode } from './types';

export function parseEpisodes(playUrl: string): Episode[] {
  const episodeMap = new Map<string, Episode>();

  playUrl.split('$$$').forEach((segment) => {
    segment.split('#').filter((episode) => episode.trim()).forEach((episode) => {
      const parts = episode.split('$');
      const name = parts[0] || '播放';
      const newUrl = parts[1] || '';
      if (!episodeMap.has(name)) {
        episodeMap.set(name, { name, url: newUrl });
        return;
      }
      if (newUrl.includes('.m3u8')) {
        episodeMap.set(name, { name, url: newUrl });
      }
    });
  });

  return Array.from(episodeMap.values());
}

export function parseSpeed(speedStr: string): number {
  const match = speedStr.match(/([\d.]+)\s*(KB|MB|GB)\/s/i);
  if (!match) return 0;
  const value = parseFloat(match[1]);
  const unit = match[2].toUpperCase();
  if (unit === 'GB') return value * 1024;
  if (unit === 'MB') return value;
  return value / 1024;
}

export async function getPlayableUrl(url: string, sourceKey?: string) {
  void sourceKey;
  if (!url) return url;
  if (!url.includes('.m3u8')) return url;

  const adEnabled = localStorage.getItem('enable_blockad') !== 'false';
  if (!adEnabled) return url;

  const { fetchAndFilterM3U8 } = await import('../../utils/adblock');
  return fetchAndFilterM3U8(url);
}

export async function applyHistoryProgress(
  setCurrentTime: (time: number) => void,
  toast: (message: string) => void,
  currentSiteKey: string,
  vodId: string | number,
) {
  try {
    const record = await historyStore.get(currentSiteKey, vodId);
    if (!record?.progress || record.progress <= 0) return;

    setCurrentTime(record.progress);
    const minutes = Math.floor(record.progress / 60);
    const seconds = Math.floor(record.progress % 60);
    toast(`已从 ${minutes}:${seconds.toString().padStart(2, '0')} 继续播放`);
  } catch (err) {
    console.warn('Play: failed to apply history progress', err);
  }
}

/**
 * Resolve which episode to resume from. When `initialEpisode` is supplied
 * (e.g. from a "继续观看" deep-link) we match it by exact name; otherwise we
 * fall back to the first episode — preserving the previous default behaviour
 * for normal (search / favorite) entry points.
 */
export function resolveResumeEpisode(episodes: Episode[], initialEpisode?: string): Episode | null {
  if (initialEpisode) {
    const hit = episodes.find((e) => e.name === initialEpisode);
    if (hit) return hit;
  }
  return episodes.length > 0 ? episodes[0] : null;
}

/** Index of the page that should be visible so `target` is in view. */
export function episodePageIndex(episodes: Episode[], target: Episode | null, perPage: number): number {
  if (!target) return 0;
  const idx = episodes.findIndex((e) => e.name === target.name);
  return idx < 0 ? 0 : Math.floor(idx / perPage);
}

/**
 * Resume playback time — driven entirely by the deep-link params the
 * continue-watching card writes (`?ep=&t=`). No history lookup: the card
 * already carries the stored progress, so resume is source-agnostic.
 */
export async function applyResumeProgress(
  setCurrentTime: (time: number) => void,
  toast: (message: string, type?: ToastType, duration?: number) => void,
  episode: Episode | null,
  initialTime?: number,
): Promise<number> {
  void episode;
  const time = initialTime && initialTime > 0 ? initialTime : 0;
  if (time > 0) {
    setCurrentTime(time);
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    toast(`已从 ${minutes}:${seconds.toString().padStart(2, '0')} 继续播放`);
  }
  return time;
}
