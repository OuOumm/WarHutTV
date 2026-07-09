import { useState, useEffect } from 'react';

/**
 * CSS grid-template-columns that packs as many fixed-width cards as fit:
 * - each card is at least CARD_MIN_WIDTH (the "fixed card size" the user wants)
 * - `min(..., calc(50% - COL_GAP/2))` guarantees a minimum of 2 columns even on
 *   the narrowest phones (the user's "最少 2 个" requirement)
 * - `1fr` max lets cards stretch to fill the row so there's no awkward gap on the right
 */
export const CARD_MIN_WIDTH = 185;
export const CARD_COLUMN_GAP = '24px';
export const AUTO_FILL_GRID = `repeat(auto-fill, minmax(min(${CARD_MIN_WIDTH}px, calc(50% - 12px)), 1fr))`;

/**
 * Estimate how many columns the auto-fill grid will render at the current
 * viewport. Used only to mark the first screenful of posters `eager` (silences
 * Chrome's lazy-load intervention) — a slight over-estimate is harmless.
 */
export function useAutoFillColumns(cardWidth = CARD_MIN_WIDTH, gap = 24, min = 2) {
  const get = () => {
    if (typeof window === 'undefined') return Math.max(min, 2);
    const c = Math.floor((window.innerWidth + gap) / (cardWidth + gap));
    return Math.max(min, c);
  };
  const [count, setCount] = useState(get);
  useEffect(() => {
    const onResize = () => setCount(get());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [cardWidth, gap, min]);
  return count;
}
