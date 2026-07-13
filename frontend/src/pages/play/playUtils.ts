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

/**
 * Resolve which episode to resume from.
 *
 * 1. Exact name match against the current source's episode list.
 * 2. If the name is missing but a valid `resumeIndex` is stored, fall back to
 *    that index — this reconciles sources whose episode names differ (e.g.
 *    "第1集" vs "EP01") so cross-source resume stays on the right episode.
 * 3. Otherwise fall back to the first episode (or null when the list is empty).
 */
export function resolveResumeEpisode(
  episodes: Episode[],
  resumeEpisode?: string | null,
  resumeIndex?: number | null,
): Episode | null {
  if (resumeEpisode) {
    const hit = episodes.find((e) => e.name === resumeEpisode);
    if (hit) return hit;
  }
  if (resumeIndex != null && resumeIndex >= 0 && resumeIndex < episodes.length) {
    return episodes[resumeIndex];
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
 * Resume from the local continue-watching record — no URL involvement.
 *
 * Reads the last watched episode + progress from `historyStore` for the given
 * `site`/`id`, seeks the player to the stored progress, and returns the
 * Episode to resume (matched by name against the *current source's* episode
 * list, so resume works regardless of which source ends up playing).
 *
 * The continue-watching card simply links to `/play/site/id`; the page
 * hydrates resume state from history on load, keeping the URL clean.
 */
export async function applyResumeProgress(
  setCurrentTime: (time: number) => void,
  toast: (message: string, type?: ToastType, duration?: number) => void,
  site: string | undefined,
  id: string | undefined,
  episodes: Episode[],
): Promise<Episode | null> {
  const rec =
    site && id
      ? await historyStore.get(site, id).catch((err) => {
          console.warn('Play: failed to read resume record', err);
          return undefined;
        })
      : undefined;

  const episode = resolveResumeEpisode(episodes, rec?.episode ?? null, rec?.episodeIndex ?? null);
  const time = rec?.progress && rec.progress > 0 ? rec.progress : 0;

  if (time > 0 && episode) {
    setCurrentTime(time);
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    toast(`已从 ${minutes}:${seconds.toString().padStart(2, '0')} 继续播放`);
  }
  return episode;
}
