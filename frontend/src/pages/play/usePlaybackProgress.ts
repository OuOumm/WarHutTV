import { useCallback, useEffect, useRef } from 'react';
import { historyStore } from '../../store/history';
import type { PlayControllerDeps } from './playContext';

/**
 * Minimum interval (ms) between history writes.
 *
 * Replaces the old 500ms-every-tick full upsert with a single throttled writer:
 * the player still feeds `(time, duration)` roughly every 500ms for a smooth UI,
 * but the actual `historyStore.record` call happens at most once per 3s, plus an
 * immediate flush on pause / ended / tab-hide / page-unload. That is ~6x less
 * I/O than before, and we no longer lose the last position when the page closes.
 */
const THROTTLE_MS = 3000;

/**
 * Playback time tracking + history sync + invalid-history clearing.
 *
 * Single writer: `tick` is the only entry point the Player calls. It dispatches
 * the latest `(time, duration)` into the reducer and decides whether to flush to
 * the history store (throttled). `flush` is the explicit "write now" path used
 * on lifecycle events and before a source switch. Both funnel through the same
 * `historyStore.record` upsert — no scattered writes elsewhere.
 */
export function usePlaybackProgress(deps: PlayControllerDeps) {
  const { dispatch, stateRef, navigate } = deps;

  // Whether there is an unsaved change since the last successful write.
  const dirtyRef = useRef(false);
  // Timestamp of the last successful write (ms since epoch).
  const lastWriteRef = useRef(0);
  // Re-entrancy guard so concurrent flushes (interval + visibility + unload)
  // don't double-write.
  const flushingRef = useRef(false);

  /**
   * Persist the current reducer state into the history store — but only when we
   * actually have a meaningful playback position. Called (a) by the throttle
   * inside `tick`, and (b) explicitly on pause/ended/hide/unload/source-switch.
   */
  const flush = useCallback(async () => {
    const vodId = deps.id;
    const siteKey = deps.site || 'default';
    if (!vodId) return;
    const st = stateRef.current;
    // Gate: no valid progress (currentTime or duration still 0) → don't pollute
    // history. A stalled/failed source that never produced frames won't record.
    if (!st.currentTime || !st.duration) return;
    if (flushingRef.current) return;
    flushingRef.current = true;
    try {
      const idx = st.episodes.findIndex((e) => e.name === st.currentEpisode?.name);
      await historyStore.record(siteKey, vodId, {
        vod_name: st.detail?.vod_name || '',
        vod_pic: st.detail?.vod_pic || '',
        episode: st.currentEpisode?.name ?? null,
        episodeIndex: idx >= 0 ? idx : null,
        progress: st.currentTime,
        duration: st.duration,
      });
      dirtyRef.current = false;
      lastWriteRef.current = Date.now();
    } finally {
      flushingRef.current = false;
    }
  }, [dispatch, stateRef, deps.id, deps.site, navigate]);

  /**
   * The only method the Player should call. Updates the reducer state and, if
   * the throttle window has elapsed, flushes; otherwise just marks dirty so a
   * later flush/pause/unload still persists the latest position.
   */
  const tick = useCallback(
    (time: number, duration?: number) => {
      dispatch({
        type: 'patch',
        payload: {
          currentTime: time,
          // Only adopt a real, finite, positive duration — never 0/NaN/Infinity.
          ...(duration != null && duration > 0 && Number.isFinite(duration)
            ? { duration }
            : {}),
        },
      });
      if (Date.now() - lastWriteRef.current >= THROTTLE_MS) {
        void flush();
      } else {
        dirtyRef.current = true;
      }
    },
    [dispatch, flush],
  );

  // Flush on tab-hide / page unload so we never lose the last position. These
  // are the moments the 500ms interval can't be relied on (the tab is gone).
  useEffect(() => {
    const maybeFlush = () => {
      if (dirtyRef.current) void flush();
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') maybeFlush();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('pagehide', maybeFlush);
    window.addEventListener('beforeunload', maybeFlush);
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('pagehide', maybeFlush);
      window.removeEventListener('beforeunload', maybeFlush);
    };
  }, [flush]);

  const clearInvalidHistory = useCallback(async () => {
    await historyStore.clear();
    navigate('/');
  }, [navigate]);

  return { tick, flush, clearInvalidHistory };
}
