# 代码审查执行记录 · 2026-07-08

> 按代码审查专家自身准则（正确性 / 安全 / 可维护性 / 性能 / 测试）独立审查，不依赖 `fix-plan.md` 的清单。
> 配套标准见 `docs/code-review-guide.md`。

## 审查范围

- **后端（Go，全部 18 个源文件）**：逐文件完整审查。
- **前端关键链路（TS/React）**：`api/client.ts`、`store/auth.tsx`、`api/searchStream.ts`、`api/auth.ts`、`pages/Play.tsx`、`pages/play/*`、`utils/{filter,speedtest,adblock,image}.ts`。
- **未覆盖**：前端 6000+ 文件中非关键业务代码（组件样式、页面展示层）；按本次范围，这类不纳入"问题修复"。

## 总体结论

代码整体质量**明显优于 `fix-plan.md` / `code-review-*.md` 的描述**——那些文档是基于更早版本写的，现已过时。具体讲：

- `fix-plan.md` 的 P0「JWT 默认密钥」「SSE token 进 URL」「m3u8 代理缺失」**均已在当前代码中修复**（JWT 启动时自动生成强随机；SSE 走 `Authorization` 头 + `fetch` 流；`getPlayableUrl` 改为直连 m3u8 并客户端过滤广告）。
- `code-review-search.md` 的「`any[]`」「`as any`」「组件未提取」**也已修复**（`Search.tsx` 已有 `SiteSearchResult` 接口与提取的子组件）。

本次独立审查发现的**真实剩余问题**已修复（见下）。

---

## ✅ 已修复

### 🔴 P0 — 静态分析阻断 / 未定义行为
**`backend/config/config.go` — `Snapshot()` 拷贝了含 `sync.RWMutex` 的 `Config` 值**
`go vet` 报错：`call of json.MarshalIndent copies lock value`。`Snapshot()`/`snapshotLocked()` 返回 `Config` 值，会复制内嵌互斥锁（未定义行为）。
- **修复**：新增无锁的 `ConfigSnapshot` 类型，`Snapshot()` 与 `snapshotLocked()` 返回它，`Save` 序列化该类型。vet 通过。

### 🟠 P1 — 安全 / 正确性
**`backend/services/cache.go` — 缓存目录权限 `0644` → `0755`**
`os.MkdirAll(cacheDir, 0644)` 创建的目录缺少执行位，导致 `saveToDisk` 的 `WriteFile` **静默失败**，磁盘缓存永远写不进去。`NewCache` 与 `Clear` 两处均修正为 `0755`。

**`backend/utils/jwt.go` — 校验未断言签名算法**
`keyfunc` 对任意算法都返回密钥，存在算法混淆（algorithm confusion）隐患。
- **修复**：`keyfunc` 中显式拒绝非 HMAC 方法（`token.Method.(*jwt.SigningMethodHMAC)` 断言），并补单测 `TestValidateTokenRejectsNonHMAC`。

**`backend/handlers/auth.go` — 密码比较非常量时间**
`req.Password != config.Password()` 存在时序侧信道。
- **修复**：改用 `crypto/subtle.ConstantTimeCompare`。

**`backend/handlers/config.go` — `UpdateConfig` 未校验 `api_site` URL**
管理员可写入任意/非法地址（运行时错误或潜在的 SSRF 配置）。
- **修复**：新增 `validateAPISite`，仅允许可解析的 `http/https` 地址；补单测 `TestValidateAPISite`。

### 🟡 P2 — 可维护性 / 重复代码
**`backend/handlers/bangumi.go` — 与 `services` 重复的响应体限大逻辑**
`readLimitedBody` 与 `services.readLimited` 重复。
- **修复**：将 `services.readLimited` 导出为 `ReadLimited`，`bangumi.go` 复用并删除本地副本（顺带消除一个 `io` 未使用导入）。

### 🟢 测试支柱（此前为零）
新增 4 个单测文件，覆盖本轮修复的关键路径，使 CI 测试门禁有内容可跑：
- `utils/jwt_test.go`：签发/校验往返、错误密钥、过期、拒绝非 HMAC。
- `services/proxy_test.go`：`ReadLimited` 边界内/超限。
- `config/config_test.go`：`cloneAPISite` 独立性与 nil 安全。
- `handlers/config_test.go`：`validateAPISite` 合法/非法。

---

## 🔵 残留项（已评估，未强行修改，附理由）

### 🟠 P1 — token 存 `localStorage`（前端）
`api/client.ts`、`store/auth.tsx`、`api/searchStream.ts` 将 JWT 存入 `localStorage`。
- **为什么**：XSS 可窃取令牌。但全仓**无 `dangerouslySetInnerHTML`**，无注入向量，实际风险低；且改为内存存储会丢失刷新后的登录态（UX 回退）。
- **建议**：引入短期 token + 静默刷新，或至少缩短 JWT TTL。属设计决策，需团队拍板，未擅自重构。

### 🟡 P2 — 前端 lint 22 条 warning（0 error）
当前 `npm run lint`：22 problems (0 errors, 22 warnings)。主要为：
- `react-refresh/only-export-components`：store 文件导出 Hook（fast-refresh 的 DX 提示，非缺陷）。
- `react-hooks/set-state-in-effect`（`config.tsx:50` 的 `fetchConfig`）、`react-hooks/immutability`（`usePlayController` 的 `loadDetail`）、`exhaustive-deps`。
- **判断**：均为可维护性/性能建议，非正确性或安全问题；部分为规则对"挂载即拉取"常见模式的误报。未批量改动以避免破坏可用代码。建议在 CI 中以"warning 允许"方式接入 lint，后续增量收敛。

### 🔵 P3 — CORS `Access-Control-Allow-Origin: *`
`middleware/cors.go` 返回 `*` 但未设 `Allow-Credentials`，对 Bearer Token 鉴权是合规的；改为 Origin 白名单会限制自托管自定义域名部署，故保持现状。

### 🔵 P3 — 限流 `ClientIP` 在反代后失效
`middleware/ratelimit.go` 用 `c.ClientIP()`；若部署在反代后未配置 `TrustedProxies`，所有请求会被视为同一 IP，限流退化为全局。建议部署文档注明配置信任代理。

---

## 验证结果

| 检查 | 命令 | 结果 |
|------|------|------|
| 后端构建 | `go build ./...` | ✅ BUILD_OK |
| 后端静态分析 | `go vet ./...` | ✅ VET_OK（修复锁拷贝后） |
| 后端测试 | `go test ./...` | ✅ 4 包通过 |
| 前端类型检查+构建 | `npm run build`（`tsc -b && vite build`） | ✅ 构建成功，类型无误 |
| 前端 lint | `npm run lint` | ✅ 0 error / 22 warning |

## 后续建议
1. 将 `go vet ./...`、`go test ./...`、`npm run lint` 接入 `ci.yml`（lint 以 warning 阈值起步），落实 `code-review-guide.md` 阶段 2。
2. 更新已过时的 `docs/fix-plan.md` 与 `docs/code-review-*.md`，避免误导后续审查。
3. 就「token 存储方案」做设计决策（P1 残留）。
