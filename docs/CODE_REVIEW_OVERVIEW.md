# 代码审查体系总览（Overview）

本目录建立了 WarHutTV 的系统化代码审查机制。

## 交付物

| 文件 | 作用 |
|------|------|
| `docs/code-review-guide.md` | **总标准与流程**：角色职责、PR 生命周期、CI 门禁、合并门槛、P0–P3 优先级、后端 Go / 前端 TS 专项、安全专项、注释规范、4 阶段落地路线 |
| `.github/PULL_REQUEST_TEMPLATE.md` | PR 提交模板：统一类型、自测步骤、审查重点、作者自检、影响范围 |
| `docs/code-review-checklist.md` | 审查者一页纸速查卡，逐条对照 |

## 核心规则速记
- 优先级：🔴 P0 阻塞（必须清零）/ 🟠 P1 重要 / 🟡 P2 建议 / 🔵 P3 优化
- 合并门槛：CI 全绿 + ≥1 批准（核心/安全 ≥2）+ 所有 P0 清零
- 注释格式：`优先级 + 分类 + 文件:行 + 为什么 + 建议`
- 与现有 `docs/code-review-*.md`（模块记录）和 `docs/fix-plan.md`（已知债务）配套，新 PR 不得新增同类问题

## 下一步建议
1. 团队评审通过本指南，采用 PR 模板。
2. 在 `ci.yml` 增加 `npm run lint` 与 `go vet ./...`（新代码准入，逐步收紧）。
3. 解决后端 embed 导致 `go test` 不可跑的问题后，开启测试门禁。
