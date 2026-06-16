import { type ReactNode } from 'react';

interface LazyGridProps {
  items: any[];
  renderItem: (item: any, index: number) => ReactNode;
  className?: string;
  itemHeight?: number;
  columns?: number;
}

const LazyGrid = ({ items, renderItem, className = '' }: LazyGridProps) => {
  return (
    <div className={`grid grid-cols-3 gap-x-2 gap-y-12 sm:grid-cols-[repeat(auto-fill,minmax(160px,1fr))] sm:gap-x-8 sm:gap-y-20 ${className}`}>
      {items.map((item, i) => (
        <div key={`${item.id || item.vod_id || i}-${i}`} className="w-full">
          {renderItem(item, i)}
        </div>
      ))}
    </div>
  );
};

export default LazyGrid;
