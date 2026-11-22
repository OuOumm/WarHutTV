import type { VideoItem } from '../types';

/**
 * Session-scoped cache for the search page, keyed by keyword.
 *
 * Why this exists: the search page re-ran the full multi-source SSE search on
 * every mount. Opening a film and pressing back therefore cost another few
 * seconds and threw away the scroll position. Reusing the result is what makes
 * "back" feel like going back rather than starting over.
 *
 * Results and scroll offset are stored under separate keys on purpose:
 *   - The result set is large (tens of KB), so it is written once when the
 *     search completes and never rewritten.
 *   - The offset changes constantly while scrolling and is tiny, so it is
 *     written on scroll with rAF throttling. Bundling it into the result blob
 *     would mean re-serialising every result on every scroll tick, and reading
 *     the offset back would require parsing the whole set.
 *
 * Keeping the offset in its own key also removes any dependence on unmount
 * ordering: `ScrollToTop` resets the window on navigation, so anything that
 * samples `window.scrollY` during cleanup can observe 0.
 *
 * Lifetime is deliberately short: upstream catalogues change, and a stale hit
 * is worse than a quick re-search. Five minutes matches a single
 * browse-and-open loop.
 *
 * Storage is `sessionStorage` so a closed tab never resurrects old results and
 * two tabs never fight over one entry. Every access is wrapped in try/catch:
 * private-mode browsers can throw on read or write, and a cache failure must
 * never break search itself.
 */

const RESULTS_PREFIX = 'search_cache:';
const SCROLL_PREFIX = 'search_scroll:';

/** How long a cached result set stays usable. */
export const SEARCH_CACHE_TTL_MS = 5 * 60 * 1000;

export interface CachedSearch {
  keyword: string;
  results: VideoItem[];
  /** Scroll offset recorded while the user was last on this result set. */
  scrollY: number;
  savedAt: number;
}

interface StoredSearch {
  results: VideoItem[];
  savedAt: number;
}

function storage(): Storage | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

/**
 * Read a cached result set for `keyword`.
 *
 * Returns null when there is nothing stored, when the entry is malformed, or
 * when it is older than {@link SEARCH_CACHE_TTL_MS}. Expired entries are
 * removed on read so they cannot be picked up again.
 */
export function readSearchCache(keyword: string, now = Date.now()): CachedSearch | null {
  if (!keyword) return null;
  const store = storage();
  if (!store) return null;

  let raw: string | null;
  try {
    raw = store.getItem(RESULTS_PREFIX + keyword);
  } catch {
    return null;
  }
  if (!raw) return null;

  let parsed: StoredSearch;
  try {
    parsed = JSON.parse(raw) as StoredSearch;
  } catch {
    removeSearchCache(keyword);
    return null;
  }

  if (!parsed || !Array.isArray(parsed.results) || typeof parsed.savedAt !== 'number') {
    removeSearchCache(keyword);
    return null;
  }

  if (now - parsed.savedAt > SEARCH_CACHE_TTL_MS) {
    removeSearchCache(keyword);
    return null;
  }

  return { keyword, results: parsed.results, scrollY: readSearchScroll(keyword), savedAt: parsed.savedAt };
}

/**
 * Store a result set. Failures are swallowed: a full quota must not surface as
 * a search error, because the results are already on screen.
 */
export function writeSearchCache(keyword: string, results: VideoItem[], now = Date.now()): void {
  if (!keyword) return;
  const store = storage();
  if (!store) return;
  try {
    const payload: StoredSearch = { results, savedAt: now };
    store.setItem(RESULTS_PREFIX + keyword, JSON.stringify(payload));
  } catch {
    // Quota exceeded or storage disabled — nothing to recover from here.
  }
}

/** Record the scroll offset for an existing cached result set. */
export function writeSearchScroll(keyword: string, scrollY: number): void {
  if (!keyword) return;
  const store = storage();
  if (!store) return;
  try {
    store.setItem(SCROLL_PREFIX + keyword, String(Math.max(0, Math.round(scrollY))));
  } catch {
    // Ignore: a lost offset only costs a scroll reset on return.
  }
}

/** Read the recorded scroll offset. Returns 0 when absent or unparseable. */
export function readSearchScroll(keyword: string): number {
  if (!keyword) return 0;
  const store = storage();
  if (!store) return 0;
  try {
    const raw = store.getItem(SCROLL_PREFIX + keyword);
    if (!raw) return 0;
    const value = Number(raw);
    return Number.isFinite(value) && value > 0 ? value : 0;
  } catch {
    return 0;
  }
}

export function removeSearchCache(keyword: string): void {
  const store = storage();
  if (!store) return;
  try {
    store.removeItem(RESULTS_PREFIX + keyword);
    store.removeItem(SCROLL_PREFIX + keyword);
  } catch {
    // Ignore: a failed delete only costs one stale entry.
  }
}
