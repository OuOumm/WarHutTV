# Play.tsx — Vercel Code Review

**File**: `frontend/src/pages/Play.tsx`  
**Size**: 1067 行 · 3 个模块级组件 · 20 个 `useState` · 2 个 `useEffect` · 5 个 `useCallback` · 4 个 `useRef`  
**分析日期**: 2026-06-19

---

## 1. P0 — Critical Issues

### 1.1 O(n²) 双重 filter（OptimizingOverlay）

| 行号 | 问题 |
|------|------|
| 154–158 | `sources.filter(...).map(...)` 内层又一个 `sources.filter(...)`：外层 filter 执行 m 次，内层 filter 每次又执行一次 |

```tsx
// 当前：sources.filter() 被调用了 m + m*m 次
{sources.filter(s => s.status === 'done' && s.speed).map((_, i) => {
    const angle = (i / sources.filter(s => s.status === 'done' && s.speed).length) * 360;
```

**修复方案**：先存到变量再 map
```tsx
{(() => {
  const doneSources = sources.filter(s => s.status === 'done' && s.speed);
  return doneSources.map((_, i) => {
    const angle = (i / doneSources.length) * 360;
    ...
  });
})()}
```

### 1.2 IIFE in JSX（运行时函数分配）

| 行号 | 模式 | 出现次数 |
|------|------|----------|
| 881–885 | `{(() => { if (source.status === 'testing')... })()}` | 2 次（OptimizingOverlay） |
| 964–968 | 相同 IIFE 模式（source tab） | 2 次 |

每次渲染创建新函数，且相同模式出现两次。

**修复方案**：提取为 `SourceStatus` 组件或纯函数。

---

## 2. P1 — Bundle Size

### 动态导入机会

| Import | 行号 | 使用场景 | 建议 |
|--------|------|----------|------|
| `testVideoSpeed` (`speedtest`) | 12 | 只在 `startOptimize` 中使用 | **懒加载** → 拉入 ~7KB hls.js |
| `favoritesStore` | 8 | 只在 `toggleFavorite` 和 `loadDetail` 中 | 懒加载 |
| `detailCacheStore` | 10 | 只在 `loadDetail` 中 | 懒加载 |
| `fetchAndFilterM3U8` (`adblock`) | 11 | 只在 `getPlayableUrl` 回调中 | 懒加载 |
| `filterYellowItems` / `isExactMatch` (`filter`) | 14 | 只在 `startOptimize` 和 `handleSourceSwitch` | 懒加载 |
| `Player` | 6 | ✅ **已懒加载** | — |

**关键收益**：`testVideoSpeed` 懒加载可节省 hls.js 的 ~7KB gzipped bundle。

---

## 3. P2 — Component Extraction

必须提取的模块级组件：

| 当前定义 | 行范围 | 行数 | 建议文件 |
|---------|--------|------|---------|
| **`SearchingOverlay`** | 70–125 | 55 | `src/components/SearchingOverlay.tsx` |
| **`OptimizingOverlay`** | 128–217 | 89 | `src/components/OptimizingOverlay.tsx` |

这两个组件在模块级定义，但仍在 Play.tsx 中占 144 行。提取后可独立测试。

其他提取候选：

| 建议组件 | 行范围 | 原因 |
|---------|--------|------|
| **`SourceStatus`** | 881–885 / 964–968 | 消除 IIFE 重复 |
| **`EpisodeGrid`** | ~915–935 | 集数选择网格：grid-cols-4 + 50+ 按钮 |
| **`SourceSelector`** | ~785–820 | 视频源选择 Tab 列表 |
| **`PlayHeader`** | ~725–780 | 视频详情头部（封面 + 标题 + 操作按钮） |

---

## 4. P3 — useCallback 分析

| `useCallback` | 行号 | Deps | 评估 |
|---------------|------|------|------|
| `getPlayableUrl` | 248 | `[]` | ❌ **多余** — 空 deps 说明无响应式依赖，应提到模块级函数 |
| `applyHistoryProgress` | 265 | `[]` | ❌ **多余** — 同上 |
| `handleSourceSwitch` | 703 | 5 个 deps | ✅ 合理 — 传给子元素 |
| `handleEpisodeClick` | 752 | 3 个 deps | ✅ 合理 — 50+ 集数按钮 |
| `toggleFavorite` | 774 | `[detail]` | ⚠️ 边缘 — 逻辑过于简单，memo 开销可能超过内联 |

---

## 5. P4 — Minor Issues

| 行号 | 问题 | 建议 |
|------|------|------|
| 294 | `useEffect` 内使用组件内 `loadDetail` 但未在 deps 中包含 | 使用 `useCallback` 包裹 `loadDetail` 或添加 ESLint 注释 |
| 529–536 | `parseSpeed` 在 `startOptimize` 回调内定义 | 提到模块级函数 |
| 619–691 | EventSource 的 `onerror` 和 `addEventListener('error',...)` 都有 cleanup | 移除冗余处理器 |
| 881–885 | IIFE 中 status 样式模式与 ~964–968 重复 | 提取为 `sourceStatusStyle(status)` 工具函数 |

---

## 6. Composition Patterns

- **Boolean prop proliferation**: ✅ Play 本身没有布尔 prop 蔓延
- **Compound component 机会**: `SourceSelector` + `EpisodeGrid` + `Player` 可组成 compound 结构
- **State 提升机会**: 搜索状态（`searchData`, `searchProgress`）集中在 Play 内可接受，但可提取到 `useSearch` hook

---

## Summary

| 优先级 | 类型 | 改动量 | 收益 |
|--------|------|--------|------|
| 🔴 P0 | O(n²) filter 修复 | ~5 行 | 消除性能热点 |
| 🔴 P1 | `SearchingOverlay` 提取 | ~55 行→新文件 | 文件减少 5% |
| 🔴 P1 | `OptimizingOverlay` 提取 | ~89 行→新文件 | 文件减少 8% |
| 🔴 P1 | 懒加载 `testVideoSpeed` | ~3 行 | 节省 ~7KB bundle |
| 🟡 P2 | IIFE → `SourceStatus` 组件 | ~15 行 | 消除重复函数分配 |
| 🟡 P2 | `useCallback` 空 deps 修复 | ~5 行 | 消除误导性 memo |
| 🔵 P4 | `parseSpeed` 提到模块级 | ~2 行 | 避免每次分配 |
| 🔵 P4 | 冗余 error 处理器清理 | ~3 行 | 清理 |

提取两个 Overlay 后 Play.tsx 可从 1067 行缩减到约 850 行。
