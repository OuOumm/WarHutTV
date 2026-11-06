# 归档报告

本目录存放历史上一次性生成、**已不再维护**的分析/优化报告。它们记录的是当时
（2026-07 及更早）的代码状态，其中的行号、结论与优先级很可能已经与当前代码不符。

判断代码现状请以以下文档为准：

- [`docs/project-review-2026-11-03.md`](../project-review-2026-11-03.md) —— 当前有效的完整审查与修复记录
- [`docs/code-review-guide.md`](../code-review-guide.md) —— 审查标准（P0–P3 分级口径）
- [`docs/code-review-checklist.md`](../code-review-checklist.md) —— PR 自查清单

| 文件 | 原始路径 | 说明 |
|---|---|---|
| `frontend-ANALYSIS_REPORT.md` | `frontend/ANALYSIS_REPORT.md` | 前端首轮分析 |
| `frontend-ARCHITECTURE_REVIEW_2026-07-09.md` | `frontend/ARCHITECTURE_REVIEW_2026-07-09.md` | 前端架构评审（2026-07-09） |
| `frontend-OPTIMIZATION_REPORT_2026-07-09.md` | `frontend/OPTIMIZATION_REPORT_2026-07-09.md` | 前端优化报告（2026-07-09） |

归档原因：这些报告曾散落在 `frontend/` 目录，被误当成构建产物旁的手册；
移动到这里是为了让 `frontend/` 只保留源码与配置，同时保留历史可追溯性。
