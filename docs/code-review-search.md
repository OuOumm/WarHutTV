# Search.tsx — Vercel Code Review

**File**: `frontend/src/pages/Search.tsx`  
**Size**: 282 行 · 1 个组件 · 3 个自定义逻辑块  
**分析日期**: 2026-06-19

---

## 1. P0 — Critical Issues

### 1.1 重复的精确匹配过滤（双重计算）

| 行号 | 问题 |
|------|------|
| 264–267 | 'all' 视图下 `isExactMatch` 过滤逻辑与 `aggregatedResults` 的 `useMemo` 重复计算 |

`aggregatedResults` 已经在 `useMemo` 中做了 `isExactMatch` 过滤，但 'all' 视图渲染时又重新执行一次同样的过滤。每次渲染产生两次 O(n) 的计算。

**修复方案**：让 'all' 视图共享同一个 memoized 结果，或提取过滤逻辑为独立函数。

### 1.2 类型安全

| 行号 | 问题 |
|------|------|
| 86 | `any[]` — 丢失类型安全 |
| 169 | `(g as any)` 类型断言 — 绕过 TS 检查 |

**修复方案**：声明 `SiteSearchResult` 接口继承 `VideoItem`，添加 `source_name?: string` 和 `site_key?: string`。

---

## 2. P1—P2 — Component Extraction

| 建议组件 | 行范围 | 行数 | 原因 |
|---------|--------|------|------|
| **`SearchProgressBar`** | 194–219 | ~25 | 流式搜索进度条：旋转动画图标 + 进度文本 + 进度条，逻辑自洽 |
| **`SearchResultHeader`** | 231–246 | ~15 | 结果标题 + Toggle 控制区，包含视图模式逻辑 |
| **`SourceCountBadge`** | 254–259 | ~6 | 多源标记徽章，JSX 三层嵌套 |

---

## 3. Hook Extraction

| 建议 Hook | 行范围 | 行数 | 说明 |
|-----------|--------|------|------|
| **`useSearchStream()`** | 69–145 | ~80 | SSE 流式搜索逻辑，封装 EventSource 生命周期（open/message/error/timeout） |
| **`useLocalStorage()`** | 35–56 | ~20 | 两个 state 共享 4 次 try-catch 重复模板代码 |

提取后 Search.tsx 可从 282 行缩减到约 150 行。

---

## 4. P4 — Minor Issues

| 行号 | 问题 | 建议 |
|------|------|------|
| 243 | 聚合 toggle `onChange` 未用 `useCallback` | `const toggleViewMode = useCallback(...)` |
| 15–24 | `Toggle` 组件未用 `React.memo` | 先稳定 `onChange` prop 后包裹 `memo` |
| 248 | 大量结果无虚拟化 | `results.length > 50` 时复用 `LazyGrid` 或引入 `react-window` |
| 112–144 | 两个 `error` 事件处理器重复 | 移除第 138 行 `eventSource.onerror`，保留 `addEventListener('error', ...)` |
| 225 | 5 个条件串联渲染 | 提取为 `const showEmpty = !loading && !error && results.length === 0 && !!keyword && !streamProgress` |

---

## 5. Rendering — `&&` Safety

| 行号 | 表达式 | 状态 |
|------|--------|------|
| 194 | `{streamProgress && (...)}` | ✅ 安全 |
| 221 | `{error && (...)}` | ✅ 安全 |
| 225 | 5 条件串联 | ✅ 安全（全布尔） |
| 229 | `{results.length > 0 && (...)}` | ✅ 安全 |
| 253 | `{agg.sourceCount > 1 && (...)}` | ✅ 安全（`sourceCount ≥ 1`） |

---

## 6. Composition Patterns

- **Boolean prop proliferation**: ✅ 无此问题
- **可复用模式**：localStorage 读写和 SSE 流可提取为自定义 hook
- **IIFE in JSX**: ✅ 无 IIFE

---

## Summary

| 优先级 | 类型 | 改动量 | 收益 |
|--------|------|--------|------|
| 🔴 P0 | 双重过滤修复 | ~5 行 | 消除每次渲染的多余计算 |
| 🔴 P1 | 类型安全 | ~10 行 | `any` → 具体接口 |
| 🟡 P2 | 提取 `useSearchStream` | ~80 行→新文件 | 消除冗余，可测试 |
| 🟡 P2 | 提取 `SearchProgressBar` | ~25 行 | 组件化 |
| 🔵 P4 | `useCallback` + `memo` | ~5 行 | 减少重渲染 |
