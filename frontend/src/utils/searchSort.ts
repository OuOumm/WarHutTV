import type { VideoItem } from '../types';
import { normalizeString } from './filter';

/** How the search result grid is ordered. */
export type SortMode = 'default' | 'year-desc' | 'year-asc' | 'sources';

/** Parse `vod_year` without trusting upstream data (may be "", "未知", "2024"). */
export function yearOf(item: VideoItem): number {
  const year = Number.parseInt(String(item.vod_year ?? ''), 10);
  return Number.isFinite(year) && year > 0 ? year : 0;
}

/** The key used to group one title across sources (must match Search.tsx). */
export function aggregateKey(item: VideoItem): string {
  return `${normalizeString(item.vod_name || '')}-${item.vod_year || 'unknown'}`;
}

function compareYears(a: VideoItem, b: VideoItem, mode: SortMode): number {
  const ya = yearOf(a);
  const yb = yearOf(b);
  // Undated entries sink to the bottom in both directions: they tell the user
  // nothing about recency, so they should not lead a "newest first" list.
  if (ya === 0 && yb === 0) return 0;
  if (ya === 0) return 1;
  if (yb === 0) return -1;
  return mode === 'year-desc' ? yb - ya : ya - yb;
}

export interface AggregatedEntry {
  key: string;
  sourceCount: number;
  item: VideoItem;
  title?: string;
}

/**
 * Order aggregated cards.
 *
 * "default" preserves the incoming order, which is the order sources answered
 * in — the fastest upstreams first. Sorting is applied to a copy so the caller
 * can switch back without losing that order.
 */
export function sortAggregated<T extends AggregatedEntry>(entries: T[], mode: SortMode): T[] {
  if (mode === 'default' || entries.length < 2) return entries;

  const sorted = [...entries];
  if (mode === 'sources') {
    sorted.sort((a, b) => b.sourceCount - a.sourceCount || a.key.localeCompare(b.key));
    return sorted;
  }
  sorted.sort((a, b) => compareYears(a.item, b.item, mode) || a.key.localeCompare(b.key));
  return sorted;
}

/**
 * Order the flat (non-aggregated) list.
 *
 * "sources" ranks by how many sources also carry the same title, so entries
 * that exist on many sources rise together — the flat view can then show the
 * best-covered titles first.
 */
export function sortItems(
  items: VideoItem[],
  mode: SortMode,
  sourceCounts?: Map<string, number>,
): VideoItem[] {
  if (mode === 'default' || items.length < 2) return items;

  const sorted = [...items];
  if (mode === 'sources') {
    sorted.sort(
      (a, b) =>
        (sourceCounts?.get(aggregateKey(b)) ?? 0) - (sourceCounts?.get(aggregateKey(a)) ?? 0),
    );
    return sorted;
  }
  sorted.sort((a, b) => compareYears(a, b, mode));
  return sorted;
}
