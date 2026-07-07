import { type ReactNode } from 'react';

interface LazyGridProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => ReactNode;
  className?: string;
}

const LazyGrid = <T,>({ items, renderItem, className = '' }: LazyGridProps<T>) => {
  return (
    <div className={`grid grid-cols-3 gap-x-2 gap-y-12 sm:grid-cols-[repeat(auto-fill,minmax(160px,1fr))] sm:gap-x-8 sm:gap-y-20 ${className}`}>
      {items.map((item, i) => renderItem(item, i))}
    </div>
  );
};

export default LazyGrid;
