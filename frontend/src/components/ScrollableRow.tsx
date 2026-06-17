import { useRef, useState, useEffect, type ReactNode } from 'react';

interface ScrollableRowProps {
  children: ReactNode;
  scrollDistance?: number;
}

const ScrollableRow = ({ children, scrollDistance = 1000 }: ScrollableRowProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [showLeft, setShowLeft] = useState(false);
  const [showRight, setShowRight] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const checkScroll = () => {
    if (!containerRef.current) return;
    const { scrollWidth, clientWidth, scrollLeft } = containerRef.current;
    setShowLeft(scrollLeft > 1);
    setShowRight(scrollWidth - (scrollLeft + clientWidth) > 1);
  };

  useEffect(() => {
    checkScroll();
    window.addEventListener('resize', checkScroll);
    const observer = new ResizeObserver(checkScroll);
    if (containerRef.current) observer.observe(containerRef.current);
    return () => {
      window.removeEventListener('resize', checkScroll);
      observer.disconnect();
    };
  }, [children]);

  useEffect(() => {
    if (!containerRef.current) return;
    const mo = new MutationObserver(() => setTimeout(checkScroll, 100));
    mo.observe(containerRef.current, { childList: true, subtree: true, attributes: true });
    return () => mo.disconnect();
  }, []);

  const scroll = (dir: 'left' | 'right') => {
    containerRef.current?.scrollBy({ left: dir === 'left' ? -scrollDistance : scrollDistance, behavior: 'smooth' });
  };

  return (
    <div className="relative" onMouseEnter={() => { setIsHovered(true); checkScroll(); }} onMouseLeave={() => setIsHovered(false)}>
      <div 
        ref={containerRef} 
        className="flex gap-5 overflow-x-auto overflow-y-visible scrollbar-hide py-6 sm:py-8 pb-16 sm:pb-20 px-4 sm:px-6 [&>*]:flex-shrink-0 [&>*]:w-[170px] sm:[&>*]:w-[185px]" 
        onScroll={checkScroll}
      >
        {children}
      </div>

      {showLeft && (
        <div className={`hidden sm:flex absolute left-0 top-0 bottom-0 w-16 items-center justify-center z-[600] transition-opacity duration-200 ${isHovered ? 'opacity-100' : 'opacity-0'}`} style={{ pointerEvents: 'none' }}>
          <div className="absolute inset-0 flex items-center justify-center" style={{ top: '40%', bottom: '60%', left: '-4.5rem', pointerEvents: 'auto' }}>
            <button onClick={() => scroll('left')} className="w-12 h-12 bg-card rounded-full shadow-lg flex items-center justify-center hover:bg-surface border border-glass-border transition-transform hover:scale-105">
              <svg className="w-6 h-6 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </button>
          </div>
        </div>
      )}

      {showRight && (
        <div className={`hidden sm:flex absolute right-0 top-0 bottom-0 w-16 items-center justify-center z-[600] transition-opacity duration-200 ${isHovered ? 'opacity-100' : 'opacity-0'}`} style={{ pointerEvents: 'none' }}>
          <div className="absolute inset-0 flex items-center justify-center" style={{ top: '40%', bottom: '60%', right: '-4.5rem', pointerEvents: 'auto' }}>
            <button onClick={() => scroll('right')} className="w-12 h-12 bg-card rounded-full shadow-lg flex items-center justify-center hover:bg-surface border border-glass-border transition-transform hover:scale-105">
              <svg className="w-6 h-6 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ScrollableRow;
