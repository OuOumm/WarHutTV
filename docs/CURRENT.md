# CURRENT — WarHutTV 当前状态

> 本页是**当前事实**的唯一入口，服务于优化决策。历史修复过程见 `project-review-2026-11-03.md`（已冻结为历史快照），领域术语见根 `CONTEXT.md`，已定决策见 `docs/adr/`。
>
> 状态核对时间：2026-11-21，基线 `master` @ `dfdd02a`（version 1.3.2）。

## 已落地（代码核实，非文档声称）

| 能力 | 证据 |
|---|---|
| JWT 鉴权 + Cookie | `handlers/auth.go`、`utils/jwt.go`：HttpOnly/SameSite Cookie、HMAC 算法断言、常量时间比较 |
| SSRF 防护 | `services/proxy.go`：黑名单 + DNS 预检 + 响应体限流；`config.Save` 时校验源地址 |
| SSE 搜索：每源独立超时 / 心跳 / 取消 / 限流 | `handlers/search.go`：per-site context、15s 心跳、失败计入进度、单写协程 |
| 缓存有界 + 原子写 | `services/cache.go`：256MiB 上限 + janitor + temp+rename |
| 前端播放页 reducer 化 + 子 Hook 拆分 | `pages/play/`：`usePlayReducer.ts` + 7 个 Hook；续播 / 换源 / 排序均有单测 |
| 结构化访问日志 + request-id | `middleware/logging.go`：`RequestLogger` 打 method/path/status/latency/ip/ua，query 脱敏；`RequestID` 回显 `X-Request-Id` |
| 优雅退出 | `main.go`：`signal.NotifyContext` + HTTP server `Shutdown` |
| 健康检查 `/api/healthz` | `handlers/health.go` |
| CI 门禁 | `.github/workflows/ci.yml`：lint / test / tsc / build / bundle-gate / gofmt / vet / `go test -race` |
| 非 root + healthcheck 镜像 | `Dockerfile` |
| `prefers-reduced-motion` + `aria-live` | `index.css:634`、`OptimizingOverlay.tsx:60`、`SearchingOverlay.tsx:35`、`ToastProvider.tsx:90` |
| 配置启动后不可变 | `config/config.go`：`atomic.Pointer[Config]` + 单次 Load，热重载已按 ADR 之外的技术决策撤销 |
| 分集解析只在客户端（本次优化） | ADR-0001：后端删 `episodes` 字段 / `/api/play` / `ProxyPlay` / `ParsePlaylist`；前端 `parseEpisodes` 为唯一真相，新增 6 例单测，并修复双 m3u8 线路默认漂移 bug |
| 前端类型单一来源（本次优化） | 删死类型 `User`、`getAuthHeaders`；`ApiSiteConfigResponse` 复用 `SiteConfig`；`OptimizingOverlay` 复用 `play/types` 的 `SourceItem`（消除本地少 `vodId` 的漂移副本） |

## 未做（P3 真实剩余清单，已剔除文档误报）

| 项 | 说明 |
|---|---|
| 后端 handler 依赖注入 | handler 直接调包级 `services.*` 与 `config.Snapshot()`，无接口 / fake upstream；`httptest` 覆盖仅 `search_test.go` 的纯函数 |
| 结构化错误模型 | 错误一律 `gin.H{"error": "上游请求失败..."}` + HTTP 状态；前端只能读 `error` 字符串，无法区分超时 / 上游坏状态 / 站点不存在 / 输入非法 |
| `singleflight` / 负缓存 | 同关键词并发搜索不合并；死源每次都试 |
| `/readyz` + `/metrics` | 只有 `/healthz`；无 Prometheus 指标 |
| 密码 argon2id 哈希 + 会话版本号 | 明文密码比较（`subtle.ConstantTimeCompare`）；改密后旧 token 不失效（改密功能已删除，见历史 10.7） |
| 前端运行时响应校验 | `response.data as T` 盲转型；无 zod / valibot |
| 类型单一来源 | `ApiSiteEntry` 在两处重复定义；`SourceItem` 与 `types/index.ts` 部分重叠；Cookie 迁移后的 `User` / `getAuthHeaders` 是死类型 |
| 播放页上下文拆分 | `usePlayController` 返回 30+ 字段，父组件 state 变化重渲染整页 |
| 长列表虚拟化 | 搜索 / 豆瓣无虚拟化；`ScrollableRow` 已有 rAF 优化 |
| 图片后端代理 | 海报走 CDN 直连（`utils/image.ts`），**有意取舍：不改为后端代理** |
| 页面级组件测试 / E2E | 12 个前端测试集中在 store / play 纯逻辑，无页面级 / MSW / Playwright |
| 构建入口统一 | `Makefile` / `build.sh` / `build.ps1` / CI / `Dockerfile` 五处逻辑重复，已漂移过一次 |
| CONTRIBUTING.md / SECURITY.md / CHANGELOG.md | 不存在 |

## 明确的取舍（不要重新讨论）

- **一个采集站 = 一个源 = 一个 m3u8 线路**；mp4 线路不构成可播放源（见 `CONTEXT.md`）。
- **分集解析只在前端**（见 `docs/adr/0001-frontend-parses-episodes.md`）；服务端不解析、不返回 `episodes`、不提供 `/api/play`（已于本次优化删除）。
- **图片走 CDN 直连**，不引入后端图片代理。
- **配置不热重载**，改配置需重启；`PASSWORD` / `JWT_SECRET` 环境变量优先于文件。
