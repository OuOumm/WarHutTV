import { useRef, useState, useEffect, useLayoutEffect, type ReactNode, type CSSProperties } from 'react';
import { useWindowVirtualizer } from '@tanstack/react-virtual';

interface VirtualVideoGridProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => ReactNode;
  /** Number of columns at the current viewport (resolved by the caller). */
  columnCount: number;
  /** Tailwind classes for the inner grid (responsive column count + column gap). */
  innerGridClassName?: string;
  /** Inline grid style (used when column count is computed from width, e.g. search). */
  innerGridStyle?: CSSProperties;
  /** Rough row height (poster 2:3 + caption + row gap) — auto-measured, this only seeds layout. */
  estimateRowHeight: number;
  /** Responsive bottom padding that doubles as the vertical gap between rows. */
  rowClassName?: string;
  className?: string;
}

/**
 * Window-virtualized responsive grid.
 *
 * Renders only the rows currently near the viewport, so a list of hundreds of
 * cards (Favorites / History / Search) no longer mounts every node at once —
 * fixing the "全量渲染" jank called out in the analysis report (1.2). Uses
 * `useWindowVirtualizer` so the page still scrolls with the window (no nested
 * scroll container) and `measureElement` to auto-correct row heights.
 */
export function VirtualVideoGrid<T>({
  items,
  renderItem,
  columnCount,
  innerGridClassName,
  innerGridStyle,
  estimateRowHeight,
  rowClassName = '',
  className = '',
}: VirtualVideoGridProps<T>) {
  const parentRef = useRef<HTMLDivElement>(null);
  const [scrollMargin, setScrollMargin] = useState(0);

  useLayoutEffect(() => {
    const measure = () => {
      if (parentRef.current) {
        setScrollMargin(parentRef.current.getBoundingClientRect().top + window.scrollY);
      }
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  const rowCount = Math.ceil(items.length / columnCount);

  const virtualizer = useWindowVirtualizer({
    count: rowCount,
    estimateSize: () => estimateRowHeight,
    overscan: 5,
    scrollMargin,
  });

  return (
    <div ref={parentRef} className={className}>
      <div style={{ height: virtualizer.getTotalSize(), position: 'relative', width: '100%' }}>
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const start = virtualRow.index * columnCount;
          const rowItems = items.slice(start, start + columnCount);
          return (
            <div
              key={virtualRow.key}
              data-index={virtualRow.index}
              ref={virtualizer.measureElement}
              className={rowClassName}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualRow.start - virtualizer.options.scrollMargin}px)`,
              }}
            >
              <div
                className={innerGridClassName}
                style={innerGridStyle ?? { gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))` }}
              >
                {rowItems.map((item, i) => (
                  <div key={start + i} className="w-full">
                    {renderItem(item, start + i)}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default VirtualVideoGrid;

/** Resolve column count from Tailwind-style breakpoints (for fixed grids). */
export function useResponsiveColumns(cols: {
  base: number;
  sm: number;
  lg: number;
  xl: number;
}) {
  const get = () => {
    if (typeof window === 'undefined') return cols.base;
    const w = window.innerWidth;
    if (w >= 1280) return cols.xl;
    if (w >= 1024) return cols.lg;
    if (w >= 640) return cols.sm;
    return cols.base;
  };
  const [count, setCount] = useState(get);
  useEffect(() => {
    const onResize = () => setCount(get());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return count;
}

/** Resolve column count from a target card width (for auto-fill grids like search). */
export function useWindowColumns(minCardWidth: number, gap: number, max = 8) {
  const get = () => {
    if (typeof window === 'undefined') return 3;
    const c = Math.max(1, Math.floor((window.innerWidth + gap) / (minCardWidth + gap)));
    return Math.min(c, max);
  };
  const [count, setCount] = useState(get);
  useEffect(() => {
    const onResize = () => setCount(get());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [minCardWidth, gap, max]);
  return count;
}
