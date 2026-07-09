import { memo } from 'react';
import type { ReactNode } from 'react';

type GridVariant = 'home' | 'search' | 'favorites';

interface VideoGridProps {
  children: ReactNode;
  variant: GridVariant;
  className?: string;
}

const gridClasses: Record<GridVariant, string> = {
  home: 'grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-3 sm:gap-5',
  search: 'grid-cols-3 gap-x-2 gap-y-12 sm:grid-cols-[repeat(auto-fill,minmax(160px,1fr))] sm:gap-x-8 sm:gap-y-20',
  favorites: 'grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-x-2 gap-y-12 sm:gap-x-6 sm:gap-y-16',
};

/**
 * Unified video grid with variant-based layout.
 * Replaces the per-page grid-cols/gap sprawl.
 */
const VideoGrid = memo(({ children, variant, className = '' }: VideoGridProps) => (
  <div className={`grid ${gridClasses[variant]} ${className}`}>
    {children}
  </div>
));

export default VideoGrid;
