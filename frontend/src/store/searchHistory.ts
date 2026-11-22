/**
 * Recent search keywords, newest first.
 *
 * Why: the search box started empty every time, so re-searching a series you
 * were watching meant retyping the whole title. This keeps the last few
 * keywords locally — it is a convenience memory, not a saved list, so it is
 * capped and has no sync or server component.
 *
 * `localStorage` is used (not `sessionStorage`) so the history survives a
 * browser restart, which is the point of a "recently searched" list. Every
 * access is guarded: storage can throw in private mode, and a corrupt entry
 * must degrade to "no history" rather than break the search box.
 */

const KEY = 'searchHistory';

/** Keep the list short enough to scan at a glance. */
export const MAX_SEARCH_HISTORY = 8;

function storage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** Read the stored keywords, dropping anything that is not a usable string. */
export function readSearchHistory(): string[] {
  const store = storage();
  if (!store) return [];
  try {
    const raw = store.getItem(KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is string => typeof item === 'string')
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, MAX_SEARCH_HISTORY);
  } catch {
    return [];
  }
}

/**
 * Record a keyword as the most recent entry.
 *
 * Repeating an existing keyword moves it to the front instead of duplicating
 * it, so the list stays a set of distinct searches.
 */
export function addSearchHistory(keyword: string): string[] {
  const normalized = keyword.trim();
  if (!normalized) return readSearchHistory();

  const next = [normalized, ...readSearchHistory().filter((item) => item !== normalized)].slice(
    0,
    MAX_SEARCH_HISTORY,
  );

  const store = storage();
  if (store) {
    try {
      store.setItem(KEY, JSON.stringify(next));
    } catch {
      // Quota or private mode: the in-memory result is still returned so the
      // dropdown updates for this session.
    }
  }
  return next;
}

/** Remove one keyword (the "×" on a history row). */
export function removeSearchHistory(keyword: string): string[] {
  const next = readSearchHistory().filter((item) => item !== keyword);
  const store = storage();
  if (store) {
    try {
      store.setItem(KEY, JSON.stringify(next));
    } catch {
      // Ignore: the entry simply reappears next time.
    }
  }
  return next;
}

export function clearSearchHistory(): string[] {
  const store = storage();
  if (store) {
    try {
      store.removeItem(KEY);
    } catch {
      // Ignore.
    }
  }
  return [];
}
