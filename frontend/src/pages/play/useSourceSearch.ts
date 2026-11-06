import { useCallback, useEffect, useRef } from 'react';
import { streamSearchResults } from '../../api/searchStream';
import { getPlayableUrl, parseEpisodes, parseSpeed, pickProbeUrl, applyResumeProgress, episodePageIndex } from './playUtils';
import { getCachedDetail } from './playApi';
import { filterYellowItems, isExactMatch } from '../../utils/filter';
import type {
  Episode,
  SearchSiteData,
  SourceItem,
  SpeedTestResultWithDetail,
  VideoDetail,
} from './types';
import type { PlayControllerDeps } from './playContext';

/**
 * SSE source search + speed-test optimization.
 *
 * Extracted from the former god hook. Owns `streamSearch` (the streaming
 * search with abort + 30s timeout, cached to sessionStorage) and
 * `startOptimize` (builds the candidate source list, measures each, and
 * applies the best). All mutations still go through the shared reducer.
 */
export function useSourceSearch(deps: PlayControllerDeps) {
  const { dispatch, toast, site, id, setCurrentTime } = deps;

  // Optimization finishes with a couple of cosmetic delays so the UI can show
  // the "done" state before the spinner disappears. They used to be bare
  // `setTimeout`s: navigating away mid-optimization then dispatched into an
  // unmounted component and leaked the timers, so every one is tracked here and
  // cleared on unmount.
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const later = useCallback((fn: () => void, ms: number) => {
    const timer = setTimeout(() => {
      timersRef.current = timersRef.current.filter((entry) => entry !== timer);
      fn();
    }, ms);
    timersRef.current.push(timer);
  }, []);

  useEffect(
    () => () => {
      timersRef.current.forEach(clearTimeout);
      timersRef.current = [];
    },
    [],
  );

  // SSE search with abort + 30s timeout, caching results in sessionStorage.
  const streamSearch = useCallback(
    (wd: string): Promise<SearchSiteData[]> => {
      return new Promise((resolve) => {
        deps.searchAbortRef.current?.abort();
        const controller = new AbortController();
        deps.searchAbortRef.current = controller;
        const allResults: SearchSiteData[] = [];
        let settled = false;

        const finish = () => {
          if (settled) return;
          settled = true;
          clearTimeout(timeoutId);
          deps.searchAbortRef.current = null;
          resolve(allResults);
        };

        const timeoutId = setTimeout(() => {
          // The socket may still be open after the backend finishes; abort it
          // so we don't keep a dead stream around for the rest of the session.
          console.warn('Play: search timeout, resolving with partial results');
          controller.abort();
          finish();
        }, 30000);

        streamSearchResults<SearchSiteData>(
          wd,
          {
            onStart: (data) =>
              dispatch({
                type: 'patch',
                payload: { searchProgress: { completed: 0, total: data.site_count, currentSite: '' } },
              }),
            onResult: (data) => {
              const siteResult = data.data;
              if (siteResult) allResults.push(siteResult);
              dispatch({
                type: 'patch',
                payload: {
                  searchProgress: {
                    completed: data.completed,
                    total: data.total,
                    currentSite: data.name,
                  },
                },
              });
            },
            // Discarded/timed-out sources still count toward the total so the
            // overlay never stalls on a dead source.
            onErrorEvent: (data) =>
              dispatch({
                type: 'patch',
                payload: {
                  searchProgress: {
                    completed: data.completed ?? 0,
                    total: data.total ?? 0,
                    currentSite: data.discarded ? `${data.name} 超时丢弃` : (data.name || '失败'),
                  },
                },
              }),
            onDone: () => {
              try {
                sessionStorage.setItem(`search_results:${wd}`, JSON.stringify(allResults));
              } catch (err) {
                console.warn('Play: failed to cache search results', err);
              }
              finish();
            },
            onTimeout: finish,
          },
          { signal: controller.signal },
        ).catch((err: unknown) => {
          if (!controller.signal.aborted) {
            console.warn('Play: stream search failed', err);
          }
          finish();
        });
      });
    },
    [dispatch, deps.searchAbortRef],
  );

  const startOptimize = useCallback(
    async (title: string, initialEpisodes: Episode[]) => {
      dispatch({
        type: 'patch',
        payload: { sourceLoading: true, searchProgress: { completed: 0, total: 0, currentSite: '' } },
      });

      try {
        let data: SearchSiteData[] | null = null;
        try {
          const cached = sessionStorage.getItem(`search_results:${title}`);
          if (cached) data = JSON.parse(cached) as SearchSiteData[];
        } catch (err) {
          console.warn('Play: failed to parse sessionStorage cache', err);
        }

        if (!data) data = await streamSearch(title);

        const playFallback = async () => {
          const targetEp = await applyResumeProgress(setCurrentTime, toast, site, id, initialEpisodes);
          if (targetEp?.url) {
            const url = await getPlayableUrl(targetEp.url);
            dispatch({ type: 'patch', payload: { playUrl: url, switchStartsFromZero: false } });
          }
          dispatch({ type: 'patch', payload: { currentEpisode: targetEp, episodePage: episodePageIndex(initialEpisodes, targetEp, deps.episodesPerPage) } });
        };

        if (!data || !Array.isArray(data) || data.length === 0) {
          await playFallback();
          dispatch({ type: 'patch', payload: { optimizeComplete: true, searchProgress: null } });
          later(() => dispatch({ type: 'patch', payload: { isOptimizing: false } }), 500);
          return;
        }

        const sourceList: SourceItem[] = [];
        data.forEach((item) => {
          if (item?.list && item.list.length > 0) {
            let filteredList = filterYellowItems(item.list);
            filteredList = filteredList.filter((entry) => isExactMatch(entry.vod_name || '', title));
            if (filteredList.length === 0) return;

            const firstItem = filteredList[0];
            sourceList.push({
              key: item.site_key,
              name: firstItem.source_name || item.name || item.site_key,
              poster: firstItem.vod_pic,
              episodeCount: filteredList.length,
              speed: null,
              status: 'pending' as const,
              vodId: firstItem.vod_id,
            });
          }
        });

        if (sourceList.length === 0) {
          await playFallback();
          dispatch({ type: 'patch', payload: { optimizeComplete: true, searchProgress: null } });
          later(() => dispatch({ type: 'patch', payload: { isOptimizing: false } }), 500);
          return;
        }

        dispatch({
          type: 'patch',
          payload: { sources: sourceList, searchDataCache: data, sourceLoading: false, searchProgress: null },
        });

        if (sourceList.length === 1) {
          const onlySource = sourceList[0];
          const siteData = data.find((item) => item.site_key === onlySource.key);
          if (siteData?.list && siteData.list.length > 0) {
            const onlyDetail = await getCachedDetail(onlySource.key, onlySource.vodId);
            if (onlyDetail) {
              const epList = onlyDetail.vod_play_url ? parseEpisodes(onlyDetail.vod_play_url) : [];
              const targetEp = await applyResumeProgress(setCurrentTime, toast, site, id, epList);
              const url = targetEp ? await getPlayableUrl(targetEp.url) : '';
              dispatch({
                type: 'applySource',
                source: {
                  key: onlySource.key,
                  detail: onlyDetail,
                  episodes: epList,
                  playUrl: url,
                  currentEpisode: targetEp,
                },
              });
              // currentEpisode is now part of applySource; only the page needs a patch.
              dispatch({ type: 'patch', payload: { episodePage: episodePageIndex(epList, targetEp, deps.episodesPerPage) } });
            }
          }
          dispatch({ type: 'patch', payload: { optimizeComplete: true, searchProgress: null } });
          later(() => dispatch({ type: 'patch', payload: { isOptimizing: false } }), 500);
          return;
        }

        const testPromises = sourceList.map(async (source, index) => {
          dispatch({ type: 'setSourceStatus', index, status: 'testing' });

          try {
            const siteData = data!.find((item) => item.site_key === source.key);
            if (siteData?.list && siteData.list.length > 0) {
              const vodDetail = await getCachedDetail(source.key, source.vodId);
              // Pick the first playable URL across *all* lines (线路) instead of
              // only the first entry of the first line, and don't require
              // `.m3u8`: HLS is the common case but direct mp4 sources exist and
              // used to be skipped entirely, so their source showed no speed.
              const epUrl = pickProbeUrl(vodDetail?.vod_play_url);
              if (epUrl) {
                const { testVideoSpeed } = await import('../../utils/speedtest');
                const result = await testVideoSpeed(epUrl);
                dispatch({ type: 'setSourceStatus', index, status: 'done', speed: result });
                return { source, result, vodDetail } as SpeedTestResultWithDetail;
              }
            }
            dispatch({ type: 'setSourceStatus', index, status: 'done' });
          } catch (err) {
            console.warn(`Play: speed test failed for source ${source.key}`, err);
            dispatch({ type: 'setSourceStatus', index, status: 'error' });
          }
          return null;
        });

        const results = await Promise.allSettled(testPromises);
        const validResults: SpeedTestResultWithDetail[] = [];
        for (const result of results) {
          if (result.status === 'fulfilled' && result.value !== null) {
            validResults.push(result.value);
          }
        }

        const applyPicked = async (picked: { key: string; detail: VideoDetail }) => {
          const epList = picked.detail.vod_play_url ? parseEpisodes(picked.detail.vod_play_url) : [];
          const targetEp = await applyResumeProgress(setCurrentTime, toast, site, id, epList);
          const url = targetEp ? await getPlayableUrl(targetEp.url) : '';
          dispatch({
            type: 'applySource',
            source: {
              key: picked.key,
              detail: picked.detail,
              episodes: epList,
              playUrl: url,
              currentEpisode: targetEp,
            },
          });
          // currentEpisode is now part of applySource; only the page needs a patch.
          dispatch({ type: 'patch', payload: { episodePage: episodePageIndex(epList, targetEp, deps.episodesPerPage) } });
        };

        if (validResults.length > 0) {
          validResults.sort((a, b) => parseSpeed(b.result.loadSpeed) - parseSpeed(a.result.loadSpeed));
          const best = validResults[0];
          toast(`已选择最佳源: ${best.source.name} (${best.result.loadSpeed})`);
          if (best.vodDetail) await applyPicked({ key: best.source.key, detail: best.vodDetail });
        } else if (sourceList.length > 0) {
          const firstSource = sourceList[0];
          toast(`测速失败，使用默认源: ${firstSource.name}`);
          const siteData = data.find((item) => item.site_key === firstSource.key);
          if (siteData?.list && siteData.list.length > 0) {
            const detail = await getCachedDetail(firstSource.key, firstSource.vodId);
            if (detail) await applyPicked({ key: firstSource.key, detail });
          }
        } else {
          await playFallback();
        }
    } catch (err) {
      console.error('优选失败:', err);
      const targetEp = await applyResumeProgress(setCurrentTime, toast, site, id, initialEpisodes);
      if (targetEp?.url) {
        const url = await getPlayableUrl(targetEp.url);
        dispatch({ type: 'patch', payload: { playUrl: url, switchStartsFromZero: false } });
      }
      dispatch({ type: 'patch', payload: { currentEpisode: targetEp, episodePage: episodePageIndex(initialEpisodes, targetEp, deps.episodesPerPage) } });
    } finally {
        dispatch({
          type: 'patch',
          payload: { sourceLoading: false, optimizeComplete: true, searchProgress: null },
        });
        setTimeout(() => dispatch({ type: 'patch', payload: { isOptimizing: false } }), 800);
      }
    },
    [site, id, toast, setCurrentTime, streamSearch, dispatch, deps.episodesPerPage, later],
  );

  return { streamSearch, startOptimize };
}
