# WarHutTV — 前端项目长期事实

## 技术栈（非 Next.js）
- `frontend/` = Vite 8 + React 19 + TypeScript(严格) + Tailwind v4 + react-router-dom 7 + Dexie(IndexedDB)。
- 状态：React Context（Auth/Config/theme 命令式注入）+ Dexie 本地缓存（apiCache/detailCache/favorites/history/db）。
- 重型播放器 artplayer/hls.js 已独立 `player` chunk 且仅 `/play`、`/speed` 按需（PlayerViewport 内 `lazy()`）。
- 路由级 `lazy()`+Suspense 已在 `App.tsx` 实施；标签页隐藏 `anim-paused` 已在 `main.tsx` 实施。

## 已知 / 已修复事项（避免重复分析或重复上报）
- **缓存串扰 bug 已于 2026-07-09 修复**：`detailCache.cleanExpired` 现在只清非 `api_cache:` 前缀行（`src/store/detailCache.ts`）。`apiCache` 与 `detailCache` 共用 `db.detailCache` 表，但 `api_cache:` 行 TTL 24h–7d，详情缓存 TTL 2h——修复前 detailCache 的 cleanExpired 会误删长效 api 缓存。
- 已修复：Auth/Config context value 未 memo（`auth.tsx`/`config.tsx` 已 `useMemo`+`useCallback`）；Home `onDelete` 内联箭头击穿 memo（`VideoCard.onDelete` 改 `(video)=>void` 直传稳定回调）；`App.tsx` 鉴权 loading 改 `PageSkeleton`；首屏缓存优先已生效；`clearInvalidHistory` 改 `useNavigate`；删 `LazyGrid.tsx`/`hooks/useAuth.ts`、`VideoGrid` 去 `compact`。
- 已修复：详情页简介 `vod_content` 含 `&nbsp;` 等 HTML 实体未解码（`VideoInfo.tsx` 改用 `utils/text.ts` 的 `cleanVodContent()`，先剥离 script/style 再 `DOMParser` 解码并去标签）。

## 分析文档
- `frontend/OPTIMIZATION_REPORT_2026-07-09.md`：四维度（性能/代码精简/UX/调用链路）分析与修复路线图。
- `frontend/ANALYSIS_REPORT.md`（2026-07-08）：UX/动效/视觉/可访问性分析（部分建议已落地）。

## 延后未做的较大重构（按需单独排期）
- **已全部完成（2026-07-09）**：`usePlayController` 拆 `usePlayReducer`(useReducer 状态机) + `playApi.ts` + 瘦 controller；双 HTTP 栈统一（`apiClient` 导出 `getAuthHeaders`/`handleAuthFailure`，`searchStream.ts`/`useVersionCheck.ts` 改用 `apiClient`，统一 401 处理）；`ToastProvider` 统一三套 Toast（`App.tsx` 包裹，`Login`/`History`/`Play` 改用 `useToast`，删旧 `components/Toast.tsx`）；换源不重建播放器（`Player.tsx` 改为挂载时创建一次 + `art.switch` 原地换源/换主题，去掉 `PlayerViewport` 的 `key={playUrl}`）；theme 调色板单源（`themes.data.json` 为唯一源 + `vite.config.ts` 插件注入 HTML 防 FOUC，删 `index.html` 内联副本）；图片 `srcset`（`utils/image.ts` 新增 `buildDoubanSrcSet`/`buildBangumiSrcSet`/`CARD_IMAGE_SIZES`，接入 `VideoCard`/`SourcePanel`）。
- **仍延后**：Douban 长列表虚拟化（按需单独排期）。

## 安全模型（2026-07-09 加固，详见 docs/SECURITY_AUDIT_REPORT.md）
- **重要：本系统没有“管理员/用户”概念，也不存在多用户体系。** “认证”只是一个**单密码站点访问闸口**：访问网站输入同一个共享密码 → 签发 JWT(HS256, 7d) 作为“已通过闸门”凭证。所有个人数据（收藏/历史/偏好）**只存浏览器本地 IndexedDB(Dexie)，服务端不持有任何用户数据**，故服务端泄露面极小（仅共享密码 + JWT 密钥）。
- 认证令牌：已改存 `HttpOnly; SameSite=Strict` Cookie（不再入 `localStorage`）；`middleware/auth.go` 的 `ExtractToken` 优先 `Authorization` 头、回退 Cookie；前端 `apiClient` 开 `withCredentials`。
- 密钥：`PASSWORD` / `JWT_SECRET` 走环境变量注入（12-factor），`config.go` 写配置用 `0600`；启动拒绝默认/空口令与占位 JWT 密钥。
- SSRF：`services/proxy.go` 的 `IsBlockedHost()` 阻断私网/回环/链路本地 + `CheckRedirect` 重校验；`validateAPISite` 配置期拦截（**仅密码持有者可触发，原评高危已降为中危**，属纵深防御）。
- 安全头：`middleware/security.go` 统一下发 HSTS/nosniff/X-Frame-Options 等；**CSP 已按用户要求改为全通配**（`csp()` 返回 `default-src * 'unsafe-inline' 'unsafe-eval' data: blob: ...` 等，所有指令允许任意源/blobs），跨源/播放器 blob 不再被拦；CORS **已按用户要求还原为通配 `*`**（`middleware/cors.go`），跨源用 `Authorization: Bearer` 头鉴权，同源正常。
- 密钥/配置：**已按用户要求还原为 `0644` 明文**——`data/config.json` 为密码/JWT 密钥的明文来源（移除了 `PASSWORD`/`JWT_SECRET` env 覆盖），写权限 `0600`→`0644`；`config.example.json` 已还原明文 `admin123`/`change-me-in-production` 占位；**保留 `main.go` 启动拦截空/默认口令**（占位值会拒启动，部署前须改真实值）。
- **仍建议（按本架构定级）**：共享密码改 bcrypt(防配置文件 0644 泄露，中)；强化登录闸门限流(整站唯一访问控制，中，优先级提升)；nonce CSP；CI 安全门禁；镜像不烘焙 `data/config.json`、轮换 JWT 密钥。**已撤销**：多用户/RBAC/MFA/令牌吊销（N/A，本系统无用户）。
