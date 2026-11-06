import { useState, useEffect } from 'react';
import { useConfig } from '../store/config';

const ANNOUNCEMENT_DISMISSED_KEY = 'warhut-announcement-dismissed';

interface DismissedRecord {
  content: string;
  dismissedAt: number;
}

/**
 * Read the locally stored dismissal marker.
 *
 * `localStorage` can hold anything (other tabs, older app versions, the user
 * poking devtools), so a malformed value must not throw during render — it just
 * means "nothing dismissed yet".
 */
function readDismissed(): DismissedRecord | null {
  try {
    const raw = localStorage.getItem(ANNOUNCEMENT_DISMISSED_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (
      !parsed ||
      typeof parsed !== 'object' ||
      typeof (parsed as DismissedRecord).content !== 'string'
    ) {
      return null;
    }
    return parsed as DismissedRecord;
  } catch {
    return null;
  }
}

export const useAnnouncement = (isAuthenticated: boolean) => {
  const { config, refresh } = useConfig();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (!isAuthenticated || !config) return;

    const dismissedContent = readDismissed();
    if (!dismissedContent || dismissedContent.content !== config.announcement) {
      setIsVisible(true);
    }
  }, [isAuthenticated, config]);

  const dismiss = () => {
    if (config) {
      try {
        localStorage.setItem(
          ANNOUNCEMENT_DISMISSED_KEY,
          JSON.stringify({
            content: config.announcement,
            dismissedAt: Date.now(),
          })
        );
      } catch {
        // Private mode / quota exceeded: the announcement simply reappears next
        // visit, which is better than throwing out of an event handler.
      }
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
