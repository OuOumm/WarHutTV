import type { SiteConfig } from '../types';

/**
 * Module-level config cache.
 *
 * Kept out of `config.tsx` so the provider file only exports components
 * (react-refresh requires that) and so non-React code — e.g. the play page
 * validating a `:site` route param — can read the last fetched config
 * synchronously without subscribing to the context and re-rendering.
 */
let cachedConfig: SiteConfig | null = null;

export const getCachedConfig = (): SiteConfig | null => cachedConfig;

export const setCachedConfig = (config: SiteConfig | null): void => {
  cachedConfig = config;
};

/** Drop the cache so the next `refresh()` really re-requests it. */
export const clearCachedConfig = (): void => {
  cachedConfig = null;
};
