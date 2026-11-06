import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import type { ReactNode } from 'react';
import { configApi } from '../api/config';
import { getCachedConfig, setCachedConfig, clearCachedConfig } from './configCache';
import type { SiteConfig } from '../types';

const DEFAULT_SITE_NAME = 'WarHutTV';

interface ConfigContextType {
  config: SiteConfig | null;
  siteName: string;
  isLoading: boolean;
  /** Force a refetch (used after login, when `api_site` becomes available). */
  refresh: () => Promise<void>;
}

const ConfigContext = createContext<ConfigContextType>({
  config: null,
  siteName: DEFAULT_SITE_NAME,
  isLoading: true,
  refresh: async () => {},
});

export const useConfig = () => useContext(ConfigContext);

export const ConfigProvider = ({ children }: { children: ReactNode }) => {
  const [config, setConfig] = useState<SiteConfig | null>(getCachedConfig());
  const [isLoading, setIsLoading] = useState(() => getCachedConfig() === null);

  const fetchConfig = useCallback(async () => {
    try {
      const data = await configApi.getConfig();
      setCachedConfig(data);
      setConfig(data);
    } catch (error) {
      console.error('Failed to fetch config:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Invalidate the cache and refetch immediately.
   *
   * The previous implementation only cleared the cache and relied on the mount
   * effect to refetch — but that effect never runs again after the provider has
   * mounted, so logging in never picked up the authenticated fields
   * (`api_site`), which the play page needs to validate the `:site` param.
   */
  const refresh = useCallback(async () => {
    clearCachedConfig();
    await fetchConfig();
  }, [fetchConfig]);

  useEffect(() => {
    // Only the first mount needs to fetch; remounts and StrictMode's double
    // mount reuse the module cache.
    if (getCachedConfig()) return;
    void fetchConfig();
  }, [fetchConfig]);

  const value = useMemo(
    () => ({
      config,
      siteName: config?.site_name || DEFAULT_SITE_NAME,
      isLoading,
      refresh,
    }),
    [config, isLoading, refresh],
  );

  return (
    <ConfigContext.Provider value={value}>
      {children}
    </ConfigContext.Provider>
  );
};
