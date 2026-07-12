import { describe, it, expect } from 'vitest';
import { reducer, type PlayState } from './usePlayReducer';
import type { Episode, SourceItem, VideoDetail } from './types';

const initialState: PlayState = {
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
  optimizeComplete: false,
  episodePage: 0,
  searchProgress: null,
};

describe('usePlayReducer', () => {
  it('patch merges partial state without dropping other fields', () => {
    const next = reducer(initialState, { type: 'patch', payload: { loading: false } });
    expect(next.loading).toBe(false);
    expect(next.activeTab).toBe('episodes');
    expect(next.isOptimizing).toBe(false);
  });

  it('applySource sets detail/episodes/currentEpisode/playUrl', () => {
    const episodes: Episode[] = [
      { name: '第1集', url: 'a.m3u8' },
      { name: '第2集', url: 'b.m3u8' },
    ];
    const detail: VideoDetail = {
      vod_id: '42',
      vod_name: '测试剧',
      vod_pic: '',
    };
    const next = reducer(initialState, {
      type: 'applySource',
      source: {
        key: 'siteA',
        detail,
        episodes,
        playUrl: 'a.m3u8',
      },
      activeTab: 'sources',
    });

    expect(next.currentSource).toBe('siteA');
    expect(next.detail).toBe(detail);
    expect(next.episodes).toEqual(episodes);
    expect(next.currentEpisode).toBe(episodes[0]);
    expect(next.playUrl).toBe('a.m3u8');
    // activeTab honoured when provided
    expect(next.activeTab).toBe('sources');
  });

  it('applySource defaults activeTab to previous when omitted', () => {
    const next = reducer(
      { ...initialState, activeTab: 'sources' },
      {
        type: 'applySource',
        source: {
          key: 'siteA',
          detail: { vod_id: '1', vod_name: 'x', vod_pic: '' },
          episodes: [],
          playUrl: '',
        },
      },
    );
    expect(next.activeTab).toBe('sources');
  });

  it('setSourceStatus updates only the targeted source (concurrent-safe)', () => {
    const sources: SourceItem[] = [
      { key: 'a', name: 'A', status: 'pending', vodId: 1 },
      { key: 'b', name: 'B', status: 'pending', vodId: 2 },
      { key: 'c', name: 'C', status: 'pending', vodId: 3 },
    ];
    const next = reducer(
      { ...initialState, sources },
      { type: 'setSourceStatus', index: 1, status: 'done', speed: { quality: 'good', loadSpeed: '123', pingTime: 0 } },
    );

    expect(next.sources[1].status).toBe('done');
    expect(next.sources[1].speed).toEqual({ quality: 'good', loadSpeed: '123', pingTime: 0 });
    // Untouched sources keep their identity/values
    expect(next.sources[0]).toBe(sources[0]);
    expect(next.sources[2]).toBe(sources[2]);
    expect(next.sources[0].status).toBe('pending');
  });

  it('two setSourceStatus dispatches never clobber each other', () => {
    const sources: SourceItem[] = [
      { key: 'a', name: 'A', status: 'pending', vodId: 1 },
      { key: 'b', name: 'B', status: 'pending', vodId: 2 },
    ];
    let s = reducer({ ...initialState, sources }, { type: 'setSourceStatus', index: 0, status: 'done' });
    s = reducer(s, { type: 'setSourceStatus', index: 1, status: 'error' });
    expect(s.sources[0].status).toBe('done');
    expect(s.sources[1].status).toBe('error');
  });
});
