import { useCallback } from 'react';
import { favoritesStore } from '../../store/favorites';
import type { PlayControllerDeps } from './playContext';

/**
 * Toggle favorite state for the currently loaded detail.
 */
export function useFavoriteToggle(deps: PlayControllerDeps) {
  const { dispatch, stateRef } = deps;

  const toggleFavorite = useCallback(async () => {
    const detail = stateRef.current.detail;
    if (!detail) return;
    const result = await favoritesStore.toggle(detail);
    dispatch({ type: 'patch', payload: { isFavorite: result } });
  }, [dispatch, stateRef]);

  return { toggleFavorite };
}
