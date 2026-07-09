import { useRef, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useToast } from '../../components/ToastProvider';
import { usePlayReducer } from './usePlayReducer';
import { useSourceSearch } from './useSourceSearch';
import { useSourceSwitch } from './useSourceSwitch';
import { useEpisodeNav } from './useEpisodeNav';
import { usePlaybackProgress } from './usePlaybackProgress';
import { useFavoriteToggle } from './useFavoriteToggle';
import { useDetailLoader } from './useDetailLoader';
import type { PlayControllerDeps } from './playContext';
import type { VideoDetail } from './types';

const EPISODES_PER_PAGE = 50;

/**
 * Composition root for the Play page.
 *
 * Formerly a 532-line god hook. Now it owns the shared refs/state and injects
 * them into focused sub-hooks (search / switch / episode / progress / favorite
 * / detail), each in its own file. Behaviour is unchanged — every mutation
 * still flows through the single `usePlayReducer` instance.
 */
export function usePlayController() {
  const { site, id } = useParams<{ site: string; id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { state, dispatch } = usePlayReducer();

  // Mirror the latest reducer state for use inside async callbacks without
  // stale-closure bugs (the former code relied on functional setState updates).
  const stateRef = useRef(state);
  // eslint-disable-next-line react-hooks/refs -- intentional "latest value" ref mirror
  stateRef.current = state;

  const optimizeStarted = useRef(false);
  const searchAbortRef = useRef<AbortController | null>(null);
  const playRequestId = useRef(0);
  const switchRequestId = useRef(0);
  const sourceListRef = useRef<HTMLDivElement>(null);

  const setCurrentTime = useCallback(
    (time: number) => dispatch({ type: 'patch', payload: { currentTime: time } }),
    [dispatch],
  );

  const deps: PlayControllerDeps = {
    state,
    dispatch,
    stateRef,
    toast,
    navigate,
    site,
    id,
    setCurrentTime,
    searchAbortRef,
    playRequestId,
    switchRequestId,
    optimizeStarted,
    sourceListRef,
  };

  const { streamSearch, startOptimize } = useSourceSearch(deps);
  const { handleSourceSwitch } = useSourceSwitch(deps, streamSearch);
  const { handleEpisodeClick } = useEpisodeNav(deps);
  const { handleTimeUpdate, clearInvalidHistory } = usePlaybackProgress(deps);
  const { toggleFavorite } = useFavoriteToggle(deps);
  const { loadDetail } = useDetailLoader(deps, startOptimize);

  // Scroll the active source into view when the selection or list changes.
  useEffect(() => {
    if (!sourceListRef.current) return;
    const active = sourceListRef.current.querySelector('[data-active="true"]');
    if (!active) return;

    const container = sourceListRef.current;
    const elRect = active.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    const offset =
      elRect.top - containerRect.top - containerRect.height / 2 + elRect.height / 2;
    container.scrollBy({ top: offset, behavior: 'smooth' });
  }, [state.currentSource, state.sources]);

  useEffect(() => {
    if (site && id) {
      optimizeStarted.current = false;
      loadDetail();
    }

    return () => {
      searchAbortRef.current?.abort();
      searchAbortRef.current = null;
    };
  }, [site, id, loadDetail]);

  return {
    activeTab: state.activeTab,
    clearInvalidHistory,
    currentDetail:
      state.detail || { vod_id: id || '', vod_name: '', vod_pic: '', vod_play_url: '' } satisfies VideoDetail,
    currentEpisode: state.currentEpisode,
    currentTime: state.currentTime,
    detail: state.detail,
    episodePage: state.episodePage,
    episodes: state.episodes,
    episodesPerPage: EPISODES_PER_PAGE,
    handleEpisodeClick,
    handleSourceSwitch,
    handleTimeUpdate,
    historyVodId: state.historyVodId,
    isFavorite: state.isFavorite,
    isOptimizing: state.isOptimizing,
    loading: state.loading,
    optimizeComplete: state.optimizeComplete,
    playUrl: state.playUrl,
    searchProgress: state.searchProgress,
    setActiveTab: (tab: 'episodes' | 'sources') =>
      dispatch({ type: 'patch', payload: { activeTab: tab } }),
    setEpisodePage: (page: number) => dispatch({ type: 'patch', payload: { episodePage: page } }),
    sourceListRef,
    sourceLoading: state.sourceLoading,
    sourceSwitching: state.sourceSwitching,
    sources: state.sources,
    currentSource: state.currentSource,
    site,
    toggleFavorite,
  };
}
