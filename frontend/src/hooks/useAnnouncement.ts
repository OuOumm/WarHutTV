import { useState, useEffect } from 'react';
import { useConfig } from '../store/config';

const ANNOUNCEMENT_DISMISSED_KEY = 'warhut-announcement-dismissed';

export const useAnnouncement = (isAuthenticated: boolean) => {
  const { config, refresh } = useConfig();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (!isAuthenticated || !config) return;

    const dismissed = localStorage.getItem(ANNOUNCEMENT_DISMISSED_KEY);
    const dismissedContent = dismissed ? JSON.parse(dismissed) : null;

    if (!dismissedContent || dismissedContent.content !== config.announcement) {
      setIsVisible(true);
    }
  }, [isAuthenticated, config]);

  const dismiss = () => {
    if (config) {
      localStorage.setItem(
        ANNOUNCEMENT_DISMISSED_KEY,
        JSON.stringify({
          content: config.announcement,
          dismissedAt: Date.now(),
        })
      );
    }
    setIsVisible(false);
  };

  return {
    config,
    isVisible,
    dismiss,
    refresh,
  };
};
