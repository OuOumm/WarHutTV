import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import type { ReactNode } from 'react';
import { configApi } from '../api/config';
import type { SiteConfig } from '../types';

const DEFAULT_SITE_NAME = 'WarHutTV';

interface ConfigContextType {
  config: SiteConfig | null;
  siteName: string;
  isLoading: boolean;
  refresh: () => void;
}

const ConfigContext = createContext<ConfigContextType>({
  config: null,
  siteName: DEFAULT_SITE_NAME,
  isLoading: true,
  refresh: () => {},
});

export const useConfig = () => useContext(ConfigContext);

// 模块级缓存
let configCache: SiteConfig | null = null;

// 登录后重新获取完整配置
export function refreshConfig() {
  configCache = null;
}

export const ConfigProvider = ({ children }: { children: ReactNode }) => {
  const [config, setConfig] = useState<SiteConfig | null>(configCache);
  const [isLoading, setIsLoading] = useState(!configCache);

  const fetchConfig = useCallback(async () => {
    try {
      const data = await configApi.getConfig();
      configCache = data;
      setConfig(data);
    } catch (error) {
      console.error('Failed to fetch config:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (configCache) return;
    fetchConfig();
  }, [fetchConfig]);

  // Memoize the context value so consumers don't re-render on every
  // ConfigProvider render. refresh (fetchConfig) is stabilized above.
  const value = useMemo(
    () => ({
      config,
      siteName: config?.site_name || DEFAULT_SITE_NAME,
      isLoading,
      refresh: fetchConfig,
    }),
    [config, isLoading, fetchConfig],
  );

  return (
    <ConfigContext.Provider value={value}>
      {children}
    </ConfigContext.Provider>
  );
};
