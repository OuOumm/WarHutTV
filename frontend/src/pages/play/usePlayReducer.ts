import { useReducer } from 'react';
import type { VideoDetail } from '../../types';
import type {
  Episode,
  SearchProgress,
  SearchSiteData,
  SourceItem,
} from './types';

/**
 * Single source of truth for the Play page's view state. All the former
 * `useState` calls (22 of them) live here as one reducer, so mutations go
 * through explicit actions instead of scattered setters — that is the
 * "state machine" the page relies on, and it flattens the call chain.
 */
export interface PlayState {
  detail: VideoDetail | null;
  episodes: Episode[];
  currentEpisode: Episode | null;
  playUrl: string;
  isFavorite: boolean;
  loading: boolean;
  sourceSwitching: boolean;
  activeTab: 'episodes' | 'sources';
  sources: SourceItem[];
  currentSource: string;
  sourceLoading: boolean;
  isOptimizing: boolean;
  searchDataCache: SearchSiteData[] | null;
  currentTime: number;
  /** Real media duration (seconds) reported by the player; 0 until known. */
  duration: number;
  /**
   * True when the pending `playUrl` change is a deliberate **episode switch**
   * (clicking an episode / next-episode button) that must start from 0:00.
   * False for source switches / optimization, which should resume the same
   * episode at its stored progress. The Player reads this to avoid falling
   * back to the *previous* episode's `video.currentTime` (which would make the
   * next episode inherit the old progress).
   */
  switchStartsFromZero: boolean;
  optimizeComplete: boolean;
  episodePage: number;
  searchProgress: SearchProgress | null;
}

export type PlayAction =
  | { type: 'patch'; payload: Partial<PlayState> }
  | {
      type: 'setSourceStatus';
      index: number;
      status: SourceItem['status'];
      speed?: SourceItem['speed'];
    }
  | {
      type: 'applySource';
      source: {
        key: string;
        detail: VideoDetail;
        episodes: Episode[];
        playUrl: string;
        /** Optional resume episode; falls back to `episodes[0]` when omitted. */
        currentEpisode?: Episode | null;
      };
      activeTab?: 'episodes' | 'sources';
    };

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
  duration: 0,
  switchStartsFromZero: false,
  optimizeComplete: false,
  episodePage: 0,
  searchProgress: null,
};

// Exported for unit testing; the hook is just `useReducer(reducer, initialState)`.
export function reducer(state: PlayState, action: PlayAction): PlayState {
  switch (action.type) {
    case 'patch':
      return { ...state, ...action.payload };

    case 'setSourceStatus':
      // Safe under concurrent speed-test updates: the reducer always sees the
      // latest `sources`, so parallel dispatches never clobber each other.
      return {
        ...state,
        sources: state.sources.map((s, i) =>
          i === action.index
            ? { ...s, status: action.status, speed: action.speed ?? s.speed }
            : s,
        ),
      };

    case 'applySource': {
      const episodes = action.source.episodes;
      return {
        ...state,
        currentSource: action.source.key,
        detail: action.source.detail,
        episodes,
        currentEpisode: action.source.currentEpisode ?? (episodes.length > 0 ? episodes[0] : null),
        playUrl: action.source.playUrl,
        // 换源必从续播点恢复，绝不从 0 开始（与切集区分）
        switchStartsFromZero: false,
        activeTab: action.activeTab ?? state.activeTab,
      };
    }

    default:
      return state;
  }
}

export function usePlayReducer() {
  const [state, dispatch] = useReducer(reducer, initialState);
  return { state, dispatch };
}
