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
      const vodId = deps.id;
      const siteKey = deps.site || 'default';
      if (!vodId) return;
      const st = stateRef.current;
      historyStore.record(siteKey, vodId, {
        vod_name: st.detail?.vod_name || '',
        vod_pic: st.detail?.vod_pic || '',
        episode: st.currentEpisode?.name ?? null,
        progress: time,
        duration: 0,
      });
    },
    [dispatch, stateRef, deps.id, deps.site],
  );

  const clearInvalidHistory = useCallback(async () => {
    await historyStore.clear();
    navigate('/');
  }, [navigate]);

  return { handleTimeUpdate, clearInvalidHistory };
}
