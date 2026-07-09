import { useCallback } from 'react';
import { historyStore } from '../../store/history';
import type { PlayControllerDeps } from './playContext';

/**
 * Playback time tracking + history sync + invalid-history clearing.
 */
export function usePlaybackProgress(deps: PlayControllerDeps) {
  const { dispatch, stateRef, navigate } = deps;

  const handleTimeUpdate = useCallback(
    (time: number) => {
      dispatch({ type: 'patch', payload: { currentTime: time } });
      const st = stateRef.current;
      if (!st.historyVodId) return;
      historyStore.updateProgressByContext(st.currentSource, st.historyVodId, st.currentEpisode?.name, time, 0);
    },
    [dispatch, stateRef],
  );

  const clearInvalidHistory = useCallback(async () => {
    await historyStore.clear();
    navigate('/');
  }, [navigate]);

  return { handleTimeUpdate, clearInvalidHistory };
}
