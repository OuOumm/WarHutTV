import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSourceSwitch } from './useSourceSwitch';
import type { PlayControllerDeps } from './playContext';
import type { PlayState } from './usePlayReducer';
import type { SearchSiteData, VideoDetail } from './types';
import type { Mock } from 'vitest';

// --- Mock external dependencies of useSourceSwitch -----------------------------
const mocks = vi.hoisted(() => ({
  getCachedDetail: vi.fn(),
  filterYellowItems: vi.fn(),
}));

vi.mock('./playApi', () => ({ getCachedDetail: mocks.getCachedDetail }));
vi.mock('../../utils/filter', () => ({
  filterYellowItems: mocks.filterYellowItems,
  isExactMatch: () => true,
}));

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
    optimizeComplete: false,
    episodePage: 0,
    searchProgress: null,
    ...over,
  };
}

interface Built {
  deps: PlayControllerDeps;
  dispatch: Mock;
  toast: Mock;
  switchRequestId: { current: number };
}

function buildDeps(state: PlayState): Built {
  const dispatch = vi.fn();
  const toast = vi.fn();
  const stateRef = { current: state };
  const searchAbortRef = { current: null };
  const playRequestId = { current: 0 };
  const switchRequestId = { current: 0 };
  const optimizeStarted = { current: false };
  const sourceListRef = { current: null };
  const deps: PlayControllerDeps = {
    state,
    dispatch,
    stateRef,
    toast,
    navigate: vi.fn(),
    site: undefined,
    id: undefined,
    episodesPerPage: 10,
    setCurrentTime: vi.fn(),
    searchAbortRef,
    playRequestId,
    switchRequestId,
    optimizeStarted,
    sourceListRef,
  };
  return { deps, dispatch, toast, switchRequestId };
}

function dispatchSetNewSource(dispatch: Mock, key: string): boolean {
  const calls = (dispatch as unknown as { mock: { calls: unknown[][] } }).mock.calls;
  return calls.some(([a]) => {
    const action = a as { type?: string; source?: { key?: string } } | undefined;
    return action?.type === 'applySource' && action.source?.key === key;
  });
}

