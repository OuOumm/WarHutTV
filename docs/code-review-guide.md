# WarHutTV 代码审查标准与流程（Code Review Guide）

> 统一团队的代码审查基线，让"质量参差不齐"变成"可控、可教、可度量"。
> 本指南是**总标准**；`docs/code-review-*.md` 是模块级审查记录，`docs/fix-plan.md` 是已知技术债务清单，三者配套使用。

---

## 0. 为什么要有这份标准

项目当前状态（详见 `docs/fix-plan.md`）：

- 后端因 `//go:embed frontend/dist/*` 在干净 checkout 下无法运行 `go test ./...`；
- 前端 `npm run lint` 当前有 **54 个问题（51 error / 3 warning）** 未收敛；
- CI 仅做"构建"，**没有 lint / vet / test 门禁**；
- 一批真实风险已记录但未系统性拦截：默认弱密码、JWT 出现在 URL query、代理 SSRF、配置并发 map、第三方请求无大小/状态码检查、Bangumi 错误返回 200 空数组等。

目标：**新增代码不再制造同类问题**，存量问题按 `fix-plan.md` 优先级逐步还清。

### 0.1 审查原则（请默念三遍）

1. **教学，而非门禁**——每条评论都尽量让作者下次写得更对。
2. **具体，而非模糊**——"第 42 行这里可能 SQL 注入" 优于 "有安全问题"。
3. **建议，而非命令**——"建议改成 X，因为 Y" 优于 "改成 X"。
4. **及时**——审查拖一周，上下文就凉了，作者也忘了为什么这么写。

---

## 1. 审查流程（Process）

### 1.1 角色与职责

| 角色 | 职责 |
|------|------|
| **作者（Author）** | 写代码 + 自测 + 按模板填 PR 描述 + 及时响应评论 + 合并前 Squash |
| **审查者（Reviewer）** | 至少一个；核心/安全模块建议两人。逐条给结论（平手/采纳/拒绝需论证），不"已读"。 |
| **维护者（Maintainer）** | 拥有最终合并权；对 P0 清零负责；裁决争议。 |

> 轮换审查者，避免"只有一个人看得懂某模块"。核心模块（auth、search、proxy、config）至少 1 名熟悉该模块的人参与。

### 1.2 分支与 PR 规范

- 从 `master` 切分支：`feat/xxx`、`fix/xxx`、`chore/xxx`、`refactor/xxx`。
- PR 标题格式：`<type>: <简短描述>`（type ∈ feat/fix/refactor/chore/docs/test/perf/security）。
- 必须关联 Issue（如 `Closes #123`）；无 Issue 的小改动需说明动机。
- 单个 PR 建议 **≤ 400 行改动**（不含生成代码）；超大类改动拆分为多个 PR。
- 禁止把格式化/重构与功能改动混在同一 PR（除非 PR 主题就是重构）。

### 1.3 PR 生命周期与时效

```
作者提交 ──▶ 自动 CI（build/vet/lint/test）──▶ 指定 Reviewer ──▶ 审查轮次 ──▶ P0 清零 + 批准 ──▶ 维护者 Squash 合并
```

| 环节 | 时效建议 |
|------|----------|
| Reviewer 首次响应 | ≤ 1 个工作日 |
| 单轮审查耗时 | ≤ 30 分钟（大 PR 拆分或预约） |
| 作者响应评论 | ≤ 1 个工作日 |
| 争议裁决 | 维护者 24h 内介入 |

### 1.4 合并门槛（硬性）

一个 PR 满足**全部**条件方可合并：

1. ✅ CI 全绿（构建 + vet + lint + test，逐步开启，见 §6）；
2. ✅ 至少 **1 个**批准（核心/安全模块 **2 个**）；
3. ✅ **所有 P0 必须清零**（不允许带 P0 合并）；
4. ✅ 所有 P1 已修复，或 Reviewer 与作者明确达成一致并记录 waiver；
5. ✅ 破坏性 API 变更已在 PR 描述中说明，且前端/后端配套 PR 已协调。

### 1.5 合并方式

- 默认 **Squash Merge**，提交信息采用 PR 标题 + 关键说明。
- 提交信息写成"为什么"而非"做了什么"：`fix(auth): 拒绝默认 JWT secret 启动，避免 token 伪造` 优于 `update auth.go`。

### 1.6 紧急修复（Hotfix）

安全/线上故障可走快通道：1 名维护者批准即可合并，但 **P0 仍需清零**，且必须在合并后 24h 内补齐 PR 描述与自测记录。

---

## 2. 审查标准（Standards）

### 2.1 优先级定义

