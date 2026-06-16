import { useRef, useState, useEffect, type ReactNode } from 'react';

interface LazyGridProps {
  items: any[];
  renderItem: (item: any, index: number) => ReactNode;
  className?: string;
  itemHeight?: number;
  columns?: number;
}

const LazyGrid = ({ items, renderItem, className = '', itemHeight = 320 }: LazyGridProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: 30 });
  const [columns, setColumns] = useState(5);

  useEffect(() => {
    const updateColumns = () => {
      if (!containerRef.current) return;
      const width = containerRef.current.offsetWidth;
      const minItemWidth = 160;
      setColumns(Math.max(2, Math.floor(width / minItemWidth)));
    };

    updateColumns();
    window.addEventListener('resize', updateColumns);
    return () => window.removeEventListener('resize', updateColumns);
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      const viewportHeight = window.innerHeight;
      const buffer = viewportHeight * 2; // 预加载2屏

      const rowHeight = itemHeight + 40; // item + gap
      const startRow = Math.max(0, Math.floor((scrollTop - buffer) / rowHeight));
      const endRow = Math.ceil((scrollTop + viewportHeight + buffer) / rowHeight);
      const start = startRow * columns;
      const end = Math.min(items.length, endRow * columns + columns);

      setVisibleRange({ start, end });
    };

    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [items.length, itemHeight, columns]);

  const totalRows = Math.ceil(items.length / columns);
  const visibleStartRow = Math.floor(visibleRange.start / columns);
  const visibleEndRow = Math.ceil(visibleRange.end / columns);

  const topPadding = visibleStartRow * (itemHeight + 40);
  const bottomPadding = (totalRows - visibleEndRow) * (itemHeight + 40);

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div style={{ paddingTop: topPadding, paddingBottom: bottomPadding }}>
        <div className={`grid grid-cols-3 gap-x-2 gap-y-12 sm:grid-cols-[repeat(auto-fill,minmax(160px,1fr))] sm:gap-x-8 sm:gap-y-20`}>
          {items.slice(visibleRange.start, visibleRange.end).map((item, i) => (
            <div key={`${item.id || item.vod_id || i}-${visibleRange.start + i}`} className="w-full">
              {renderItem(item, visibleRange.start + i)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default LazyGrid;
