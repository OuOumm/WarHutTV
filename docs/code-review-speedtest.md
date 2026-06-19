# SpeedTest.tsx — Vercel Code Review

**File**: `frontend/src/pages/SpeedTest.tsx`  
**Size**: 176 行 · 1 个组件 · 1 个接口 · 2 个 import  
**分析日期**: 2026-06-19

---

## 1. P1 — High Priority

### 1.1 重复数组迭代（每次渲染两次 O(n)）

| 行号 | 问题 |
|------|------|
| 153–154 | `results.filter(r => r.status === 'success').length` 和 `results.filter(r => r.status === 'error').length` 各遍历一次 |

每次渲染都做两次完整数组遍历，应合并为单次 `reduce` + `useMemo`。

**修复方案**：
```tsx
const counts = useMemo(() => {
  return results.reduce(
    (acc, r) => {
      if (r.status === 'success') acc.success++;
      else if (r.status === 'error') acc.error++;
      return acc;
    },
    { success: 0, error: 0 }
  );
}, [results]);
```

### 1.2 连续数组变换可合并

| 行号 | 问题 |
|------|------|
| 24–34 | `Object.entries(sites).map(...)` → `siteList.map(...)` → `siteList.map(async ...)` 三次 O(n) 遍历 |

前两步可合并为一次遍历，节省中间数组分配。

---

## 2. P2 — Component Extraction

### StatusBadge（最高收益）

| 行范围 | 当前问题 |
|--------|----------|
| 109–134 | 45 行条件渲染：三个 `&&` 级联判断，重复结构 |

三个 status 渲染块（testing/success/error）共享相同结构：图标 + 颜色文字。提取为：

```tsx
const STATUS_MAP: Record<string, { icon: JSX.Element; label: string; className: string }> = {
  testing: { icon: <SpinnerIcon />, label: '测速中...', className: 'text-yellow-400' },
  success: { icon: <CheckIcon />, label: '可用', className: 'text-green-400' },
  error:   { icon: <XIcon />, label: '不可用', className: 'text-red-400' },
};
```

### 全部提取候选

| 建议组件 | 行范围 | 行数 | 说明 |
|---------|--------|------|------|
| **`TestButton`** | 78–92 | ~15 | 测速按钮，loading/ready 双态，复杂 Tailwind 类 |
| **`StatusBadge`** | 109–134 | ~45 | 状态指示器：图标 + 颜色文字 + 动画 |
| **`SummaryBar`** | 150–157 | ~8 | 可用/不可用/总计统计条 |
| **`EmptyState`** | 161–171 | ~11 | 无数据空态，可跨页面复用 |
| **`SpinnerIcon`** | 85–88, 112–115 | ~4×2 | 重复 SVG 旋转图标 |

---

## 3. P3 — Nested Ternary

| 行号 | 问题 |
|------|------|
| 137–143 | 三重嵌套 `? :` 三元：`r.status === 'success' ? ... : r.status === 'testing' ? ... : ...` |

新增状态（如 `warning`）会导致不可维护。改用 `Record<Status, ...>` 查找表。

---

## 4. P4 — Minor Issues

| 行号 | 问题 | 建议 |
|------|------|------|
| 85–88 | 内联 spinner SVG | 提取为 `SpinnerIcon` 组件（两个地方重复） |
| 161–171 | 空态放在 table 之后 | 可提前 `return` 减少嵌套 |

---

## 5. Composition Patterns

- **Boolean prop proliferation**: ✅ 不适用（无 props）
- **IIFE in JSX**: ✅ 无 IIFE
- **Missing `key`**: ✅ `key={r.site}` 存在且稳定

---

## Summary

| 优先级 | 类型 | 改动量 | 收益 |
|--------|------|--------|------|
| 🔴 P1 | 合并 filter 为 reduce | ~10 行 | 消除两次 O(n) 遍历 |
| 🟡 P2 | 提取 `StatusBadge` | ~45 行→新文件 | 消除三个 `&&` 级联 |
| 🟡 P2 | 提取 `TestButton` | ~15 行 | 隔离复杂 Tailwind |
| 🟡 P2 | 提取 `EmptyState` | ~11 行 | 跨页面复用 |
| 🔵 P3 | 嵌套三元→查找表 | ~5 行 | 可维护性 |
| 🔵 P4 | 提取 `SpinnerIcon` | ~4 行 | 消除重复 |

预计总改动量：~60 行新增文件 + ~20 行修改，文件从 176 行缩减到约 100 行。