| 级别 | 含义 | 合并前要求 |
|------|------|-----------|
| 🔴 **P0 阻塞** | 安全漏洞、数据损坏/丢失、并发 panic、编译失败、破坏 API 契约、关键路径无错误处理 | **必须清零** |
| 🟠 **P1 重要** | 输入校验缺失、明显性能问题、错误处理不当、类型不安全（`any` 滥用）、可观测性差 | 必须修复或书面 waiver |
| 🟡 **P2 建议** | 可维护性（重复代码/大函数）、缺失测试、lint 失败、命名不清 | 建议修复，记为 follow-up |
| 🔵 **P3 优化** | 风格、文档、细微命名/格式 | 可选 |

> 历史文档中的 "P4" 一律对应本标准的 **P3**。

### 2.2 通用审查维度（每条都过一遍）

**正确性（Correctness）**
- 是否真正实现了需求？边界条件（空、超长、负数、并发）是否处理？
- 并发安全：共享 map/slice 是否有锁？`config.Snapshot()` 是否深拷贝？（参考 `fix-plan.md` P1-配置并发）
- 错误是否被吞掉？`err != nil` 后是否真的处理或返回？

**安全（Security）** —— 见 §2.5 专项
- 鉴权是否在每个受保护路由生效？是否存在绕过？
- 用户输入是否做了校验/转义？是否存在注入/SSRF/XSS？

**可维护性（Maintainability）**
- 6 个月后的人能否看懂？命名是否表达意图？
- 是否有"魔法数字"？是否提取了可复用函数/组件？
- 死代码、注释掉的代码、调试 `fmt.Println` 是否清理？

**性能（Performance）**
- 是否有 N+1（如逐站点串行请求应并发，参考 `search.go` 已用 goroutine+WaitGroup）？
- 是否无限读响应体（用 `io.LimitReader`）？是否有不必要的重渲染/重复计算？

**测试（Testing）**
- 关键路径（鉴权、代理、配置更新、聚合去重）是否有测试？
- 新增 handler / util 是否可单测（依赖是否可注入）？

### 2.3 后端 Go 专项（本项目重点）

| 关注点 | 检查项 | 参考 |
|--------|--------|------|
| **并发安全** | 不在 handler 中直接遍历全局 `cfg.APISite`；用 `config.Snapshot()` 取深拷贝快照；`append` 到共享 slice 要加锁 | `search.go:64,185` `fix-plan` P1 |
| **错误处理** | 不返回"假成功"：第三方失败应返 `502` 而非 `200 []`；`err` 要带上下文（`fmt.Errorf("...: %w", err)`） | `fix-plan` P2-Bangumi |
| **第三方请求** | 检查 `resp.StatusCode` ∈ 200–299；用 `io.LimitReader` 限制响应体（如 10MB）；错误含状态码 | `fix-plan` P1 |
| **鉴权** | JWT 用 `Authorization: Bearer` 头校验；**不要把 token 放进 URL query**（会进日志/历史） | `fix-plan` P1-SSE token |
| **SSRF（代理）** | `/api/proxy/*` 只允许 http/https；禁止 localhost/内网/链路本地/云元数据地址；限大小 | `fix-plan` P0-m3u8 代理 |
| **SSE 流** | 检测客户端断开（`c.Request.Context().Done()`）；校验 `http.Flusher`；设总超时（如 20s）；写竞争用 mutex | `search.go:113,144` |
| **默认配置** | 禁止默认弱密码 / 固定 `JWTSecret`；启动时拒绝默认值或自动生成强随机 | `fix-plan` P0 |
| **CORS** | 不共存 `Access-Control-Allow-Origin: *` 与 `Allow-Credentials: true`；用 Origin 白名单 | `fix-plan` P1 |
| **Go 习惯** | handler 内不 `panic`；用 `errors` 包；`context` 正确传递与取消；`defer` 释放资源 | — |

### 2.4 前端 TS / React 专项

| 关注点 | 检查项 | 参考 |
|--------|--------|------|
| **类型安全** | 禁止 `any` / `(x as any)`（除非合理且注释原因）；为 API 响应声明接口 | `code-review-search.md` P1 |
| **Hook 规则** | 不 `set-state-in-effect`；状态更新保持不可变；导出组件的文件不混出非组件 | `eslint.config.js` |
| **渲染安全** | `{cond && <C/>}` 中 `cond` 不可为数字 `0`；`key` 用稳定 id 而非 index | `code-review-search.md` §5 |
| **组件/Hook 提取** | 单文件 > 250 行、单组件含多个自洽逻辑块时拆分（如 `useSearchStream`） | `code-review-search.md` P2 |
| **性能** | 避免每次渲染重复计算（提取 `useMemo`）；长列表 `> 50` 考虑虚拟化；稳定 `onChange` 后用 `React.memo` | `code-review-search.md` P0/P4 |
| **安全** | 禁止 `dangerouslySetInnerHTML` 拼接未转义内容；token 存内存而非 `localStorage` 明文 | — |
| **构建** | `tsc -b` 应通过（无类型错误）；不提交 `dist/` | `package.json` build |

