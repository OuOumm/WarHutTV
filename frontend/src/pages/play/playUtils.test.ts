import { describe, it, expect, beforeEach, vi } from 'vitest';
import { resolveResumeEpisode, applyResumeProgress, sortSourcesBySpeed } from './playUtils';
import { historyStore } from '../../store/history';
import type { Episode, SourceItem } from './types';

const eps: Episode[] = [
  { name: '第1集', url: 'a.m3u8' },
  { name: '第2集', url: 'b.m3u8' },
  { name: '第3集', url: 'c.m3u8' },
];

describe('resolveResumeEpisode (P0-2 / P1-1 index fallback)', () => {
  it('returns the exact-name match when present', () => {
    expect(resolveResumeEpisode(eps, '第2集', null)).toBe(eps[1]);
  });

  it('falls back to the stored index when the name mismatches across sources', () => {
    // Cross-source scenario: stored episode name ("EP02") differs from the new
    // source's naming, but the stored index still points at the right slot.
    expect(resolveResumeEpisode(eps, 'EP02', 1)).toBe(eps[1]);
  });

  it('falls back to the first episode when name is missing and index is out of bounds', () => {
    expect(resolveResumeEpisode(eps, null, 99)).toBe(eps[0]);
  });

  it('falls back to the first episode when the index is negative', () => {
    expect(resolveResumeEpisode(eps, 'nope', -3)).toBe(eps[0]);
  });

  it('prefers an exact name match over a (stale) index', () => {
    expect(resolveResumeEpisode(eps, '第3集', 0)).toBe(eps[2]);
  });

  it('returns null for an empty episode list regardless of hints', () => {
    expect(resolveResumeEpisode([], '第1集', 0)).toBeNull();
    expect(resolveResumeEpisode([], null, null)).toBeNull();
  });
});

describe('applyResumeProgress (P1-1 full read chain)', () => {
  beforeEach(async () => {
    await historyStore.clear();
  });

  it('resumes by stored episodeIndex when the episode name differs across sources', async () => {
    const setCurrentTime = vi.fn();
    const toast = vi.fn();
    // Seed a record whose stored name is NOT in the new source's list, but
    // whose episodeIndex points at the correct slot (index-based resume).
    await historyStore.record('s1', '42', {
      vod_name: '跨源剧',
      vod_pic: '',
      episode: 'OldName-EP2',
      episodeIndex: 1,
      progress: 130,
      duration: 0,
    });

    const target = await applyResumeProgress(setCurrentTime, toast, 's1', '42', eps);

    expect(target).toBe(eps[1]); // index fallback, not episodes[0]
    expect(setCurrentTime).toHaveBeenCalledWith(130);
  });

  it('falls back to the first episode when index is out of bounds', async () => {
    const setCurrentTime = vi.fn();
    const toast = vi.fn();
    await historyStore.record('s1', '42', {
      vod_name: '跨源剧',
      vod_pic: '',
      episode: 'Unknown',
      episodeIndex: 42,
      progress: 0,
      duration: 0,
    });

    const target = await applyResumeProgress(setCurrentTime, toast, 's1', '42', eps);
    expect(target).toBe(eps[0]);
  });
});

describe('sortSourcesBySpeed (换源列表按速度排序)', () => {
  const mk = (key: string, status: SourceItem['status'], loadSpeed?: string): SourceItem => ({
    key,
    name: key,
    vodId: key,
    status,
    speed: loadSpeed ? { quality: '1080p', loadSpeed, pingTime: 10 } : null,
  });

  it('puts the faster source above the slower one', () => {
    const slow = mk('a', 'done', '1 KB/s');
    const fast = mk('b', 'done', '5 MB/s');
    expect(sortSourcesBySpeed([slow, fast]).map((s) => s.key)).toEqual(['b', 'a']);
  });

  it('sinks failed (status==="error") sources to the bottom regardless of speed', () => {
    const failed = mk('a', 'error');
    const fast = mk('b', 'done', '5 MB/s');
    expect(sortSourcesBySpeed([failed, fast]).map((s) => s.key)).toEqual(['b', 'a']);
  });

  it('ranks untested speed-less sources above failed but below measured ones', () => {
    const noSpeed = mk('a', 'done'); // done but no speed
    const fast = mk('b', 'done', '5 MB/s');
    const failed = mk('c', 'error');
    expect(sortSourcesBySpeed([noSpeed, fast, failed]).map((s) => s.key)).toEqual(['b', 'a', 'c']);
  });

  it('keeps original order as a stable tiebreaker for equal speeds', () => {
    const first = mk('a', 'done', '2 MB/s');
    const second = mk('b', 'done', '2 MB/s');
    expect(sortSourcesBySpeed([first, second]).map((s) => s.key)).toEqual(['a', 'b']);
  });

  it('does not mutate the input array', () => {
    const input = [mk('a', 'error'), mk('b', 'done', '5 MB/s')];
    const snapshot = input.map((s) => s.key);
    sortSourcesBySpeed(input);
    expect(input.map((s) => s.key)).toEqual(snapshot);
  });
});
