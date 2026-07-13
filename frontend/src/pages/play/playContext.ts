import type { Dispatch, MutableRefObject, RefObject } from 'react';
import type { PlayState, PlayAction } from './usePlayReducer';
import type { ToastType } from '../../components/ToastProvider';

/**
 * Shared dependencies passed to every play-sub-hook.
 *
 * `usePlayController` owns the refs/state and injects them here so the
 * concern-specific hooks (search / switch / episode / progress / favorite /
 * detail) can stay in separate files without each re-declaring the reducer,
 * toast, navigation, or request-id refs. All handlers still flow through the
 * single `usePlayReducer` instance — behaviour is identical to the former
 * 532-line god hook, just split by responsibility.
 */
export interface PlayControllerDeps {
  state: PlayState;
  dispatch: Dispatch<PlayAction>;
  stateRef: MutableRefObject<PlayState>;
  toast: (message: string, type?: ToastType, duration?: number) => void;
  navigate: (path: string) => void;
  site?: string;
  id?: string;
  episodesPerPage: number;
  setCurrentTime: (t: number) => void;
  searchAbortRef: MutableRefObject<AbortController | null>;
  playRequestId: MutableRefObject<number>;
  switchRequestId: MutableRefObject<number>;
  optimizeStarted: MutableRefObject<boolean>;
  sourceListRef: RefObject<HTMLDivElement | null>;
}