### 2.5 安全专项（贯穿所有代码）

审查时单独过一遍这条清单：

- 🔴 是否存在**鉴权绕过**（未校验 token、白名单误配）？
- 🔴 是否存在**注入**（SQL/命令/模板）——本项目目前以参数化/受控为主，注意新增的外部命令调用？
- 🔴 是否存在 **SSRF**（代理/抓取类接口访问内网/元数据）？
- 🔴 是否有**默认凭证 / 硬编码密钥**（密码、JWT secret、API key）？
- 🟠 是否有**敏感信息泄露**（token 进 URL/日志、错误信息暴露内部细节）？
- 🟠 是否有 **XSS**（未转义渲染用户/第三方内容）？
- 🟠 CORS / Cookie 安全配置是否合规？

---

## 3. 评审注释规范（Comment Format）

与现有 `docs/code-review-*.md` 风格对齐，让模块记录和总标准一致。

```
🔴 P0 安全：JWT 出现在 URL query
文件 search.go / 行 50：token 通过 query 参数传递。

为什么：JWT 会进入浏览器历史、服务端访问日志、反向代理日志，泄露窗口长。
建议：改用 Authorization 头（fetch + ReadableStream 解析 SSE），或签发短期 SSE 专用 token。
```

要点：
- 行首标 **优先级 + 分类**（如 `🔴 P0 安全`、`🟡 P2 可维护性`）。
- 必须给**位置**（文件:行），方便定位。
- 必须说清 **为什么**（影响/风险），而不只是"不对"。
- 给 **建议**（具体改法或方向），而非只抛问题。
- 好的写法要**表扬**：发现巧妙解法/清晰结构时，明确点出 ✅。

---

## 4. 审查者自检（合并前最后一遍）

- [ ] 所有 P0 已清零，P1 已修复或记录 waiver
- [ ] 跑过（或 CI 已跑）构建 / vet / lint / test
- [ ] 安全专项清单（§2.5）已过
- [ ] 新增公共函数/组件有类型/注释，关键路径有测试或测试计划
- [ ] 破坏性变更已说明并有配套 PR
- [ ] 自测步骤在 PR 描述中可复现

## 5. 作者提交前自检（Pre-flight）

- [ ] 本地 `go build` / `npm run build` 通过
- [ ] `go vet ./...` / `npm run lint` 无新增问题
- [ ] 关键路径自测过（含边界：空输入、断网、第三方 500）
- [ ] 无调试残留（`fmt.Println`、注释代码、`console.log`）
- [ ] PR 描述按模板填写，含自测步骤

---

## 6. 渐进式落地路线（Rollout）

不要一口气全开，避免团队被红色 CI 淹没。

**阶段 1 — 流程先行（本周可做）**
- 落地本指南 + `PULL_REQUEST_TEMPLATE.md` + `code-review-checklist.md`。
- 人工审查试行：所有 PR 按 P0–P3 给结论。

**阶段 2 — 加 Lint / Vet 门禁**
- 在 `ci.yml` 增加：
  ```yaml
  - name: Lint Frontend
    working-directory: frontend
    run: npm run lint
  - name: Vet Backend
    working-directory: backend
    run: go vet ./...
  ```
- 因存量 54 个问题，先用 `"lint": "eslint ."` 并以**新代码准入**方式推进（见 `fix-plan.md` P2 的修复顺序），或临时加 `--max-warnings` 阈值逐步收紧。

**阶段 3 — 打通测试门禁**
- 先解决 `embed` 导致 `go test ./...` 跑不起来的问题（拆 `static_embed.go` / `static_dev.go`，参考 `fix-plan.md` P0）。
- CI 加 `go test ./...` 与前端测试脚本（需先补 `test` script）。
- 对 auth / proxy / config / 聚合去重 优先补单测。

**阶段 4 — 质量度量（可选）**
- 引入覆盖率门槛（如后端 ≥ 60%、前端关键路径 ≥ 50%），随成熟度提升。
- 每季度回顾 `fix-plan.md`，将已修复项归档。

---

## 7. 与现有文档的关系

| 文档 | 角色 |
|------|------|
| `docs/code-review-guide.md`（本文件） | **总标准与流程**，所有 PR 的统一依据 |
| `docs/code-review-{search,speedtest,play}.md` | 模块级审查记录，遵循本标准的 P0–P3 注释格式 |
| `docs/fix-plan.md` | 已知技术债务（P0–P3），新 PR 不得新增同类问题 |

> 新建模块审查记录时，直接复用 §3 的注释格式，并回链到本指南对应章节。

---

*维护：本文件由团队共同维护。重大变更（优先级定义、合并门槛调整）需维护者评审。*
