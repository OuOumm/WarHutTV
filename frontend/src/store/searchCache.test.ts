import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  SEARCH_CACHE_TTL_MS,
  readSearchCache,
  readSearchScroll,
  removeSearchCache,
  writeSearchCache,
  writeSearchScroll,
} from './searchCache';
import type { VideoItem } from '../types';

const makeItems = (n: number): VideoItem[] =>
  Array.from({ length: n }, (_, i) => ({
    vod_id: i + 1,
    vod_name: `影片${i + 1}`,
    vod_pic: `poster${i + 1}.jpg`,
  }));

describe('searchCache', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  afterEach(() => {
    sessionStorage.clear();
  });

  it('returns null when nothing was stored', () => {
    expect(readSearchCache('凡人')).toBeNull();
  });

  it('round-trips results', () => {
    writeSearchCache('凡人', makeItems(3));

    const cached = readSearchCache('凡人');
    expect(cached).not.toBeNull();
    expect(cached!.results).toHaveLength(3);
    expect(cached!.results[0].vod_name).toBe('影片1');
  });

  it('is per-keyword, not global', () => {
    writeSearchCache('凡人', makeItems(2));
    writeSearchCache('斗破', makeItems(5));

    expect(readSearchCache('凡人')!.results).toHaveLength(2);
    expect(readSearchCache('斗破')!.results).toHaveLength(5);
    expect(readSearchCache('其它')).toBeNull();
  });

  it('treats an entry older than the TTL as a miss and drops it', () => {
    const savedAt = 1_000_000;
    writeSearchCache('凡人', makeItems(2), savedAt);

    const justExpired = savedAt + SEARCH_CACHE_TTL_MS + 1;
    expect(readSearchCache('凡人', justExpired)).toBeNull();
    expect(sessionStorage.getItem('search_cache:凡人')).toBeNull();
  });

  it('still serves an entry that is exactly at the TTL boundary', () => {
    const savedAt = 1_000_000;
    writeSearchCache('凡人', makeItems(2), savedAt);

    expect(readSearchCache('凡人', savedAt + SEARCH_CACHE_TTL_MS)).not.toBeNull();
  });

  it('ignores malformed JSON and cleans it up', () => {
    sessionStorage.setItem('search_cache:凡人', '{ not json');
    expect(readSearchCache('凡人')).toBeNull();
    expect(sessionStorage.getItem('search_cache:凡人')).toBeNull();
  });

  it('ignores entries whose shape does not match', () => {
    sessionStorage.setItem('search_cache:凡人', JSON.stringify({ results: 'nope', savedAt: 1 }));
    expect(readSearchCache('凡人')).toBeNull();
  });

  it('carries the scroll offset recorded separately', () => {
    writeSearchCache('凡人', makeItems(4));
    writeSearchScroll('凡人', 1200);

    const cached = readSearchCache('凡人');
    expect(cached!.scrollY).toBe(1200);
    expect(cached!.results).toHaveLength(4);
  });

  it('defaults the scroll offset to 0 when none was written', () => {
    writeSearchCache('凡人', makeItems(1));
    expect(readSearchCache('凡人')!.scrollY).toBe(0);
  });

  it('rounds and clamps the stored offset', () => {
    writeSearchScroll('凡人', 42.7);
    expect(readSearchScroll('凡人')).toBe(43);

    writeSearchScroll('凡人', -10);
    expect(readSearchScroll('凡人')).toBe(0);
  });

  it('drops the scroll offset together with the results', () => {
    writeSearchCache('凡人', makeItems(1));
    writeSearchScroll('凡人', 500);

    removeSearchCache('凡人');

    expect(readSearchCache('凡人')).toBeNull();
    expect(readSearchScroll('凡人')).toBe(0);
    expect(sessionStorage.getItem('search_scroll:凡人')).toBeNull();
  });

  it('does not resurrect an expired entry by reading its scroll', () => {
    const savedAt = 1_000_000;
    writeSearchCache('凡人', makeItems(2), savedAt);
    writeSearchScroll('凡人', 900);

    // The results are gone, so the offset alone must not revive them.
    expect(readSearchCache('凡人', savedAt + SEARCH_CACHE_TTL_MS + 1)).toBeNull();
  });

  it('does nothing for an empty keyword', () => {
    writeSearchCache('', makeItems(1));
    writeSearchScroll('', 100);
    expect(readSearchCache('')).toBeNull();
    expect(sessionStorage.length).toBe(0);
  });
});
