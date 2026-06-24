# Frontend UI Polish — Technical Design

## 1. PageContainer 组件设计

### 接口
```tsx
interface PageContainerProps {
  children: ReactNode;
  /** 额外的 CSS 类 */
  className?: string;
  /** 是否使用紧凑模式（移动端） */
  compact?: boolean;
}
```

### 实现
- 统一水平内边距：`px-3 sm:px-6 lg:px-8`
- 统一垂直内边距：`py-4 sm:py-6`
- 紧凑模式（播放页）：`px-2 sm:px-4 lg:px-6`
- 使用 `max-w-7xl mx-auto` 限制最大宽度

### 迁移计划
- Home.tsx：`px-2 sm:px-10 py-4 sm:py-8` → `<PageContainer>`
- Search.tsx：`px-4 sm:px-10 py-4 sm:py-8` → `<PageContainer>`
- Play.tsx：`px-5 lg:px-[3rem] 2xl:px-20` → `<PageContainer compact>`
- Favorites.tsx：检查并统一
- History.tsx：检查并统一
- Douban.tsx：检查并统一

---

## 2. VideoGrid 组件设计

### 接口
```tsx
interface VideoGridProps {
  children: ReactNode;
  /** 网格变体 */
  variant: 'home' | 'search' | 'favorites' | 'compact';
}

type GridVariant = {
  cols: string;
  gap: string;
};

const variants: Record<string, GridVariant> = {
  home: { cols: 'grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8', gap: 'gap-3 sm:gap-5' },
  search: { cols: 'grid-cols-3 sm:grid-cols-[repeat(auto-fill,minmax(160px,1fr))]', gap: 'gap-x-2 gap-y-12 sm:gap-x-8 sm:gap-y-20' },
  favorites: { cols: 'grid-cols-2 sm:grid-cols-4 lg:grid-cols-5', gap: 'gap-3 sm:gap-5' },
  compact: { cols: 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4', gap: 'gap-3 sm:gap-4' },
};
```

### 迁移计划
- Home.tsx：`grid-cols-5 sm:grid-cols-8` → `<VideoGrid variant="home">`
- Search.tsx：`grid-cols-3 sm:grid-cols-[repeat(auto-fill,minmax(160px,1fr))]` → `<VideoGrid variant="search">`
- Favorites.tsx：`grid-cols-2 sm:grid-cols-4 lg:grid-cols-5` → `<VideoGrid variant="favorites">`
- History.tsx：检查并统一

---

## 3. 主题闪烁修复

### 方案：内联脚本同步应用主题

在 `index.html` 的 `<head>` 中添加内联脚本，在 JS 加载前同步应用主题：

```html
<script>
  // 同步应用主题，避免 FOUC
  (function() {
    const saved = localStorage.getItem('warhut-theme');
    const themes = {
      'crimson-cinema': { deep: '#10080c', primary: '#e11d48', ... },
      'cinema-gold': { deep: '#0b111e', primary: '#e6b91e', ... },
      // ... 其他主题
    };
    const theme = themes[saved] || themes['crimson-cinema'];
    const root = document.documentElement;
    root.style.setProperty('--color-deep', theme.deep);
    root.style.setProperty('--color-primary', theme.primary);
    // ... 其他关键变量
  })();
</script>
```

### CSS 变量统一

移除 `index.css` 中 `@theme` 块的颜色定义，只保留：
- 语义化变量名（`--color-deep`、`--color-primary` 等）
- 默认值（用于 JS 未加载时的降级）

这样确保：
1. JS `applyTheme()` 是唯一的主题数据源
2. 内联脚本提供首屏渲染的降级值
3. 无双源冲突

---

## 4. 微交互优化

### 4.1 骨架屏→内容过渡

在数据加载完成时，给内容容器添加过渡类：

```tsx
// 在数据加载完成后
<div className={`transition-opacity duration-300 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}>
  {content}
</div>
```

### 4.2 Play.tsx 内联 style 迁移

将 Play.tsx 中的 `<style>` 标签内容迁移到 `index.css`：

```css
/* 搜索扫描线动画 */
@keyframes scanLine { ... }
@keyframes scanVertical { ... }
@keyframes radarSweep { ... }

.animate-scan-line { animation: scanLine 2s ease-in-out infinite; }
.animate-scan-vertical { animation: scanVertical 2s ease-in-out infinite; }
.animate-radar-sweep { animation: radarSweep 2s linear infinite; }
```

### 4.3 搜索结果切换过渡

在搜索结果容器上添加过渡：

```tsx
<div className={`transition-all duration-300 ${isAggregated ? 'opacity-100' : 'opacity-90'}`}>
  {/* 结果内容 */}
</div>
```

---

## 5. 移动端交互增强

### 5.1 视频卡片移动端交互

在 VideoCard 中添加移动端长按触发 Action 的逻辑：

```tsx
const [showActions, setShowActions] = useState(false);
const longPressTimer = useRef<NodeJS.Timeout>();

const handleTouchStart = () => {
  longPressTimer.current = setTimeout(() => {
    setShowActions(true);
  }, 500);
};

const handleTouchEnd = () => {
  clearTimeout(longPressTimer.current);
};
```

### 5.2 MobileNav 滑动切换

在 MobileNav 中添加触摸滑动检测：

```tsx
const touchStartX = useRef(0);
const touchEndX = useRef(0);

const handleTouchStart = (e: React.TouchEvent) => {
  touchStartX.current = e.touches[0].clientX;
};

const handleTouchMove = (e: React.TouchEvent) => {
  touchEndX.current = e.touches[0].clientX;
};

const handleTouchEnd = () => {
  const diff = touchStartX.current - touchEndX.current;
  if (Math.abs(diff) > 50) {
    if (diff > 0) {
      // 左滑 → 下一页
      navigateToNext();
    } else {
      // 右滑 → 上一页
      navigateToPrev();
    }
  }
};
```

### 5.3 PlayOverlay 移动端点击

确保 PlayOverlay 在移动端可通过点击触发，而非依赖 hover：

```tsx
<div 
  className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
  onClick={handlePlay}
>
  {/* Play 按钮 */}
</div>
```

---

## 实现顺序

1. **PageContainer + VideoGrid**（P0）— 基础布局统一
2. **主题闪烁修复**（P0）— 用户体验关键
3. **微交互优化**（P1）— 提升质感
4. **移动端交互**（P1）— 功能完整性

每个阶段完成后进行视觉验证，确保 6 套主题无问题。
