import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePlaybackProgress } from './usePlaybackProgress';
import { historyStore } from '../../store/history';
import type { PlayControllerDeps } from './playContext';
import type { PlayState } from './usePlayReducer';
import type { Episode } from './types';

const eps: Episode[] = [
  { name: '第1集', url: 'a' },
  { name: '第2集', url: 'b' },
  { name: '第3集', url: 'c' },
];

function makeState(over: Partial<PlayState> = {}): PlayState {
  return {
    detail: null,
    episodes: [],
    currentEpisode: null,
    playUrl: '',
    isFavorite: false,
    loading: true,
    sourceSwitching: false,
    activeTab: 'episodes',
    sources: [],
    currentSource: '',
    sourceLoading: false,
    isOptimizing: false,
    searchDataCache: null,
    currentTime: 0,
    duration: 0,
    switchStartsFromZero: false,
    optimizeComplete: false,
    episodePage: 0,
    searchProgress: null,
    ...over,
  };
}

function buildDeps(state: PlayState): { deps: PlayControllerDeps } {
  const deps: PlayControllerDeps = {
    state,
    dispatch: vi.fn(),
    stateRef: { current: state },
    toast: vi.fn(),
    navigate: vi.fn(),
    site: 's1',
    id: '42',
    episodesPerPage: 10,
    setCurrentTime: vi.fn(),
    searchAbortRef: { current: null },
    playRequestId: { current: 0 },
    switchRequestId: { current: 0 },
    optimizeStarted: { current: false },
    sourceListRef: { current: null },
  };
  return { deps };
}

