import { useState, useEffect } from 'react';

const CURRENT_VERSION = '1.0.0';
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
    fetch('/api/version')
      .then((res) => res.json())
      .then((data) => {
        const latest = data.version;
        if (latest && latest !== CURRENT_VERSION) {
          setInfo({ current: CURRENT_VERSION, latest, hasUpdate: true });
        }
      })
      .catch(() => {});
  }, []);

  return info;
}

export { CURRENT_VERSION, GITHUB_URL };
