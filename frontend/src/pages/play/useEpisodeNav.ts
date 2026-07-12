import { useCallback } from 'react';
import apiClient from '../../api/client';
import { getPlayableUrl } from './playUtils';
import type { Episode } from './types';
import type { PlayControllerDeps } from './playContext';

/**
 * Episode selection → playable URL resolution.
 * Guards against out-of-order clicks with `playRequestId`.
 */
export function useEpisodeNav(deps: PlayControllerDeps) {
  const { dispatch, stateRef, id } = deps;

  const handleEpisodeClick = useCallback(
    (ep: Episode) => {
      const currentSource = stateRef.current.currentSource;
      dispatch({ type: 'patch', payload: { currentEpisode: ep, currentTime: 0 } });
      const requestId = ++deps.playRequestId.current;
      if (ep.url) {
        getPlayableUrl(ep.url, currentSource).then((url) => {
          if (requestId !== deps.playRequestId.current) return;
          dispatch({ type: 'patch', payload: { playUrl: url } });
        });
        return;
      }

      apiClient
        .get('/play', { params: { site: currentSource, ids: id, episode: ep.name } })
        .then((res) => {
          if (res.data?.url) {
            getPlayableUrl(res.data.url, currentSource).then((url) => {
              if (requestId !== deps.playRequestId.current) return;
              dispatch({ type: 'patch', payload: { playUrl: url } });
            });
          }
        })
        .catch(console.error);
    },
    [id, dispatch, deps.playRequestId],
  );

  /**
   * Jump to the episode immediately after the current one.
   * Returns false when there is no next episode (or no selection yet).
   */
  const handleNextEpisode = useCallback((): boolean => {
    const eps = stateRef.current.episodes;
    const cur = stateRef.current.currentEpisode;
    if (!cur || eps.length === 0) return false;
    const idx = eps.findIndex((e) => e.name === cur.name);
    if (idx === -1 || idx + 1 >= eps.length) return false;
    handleEpisodeClick(eps[idx + 1]);
    return true;
  }, [stateRef, handleEpisodeClick]);

  return { handleEpisodeClick, handleNextEpisode };
}
