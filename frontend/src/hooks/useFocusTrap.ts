import { useEffect, useLayoutEffect, useRef } from 'react';

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

/**
 * Trap keyboard focus inside a container while `active`.
 *
 * - Moves focus to the first focusable element (or the container) on open.
 * - Cycles Tab / Shift+Tab within the container.
 * - Closes on Escape (calls `onClose`) — WCAG 2.1 2.1.1 / 2.1.2.
 * - Restores focus to the previously focused element on close.
 *
 * Used for dialogs (Announcement) and popup menus (ThemeSwitcher, UserMenu)
 * so keyboard and screen-reader users are not stranded behind the overlay.
 */
export function useFocusTrap<T extends HTMLElement>(
  active: boolean,
  onClose: () => void,
) {
  const ref = useRef<T>(null);
  const onCloseRef = useRef(onClose);
  // Keep the latest onClose without re-running the trap effect on every render.
  // Assigned inside a layout effect (not during render) to satisfy react-hooks
  // ref-access rules and stay safe under the React Compiler.
  useLayoutEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!active) return;
    const container = ref.current;
    if (!container) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;

    const getFocusable = () =>
      Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null || el === document.activeElement,
      );

    // Focus the first focusable element (fall back to the container itself).
    const focusables = getFocusable();
    (focusables[0] ?? container).focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        e.preventDefault();
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab') return;

      const f = getFocusable();
      if (f.length === 0) {
        e.preventDefault();
        return;
      }
      const first = f[0];
      const last = f[f.length - 1];
      const activeEl = document.activeElement;

      if (e.shiftKey && activeEl === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && activeEl === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);
    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
      previouslyFocused?.focus?.();
    };
  }, [active]);

  return ref;
}
