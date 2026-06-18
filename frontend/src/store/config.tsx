import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { configApi } from '../api/config';
import type { SiteConfig } from '../types';

const DEFAULT_SITE_NAME = 'WarHutTV';

interface ConfigContextType {
  config: SiteConfig | null;
  siteName: string;
  isLoading: boolean;
}

const ConfigContext = createContext<ConfigContextType>({
  config: null,
  siteName: DEFAULT_SITE_NAME,
  isLoading: true,
});

export const useConfig = () => useContext(ConfigContext);

// 模块级缓存
let configCache: SiteConfig | null = null;

export const ConfigProvider = ({ children }: { children: ReactNode }) => {
  const [config, setConfig] = useState<SiteConfig | null>(configCache);
  const [isLoading, setIsLoading] = useState(!configCache);

  useEffect(() => {
    // 已有缓存则跳过
    if (configCache) return;

    const fetchConfig = async () => {
      try {
        const data = await configApi.getConfig();
        configCache = data;
        setConfig(data);
      } catch (error) {
        console.error('Failed to fetch config:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchConfig();
  }, []);

  return (
    <ConfigContext.Provider
      value={{
        config,
        siteName: config?.site_name || DEFAULT_SITE_NAME,
        isLoading,
      }}
    >
      {children}
    </ConfigContext.Provider>
  );
};
