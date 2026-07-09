import apiClient from '../../api/client';
import { detailCacheStore } from '../../store/detailCache';
import type { DetailResponse } from './types';
import type { VideoDetail } from '../../types';

/**
 * Fetch a detail record by source + vod id, caching the result in Dexie so
 * repeated source switches / re-optimisations don't hit the network again.
 * Extracted from usePlayController so the controller stays a thin orchestrator.
 */
export async function getCachedDetail(
  sourceKey: string,
  vodId: string | number,
): Promise<VideoDetail | undefined> {
  const cacheKey = `${sourceKey}:${vodId}`;
  const cached = await detailCacheStore.get<DetailResponse>(cacheKey);
  if (cached) return cached?.list?.[0] as VideoDetail | undefined;

  const res = await apiClient.get<DetailResponse>('/detail', {
    params: { site: sourceKey, ids: vodId },
  });
  const data = res.data?.list?.[0] as VideoDetail | undefined;
  if (res.data) await detailCacheStore.set(cacheKey, res.data);
  return data;
}
