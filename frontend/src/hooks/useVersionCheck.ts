declare const __APP_VERSION__: string;

import { useState, useEffect } from 'react';
import apiClient from '../api/client';

const CURRENT_VERSION = __APP_VERSION__;
const GITHUB_URL = 'https://github.com/OuOumm/WarHutTV';

interface VersionInfo {
  current: string;
  latest: string;
  hasUpdate: boolean;
}

export function useVersionCheck(): VersionInfo {
  const [info, setInfo] = useState<VersionInfo>({
    current: CURRENT_VERSION,
    latest: CURRENT_VERSION,
    hasUpdate: false,
  });

  useEffect(() => {
    apiClient.get<{ version: string }>('/version')
      .then((res) => {
        const latest = res.data.version;
        if (latest && latest !== CURRENT_VERSION) {
          setInfo({ current: CURRENT_VERSION, latest, hasUpdate: true });
        }
      })
      .catch(() => {});
  }, []);

  return info;
}

export { CURRENT_VERSION, GITHUB_URL };
