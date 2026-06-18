import { useRef, useState, useEffect, useCallback, type ReactNode } from 'react';

interface ScrollableRowProps {
  children: ReactNode;
  scrollDistance?: number;
}

const ScrollableRow = ({ children, scrollDistance = 800 }: ScrollableRowProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [showLeft, setShowLeft] = useState(false);
  const [showRight, setShowRight] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  
  // 平滑滚动状态
  const scrollTargetRef = useRef(0);
  const isScrollingRef = useRef(false);
  const rafRef = useRef<number | null>(null);

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

  // 平滑滚动动画
  const smoothScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    
    const current = el.scrollLeft;
    const target = scrollTargetRef.current;
    const diff = target - current;
    
    // 如果差距很小，直接停止
    if (Math.abs(diff) < 0.5) {
      el.scrollLeft = target;
      isScrollingRef.current = false;
      checkScroll();
      return;
    }
    
    // 缓动系数（越大越快跟上，0-1之间）
    const ease = 0.12;
    el.scrollLeft = current + diff * ease;
    
    checkScroll();
    rafRef.current = requestAnimationFrame(smoothScroll);
  }, []);

  // 鼠标滚轮水平滚动 - 平滑版
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    
    const handler = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        const maxScroll = el.scrollWidth - el.clientWidth;
        const currentScroll = el.scrollLeft;
        
        // 只有在可以水平滚动时才拦截
        const canScrollLeft = currentScroll > 1;
        const canScrollRight = currentScroll < maxScroll - 1;
        const scrollingLeft = e.deltaY < 0;
        const scrollingRight = e.deltaY > 0;
        
        // 向左滚且还能向左，或向右滚且还能向右
        if ((scrollingLeft && canScrollLeft) || (scrollingRight && canScrollRight)) {
          e.preventDefault();
          
          // 累加目标位置
          scrollTargetRef.current += e.deltaY * 1.2;
          scrollTargetRef.current = Math.max(0, Math.min(scrollTargetRef.current, maxScroll));
          
          // 启动动画
          if (!isScrollingRef.current) {
            isScrollingRef.current = true;
            rafRef.current = requestAnimationFrame(smoothScroll);
          }
        }
        // 否则不阻止默认行为，让页面正常上下滚动
      }
    };
    
    el.addEventListener('wheel', handler, { passive: false });
    return () => {
      el.removeEventListener('wheel', handler);
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [smoothScroll]);

  const scroll = (dir: 'left' | 'right') => {
    const el = containerRef.current;
    if (!el) return;
    
    const target = dir === 'left' 
      ? el.scrollLeft - scrollDistance 
      : el.scrollLeft + scrollDistance;
    
    scrollTargetRef.current = Math.max(0, Math.min(target, el.scrollWidth - el.clientWidth));
    
    if (!isScrollingRef.current) {
      isScrollingRef.current = true;
      rafRef.current = requestAnimationFrame(smoothScroll);
    }
  };

  return (
    <div 
      className="relative group/row" 
      onMouseEnter={() => { setIsHovered(true); checkScroll(); }} 
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Left fade */}
      {showLeft && (
        <div className="absolute left-0 top-0 bottom-0 w-12 sm:w-20 z-[7] pointer-events-none bg-gradient-to-r from-deep to-transparent opacity-0 group-hover/row:opacity-100 transition-opacity duration-300" />
      )}
      {/* Right fade */}
      {showRight && (
        <div className="absolute right-0 top-0 bottom-0 w-12 sm:w-20 z-[7] pointer-events-none bg-gradient-to-l from-deep to-transparent opacity-0 group-hover/row:opacity-100 transition-opacity duration-300" />
      )}

      <div 
        ref={containerRef} 
        className="scroll-row-soft-mask flex gap-5 overflow-x-auto overflow-y-visible scrollbar-hide py-4 px-4 sm:px-6 [&>*]:flex-shrink-0 [&>*]:w-[170px] sm:[&>*]:w-[185px]" 
        onScroll={checkScroll}
      >
        {children}
      </div>

      {/* Left scroll button */}
      {showLeft && (
        <button 
          onClick={() => scroll('left')} 
          className={`hidden sm:flex absolute left-2 top-[40%] -translate-y-1/2 z-[8] w-10 h-10 rounded-full glass-panel items-center justify-center transition-all duration-200 hover:scale-110 hover:border-primary/30 ${
            isHovered ? 'opacity-100' : 'opacity-0'
          }`}
          style={{ pointerEvents: isHovered ? 'auto' : 'none' }}
        >
          <svg className="w-5 h-5 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      )}

      {/* Right scroll button */}
      {showRight && (
        <button 
          onClick={() => scroll('right')} 
          className={`hidden sm:flex absolute right-2 top-[40%] -translate-y-1/2 z-[8] w-10 h-10 rounded-full glass-panel items-center justify-center transition-all duration-200 hover:scale-110 hover:border-primary/30 ${
            isHovered ? 'opacity-100' : 'opacity-0'
          }`}
          style={{ pointerEvents: isHovered ? 'auto' : 'none' }}
        >
          <svg className="w-5 h-5 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      )}
    </div>
  );
};

export default ScrollableRow;
