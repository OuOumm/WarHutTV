import { memo } from 'react';
import type { ReactNode } from 'react';

interface PageContainerProps {
  children: ReactNode;
  /** Extra CSS classes */
  className?: string;
  /** Compact mode (Play page) — tighter horizontal padding */
  compact?: boolean;
}

/**
 * Unified page container with consistent horizontal/vertical padding.
 * Replaces the per-page px-2/px-4/px-5/px-[3rem] sprawl.
 */
const PageContainer = memo(({ children, className = '', compact = false }: PageContainerProps) => (
  <div
    className={`
      ${compact ? 'px-3 sm:px-5 lg:px-8' : 'px-3 sm:px-6 lg:px-8'}
      py-4 sm:py-6
      overflow-visible
      ${className}
    `}
  >
    {children}
  </div>
));

export default PageContainer;