describe('useSourceSwitch.handleSourceSwitch (P0-1 failure paths)', () => {
  beforeEach(() => {
    mocks.getCachedDetail.mockReset();
    mocks.filterYellowItems.mockReset();
    // Default: filterYellowItems passes the list through unchanged.
    mocks.filterYellowItems.mockImplementation((list: unknown) => list as unknown);
  });

  it('does nothing when switching to the already-active source', async () => {
    const { deps, dispatch } = buildDeps(makeState({ currentSource: 'siteA' }));
    const streamSearch = vi.fn(async () => [] as SearchSiteData[]);
    const { result } = renderHook((p) => useSourceSwitch(p.deps, p.streamSearch), {
      initialProps: { deps, streamSearch },
    });

    await act(async () => {
      await result.current.handleSourceSwitch('siteA');
    });

    expect(dispatch).not.toHaveBeenCalled();
  });

  it('keeps currentSource and shows an error toast when getCachedDetail returns null', async () => {
    mocks.getCachedDetail.mockResolvedValue(null);
    const searchDataCache = [
      { site_key: 'siteB', list: [{ vod_id: '123', vod_name: 'x' }] },
    ] as unknown as SearchSiteData[];
    const state = makeState({
      currentSource: 'siteA',
      searchDataCache,
      detail: { vod_id: '0', vod_name: 'title', vod_pic: '' } as VideoDetail,
    });
    const { deps, dispatch, toast } = buildDeps(state);
    const streamSearch = vi.fn(async () => [] as SearchSiteData[]);
    const { result } = renderHook((p) => useSourceSwitch(p.deps, p.streamSearch), {
      initialProps: { deps, streamSearch },
    });

    await act(async () => {
      await result.current.handleSourceSwitch('siteB');
    });

    // sourceSwitching is flipped on, then cleared by the guarded finally.
    expect(dispatch).toHaveBeenCalledWith({ type: 'patch', payload: { sourceSwitching: true } });
    expect(dispatch).toHaveBeenLastCalledWith({ type: 'patch', payload: { sourceSwitching: false } });
    // currentSource must NOT be rewritten to the failed source.
    expect(dispatchSetNewSource(dispatch, 'siteB')).toBe(false);
    expect(toast).toHaveBeenCalledWith('无法加载该播放源详情', 'error');
  });

  it('shows error toast when the source has no usable list', async () => {
    const state = makeState({ currentSource: 'siteA', searchDataCache: undefined });
    const { deps, dispatch, toast } = buildDeps(state);
    const streamSearch = vi.fn(async () => [] as SearchSiteData[]); // empty -> no data
    const { result } = renderHook((p) => useSourceSwitch(p.deps, p.streamSearch), {
      initialProps: { deps, streamSearch },
    });

    await act(async () => {
      await result.current.handleSourceSwitch('siteB');
    });

    expect(dispatch).toHaveBeenCalledWith({ type: 'patch', payload: { sourceSwitching: true } });
    expect(dispatch).toHaveBeenLastCalledWith({ type: 'patch', payload: { sourceSwitching: false } });
    expect(dispatchSetNewSource(dispatch, 'siteB')).toBe(false);
    expect(toast).toHaveBeenCalledWith('该播放源暂无可用数据', 'error');
  });

  it('shows error toast when the filtered list is empty', async () => {
    mocks.filterYellowItems.mockReturnValue([] as unknown);
    const searchDataCache = [
      { site_key: 'siteB', list: [{ vod_id: '123', vod_name: 'x' }] },
    ] as unknown as SearchSiteData[];
    const state = makeState({ currentSource: 'siteA', searchDataCache });
    const { deps, dispatch, toast } = buildDeps(state);
    const streamSearch = vi.fn(async () => [] as SearchSiteData[]);
    const { result } = renderHook((p) => useSourceSwitch(p.deps, p.streamSearch), {
      initialProps: { deps, streamSearch },
    });

    await act(async () => {
      await result.current.handleSourceSwitch('siteB');
    });

    expect(dispatch).toHaveBeenCalledWith({ type: 'patch', payload: { sourceSwitching: true } });
    expect(dispatch).toHaveBeenLastCalledWith({ type: 'patch', payload: { sourceSwitching: false } });
    expect(dispatchSetNewSource(dispatch, 'siteB')).toBe(false);
    expect(toast).toHaveBeenCalledWith('该播放源内容不可用', 'error');
  });

  it('awaits deps.progressFlush before starting the source lookup', async () => {
    let resolveFlush: (() => void) | undefined;
    const progressFlush = vi.fn(
      () => new Promise<void>((resolve) => { resolveFlush = resolve; }),
    );
    const { deps } = buildDeps(makeState({ currentSource: 'siteA' }));
    deps.progressFlush = progressFlush;
    const streamSearch = vi.fn(async () => [] as SearchSiteData[]);
    const { result } = renderHook((p) => useSourceSwitch(p.deps, p.streamSearch), {
      initialProps: { deps, streamSearch },
    });

    const switchPromise = result.current.handleSourceSwitch('siteB');
    await Promise.resolve();

    expect(progressFlush).toHaveBeenCalledTimes(1);
    expect(streamSearch).not.toHaveBeenCalled();

    resolveFlush?.();
    await act(async () => {
      await switchPromise;
    });

    expect(streamSearch).toHaveBeenCalledTimes(1);
  });

  it('does NOT call deps.progressFlush when switching to the already-active source', async () => {
    const progressFlush = vi.fn();
    const { deps } = buildDeps(makeState({ currentSource: 'siteA' }));
    deps.progressFlush = progressFlush;
    const streamSearch = vi.fn(async () => [] as SearchSiteData[]);
    const { result } = renderHook((p) => useSourceSwitch(p.deps, p.streamSearch), {
      initialProps: { deps, streamSearch },
    });

    await act(async () => {
      await result.current.handleSourceSwitch('siteA');
    });

    expect(progressFlush).not.toHaveBeenCalled();
  });

  it('does not throw when deps.progressFlush is undefined (optional, safe ?.())', async () => {
    const { deps } = buildDeps(makeState({ currentSource: 'siteA' }));
    // deps.progressFlush intentionally left undefined
    const streamSearch = vi.fn(async () => [] as SearchSiteData[]);
    const { result } = renderHook((p) => useSourceSwitch(p.deps, p.streamSearch), {
      initialProps: { deps, streamSearch },
    });

    await act(async () => {
      await expect(result.current.handleSourceSwitch('siteB')).resolves.toBeUndefined();
    });
  });
});
