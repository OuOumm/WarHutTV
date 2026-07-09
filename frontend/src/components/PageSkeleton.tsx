import { memo } from 'react';

/**
 * Lightweight placeholder shown while a lazily-loaded route chunk downloads.
 * Keeps the first paint cheap (no heavy page JS) and gives an instant
 * "something is loading" signal, improving perceived performance (LCP).
 */
const PageSkeleton = memo(() => (
  <div className="px-3 sm:px-6 py-4 sm:py-6">
    <div className="h-7 w-40 bg-surface rounded-lg animate-pulse mb-6" />
    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-3 sm:gap-5">
      {Array.from({ length: 16 }).map((_, i) => (
        <div key={i}>
          <div className="aspect-[2/3] bg-surface rounded-xl animate-pulse" />
          <div className="mt-2.5 h-4 bg-surface rounded animate-pulse w-3/4" />
          <div className="mt-1.5 h-3 bg-surface/60 rounded animate-pulse w-1/2" />
        </div>
      ))}
    </div>
  </div>
));

export default PageSkeleton;