describe('usePlaybackProgress.tick / flush (single-writer, P1-1 episodeIndex write)', () => {
  beforeEach(async () => {
    await historyStore.clear();
  });

  it('writes at most once per throttle window on a rapid burst of ticks', async () => {
    const recordSpy = vi.spyOn(historyStore, 'record').mockResolvedValue();
    const { deps } = buildDeps(
      makeState({
        currentTime: 10,
        duration: 1000,
        episodes: eps,
        currentEpisode: eps[2],
        detail: { vod_id: '42', vod_name: '剧集', vod_pic: '' },
      }),
    );
    const { result } = renderHook(() => usePlaybackProgress(deps));

    await act(async () => {
      result.current.tick(10, 1000);
      result.current.tick(20, 1000);
      result.current.tick(30, 1000);
      await Promise.resolve();
    });

    expect(recordSpy).toHaveBeenCalledTimes(1);
    recordSpy.mockRestore();
  });

  it('does not record when currentTime is 0 (gate)', async () => {
    const recordSpy = vi.spyOn(historyStore, 'record').mockResolvedValue();
    const { deps } = buildDeps(
      makeState({
        currentTime: 0,
        duration: 1000,
        episodes: eps,
        currentEpisode: eps[0],
        detail: { vod_id: '42', vod_name: '剧集', vod_pic: '' },
      }),
    );
    const { result } = renderHook(() => usePlaybackProgress(deps));

    await act(async () => {
      await result.current.flush();
    });

    expect(recordSpy).not.toHaveBeenCalled();
    recordSpy.mockRestore();
  });

  it('does not record when duration is 0 (gate)', async () => {
    const recordSpy = vi.spyOn(historyStore, 'record').mockResolvedValue();
    const { deps } = buildDeps(
      makeState({
        currentTime: 50,
        duration: 0,
        episodes: eps,
        currentEpisode: eps[0],
        detail: { vod_id: '42', vod_name: '剧集', vod_pic: '' },
      }),
    );
    const { result } = renderHook(() => usePlaybackProgress(deps));

    await act(async () => {
      await result.current.flush();
    });

    expect(recordSpy).not.toHaveBeenCalled();
    recordSpy.mockRestore();
  });

  it('writes the matched episode index and the real duration into the history record', async () => {
    const { deps } = buildDeps(
      makeState({
        currentTime: 120,
        duration: 1500,
        episodes: eps,
        currentEpisode: eps[2],
        detail: { vod_id: '42', vod_name: '剧集', vod_pic: '' },
      }),
    );
    const { result } = renderHook(() => usePlaybackProgress(deps));

    await act(async () => {
      result.current.tick(120, 1500);
      await result.current.flush();
    });

    await vi.waitFor(async () => {
      const rec = await historyStore.get('s1', '42');
      expect(rec).toBeDefined();
      expect(rec!.episode).toBe('第3集');
      expect(rec!.episodeIndex).toBe(2);
      expect(rec!.progress).toBe(120);
      expect(rec!.duration).toBe(1500);
    });
  });

  it('writes episodeIndex null when the current episode name is absent from the list', async () => {
    const { deps } = buildDeps(
      makeState({
        currentTime: 5,
        duration: 800,
        episodes: eps,
        currentEpisode: { name: '缺失集', url: 'z' },
        detail: { vod_id: '42', vod_name: '剧集', vod_pic: '' },
      }),
    );
    const { result } = renderHook(() => usePlaybackProgress(deps));

    await act(async () => {
      result.current.tick(5, 800);
      await result.current.flush();
    });

    await vi.waitFor(async () => {
      const rec = await historyStore.get('s1', '42');
      expect(rec).toBeDefined();
      expect(rec!.episode).toBe('缺失集');
      expect(rec!.episodeIndex).toBeNull();
    });
  });

  it('does not immediately record again within the throttle window after a flush (dirty reset)', async () => {
    const recordSpy = vi.spyOn(historyStore, 'record').mockResolvedValue();
    const { deps } = buildDeps(
      makeState({
        currentTime: 10,
        duration: 1000,
        episodes: eps,
        currentEpisode: eps[0],
        detail: { vod_id: '42', vod_name: '剧集', vod_pic: '' },
      }),
    );
    const { result } = renderHook(() => usePlaybackProgress(deps));

    await act(async () => {
      await result.current.flush();
    });
    await act(async () => {
      result.current.tick(20, 1000);
      await Promise.resolve();
    });

    expect(recordSpy).toHaveBeenCalledTimes(1);
    recordSpy.mockRestore();
  });

  it('flushes the dirty progress immediately on visibilitychange(hidden)', async () => {
    const recordSpy = vi.spyOn(historyStore, 'record').mockResolvedValue();
    const { deps } = buildDeps(
      makeState({
        currentTime: 10,
        duration: 1000,
        episodes: eps,
        currentEpisode: eps[0],
        detail: { vod_id: '42', vod_name: '剧集', vod_pic: '' },
      }),
    );
    const { result } = renderHook(() => usePlaybackProgress(deps));

    // First tick writes immediately (lastWriteRef starts at 0); the second tick
    // lands inside the 3s throttle window and only marks dirty.
    await act(async () => {
      result.current.tick(10, 1000);
      await Promise.resolve();
      result.current.tick(20, 1000);
      await Promise.resolve();
    });
    expect(recordSpy).toHaveBeenCalledTimes(1);

    // Simulating the tab going hidden must trigger an immediate flush of the
    // unsaved (dirty) position.
    const visibilitySpy = vi
      .spyOn(document, 'visibilityState', 'get')
      .mockReturnValue('hidden');
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
      await Promise.resolve();
    });
    expect(recordSpy).toHaveBeenCalledTimes(2);

    visibilitySpy.mockRestore();
    recordSpy.mockRestore();
  });

  it('flushes the dirty progress immediately on pagehide', async () => {
    const recordSpy = vi.spyOn(historyStore, 'record').mockResolvedValue();
    const { deps } = buildDeps(
      makeState({
        currentTime: 10,
        duration: 1000,
        episodes: eps,
        currentEpisode: eps[0],
        detail: { vod_id: '42', vod_name: '剧集', vod_pic: '' },
      }),
    );
    const { result } = renderHook(() => usePlaybackProgress(deps));

    await act(async () => {
      result.current.tick(10, 1000);
      await Promise.resolve();
      result.current.tick(20, 1000);
      await Promise.resolve();
    });
    expect(recordSpy).toHaveBeenCalledTimes(1);

    await act(async () => {
      window.dispatchEvent(new Event('pagehide'));
      await Promise.resolve();
    });
    expect(recordSpy).toHaveBeenCalledTimes(2);

    recordSpy.mockRestore();
  });
});
