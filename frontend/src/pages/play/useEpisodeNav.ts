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
      const requestId = ++deps.playRequestId.current;
      // 切集：新集从 0:00 开始。把 currentEpisode + currentTime + playUrl +
      // switchStartsFromZero 合并到**同一次** dispatch，避免在 playUrl 就绪前
      // currentEpisode 已变成新集、而视频仍停在上一集进度时，进度回写把旧集进度
      // 误写成新集的续播点。switchStartsFromZero=true 告知 Player 本次换源是「切集」，
      // 不要回退到上一集的 video.currentTime。
      const apply = (url: string) => {
        if (requestId !== deps.playRequestId.current) return;
        dispatch({
          type: 'patch',
          payload: { currentEpisode: ep, currentTime: 0, playUrl: url, switchStartsFromZero: true },
        });
      };
      if (ep.url) {
        getPlayableUrl(ep.url, currentSource).then(apply);
        return;
      }

      apiClient
        .get('/play', { params: { site: currentSource, ids: id, episode: ep.name } })
        .then((res) => {
          if (res.data?.url) {
            getPlayableUrl(res.data.url, currentSource).then(apply);
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
