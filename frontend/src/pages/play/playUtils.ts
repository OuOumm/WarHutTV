import { historyStore } from '../../store/history';
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
  episodeName?: string,
) {
  try {
    const record = await historyStore.getByContext(currentSiteKey, vodId, episodeName);
    if (!record?.progress || record.progress <= 0) return;

    setCurrentTime(record.progress);
    const minutes = Math.floor(record.progress / 60);
    const seconds = Math.floor(record.progress % 60);
    toast(`已从 ${minutes}:${seconds.toString().padStart(2, '0')} 继续播放`);
  } catch (err) {
    console.warn('Play: failed to apply history progress', err);
  }
}
