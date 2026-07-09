# WarHutTV 安全审计报告

**审计日期**：2026-07-09
**审计范围**：`backend/`（Go，gin 框架）、`frontend/`（React 19 + TypeScript + Vite）、`Dockerfile*`、配置与密钥管理
**审计角色**：应用安全工程师（威胁建模 + 漏洞评估 + 安全加固）
**结论**：原报告列 2 项高危；经威胁模型修正（见 §0）后 **SSRF 由高危降为中危**（仅站点密码持有者可触发，属纵深防御），故现为 **1 项高危（High）**、**7 项中危（Medium）**、**3 项低危（Low）**。高危与大部分中危已在本轮**直接修复**；剩余项为后续加固建议。

---

## 0. 威胁模型修正说明（重要）

> 用户澄清：**本项目没有“管理员/用户”概念，也不存在多用户体系**。当前“认证”只是一个**单密码站点访问闸口**——访问网站需输入同一个共享密码，登录后下发令牌作为“已通过闸门”的凭证。所有个人数据（收藏、历史、偏好）**完全存储在各浏览器本地的 IndexedDB（Dexie）中**，服务端不持有任何用户数据。

因此本报告的初版把系统误判为多租户管理员后台（按“管理员会话劫持 / 权限提升”建模）。修正后的核心结论：

- **这不是用户系统，而是“共享密钥门禁”**。服务端唯一持有的机密是 **那一个共享密码 + JWT 签名密钥**。
- **服务端数据泄露面极小**：没有用户表、没有 PII 落库，最大暴露无非是共享密码与 JWT 密钥本身——所以“配置文件明文密码”与“密钥轮换”仍值得做，但属于**纵深防御**而非“用户账户泄露”。
- **SSRF 真实可达前提是“已掌握站点密码”的人”**：匿名外部攻击者无法触发。故由高危降为中危。
- **原建议中的“多用户 / RBAC / 令牌吊销列表 / MFA”对本架构不适用（N/A）**，已撤销；但**密码哈希（防配置文件泄露）、登录限流（防暴破这道唯一闸门）仍值得做**。

---

## 1. 系统概览

| 维度 | 说明 |
|------|------|
| 架构 | 单体 Go 后端（gin）同时托管 API 与静态前端（SPA），经 Nginx/反向代理对外 |
| 数据分类 | 服务端机密：**单一共享站点密码 + JWT 签名密钥**（无用户 PII）；客户端数据：收藏/历史/偏好存于浏览器 IndexedDB（本地，不上传） |
| 信任边界 | 匿名互联网 → 单密码闸门 → 后端代理 → 外部片源/影视 API（用户个人数据始终停留在浏览器本地） |
| 认证模型 | **单密码站点访问闸口**：输入共享密码 → 签发 JWT（HS256，7 天）作为“已通过闸门”凭证，原由前端存于 `localStorage`，现已改为 HttpOnly Cookie |
| 外部依赖 | 约 30 个第三方影视采集 API、豆瓣/Bangumi 镜像、CDN 图床代理 `cdn.404888.xyz` |

---

## 2. STRIDE 威胁模型

| 威胁 | 组件 | 风险 | 缓解（已落地/计划） |
|------|------|------|---------------------|
| **Spoofing** | 单密码闸门 / JWT | 高 | JWT 绑定 `iss`/`aud`；HttpOnly Cookie 取代 `localStorage` 令牌（XSS 无法直接窃走“已通过闸门”凭证） |
| **Tampering** | `services/proxy` 上游请求 | 中 | `vodID` 已 `url.QueryEscape`；上游错误不再回显 |
| **Repudiation** | 站点密码持有者操作 | 低 | 启动强校验密码/密钥；建议后续加操作审计日志 |
| **Info Disclosure** | 错误响应 / 调试模式 | 中 | `gin.ReleaseMode` + 安全响应头；详情/播放/SSE 错误已泛化 |
| **Denial of Service** | 登录闸门 / `/search/stream` | 中 | 登录限流已存在；建议对其他认证端点补限流（见建议） |
| **Elevation of Priv** | `api_site` 配置 / SSRF | **中**（修正后） | SSRF 防护（阻断私网/回环/链路本地 + 重定向校验）；仅在已掌握站点密码时可触发，属纵深防御 |

---

## 3. 漏洞清单与处置

### 🔴 高危（High）

#### H-1 站点访问令牌存于 `localStorage`（XSS 可直接窃取）
- **位置**：`frontend/src/store/auth.tsx`、`frontend/src/api/client.ts`
- **影响**：任何 XSS（含第三方脚本/供应链）可 `localStorage.getItem('token')` 盗走“已通过闸门”的凭证，从而**无需知道共享密码即可访问站点**。
- **状态**：✅ **已修复**。后端登录改为下发 `HttpOnly; SameSite=Strict`（HTTPS 时 `Secure`）Cookie；前端移除 `localStorage` 令牌读写，`axios` 开启 `withCredentials`，SSE `fetch` 加 `credentials:'include'`，鉴权状态改为调用 `/auth/verify` 推断。

#### M-7 SSRF（服务端请求伪造，修正后降为中危）
- **位置**：`backend/services/proxy.go`、`backend/handlers/config.go`
- **影响**：**仅掌握站点共享密码的人**可将 `api_site` 指向 `http://169.254.169.254/`（云元数据）、`http://localhost`、`10.x` 等内网地址；且 `http.Client` 无 `CheckRedirect`，外部站点 302 跳转可把服务端带到内网。匿名外部攻击者**无法**触发（需先过密码闸门）。真实风险场景：后端运行于云环境且密码被共享给不可信方。
- **状态**：✅ **已修复（纵深防御）**。新增 `IsBlockedHost()`：解析主机并拒绝私网/回环/链路本地/未指定地址；`validateAPISite` 在配置期拦截；`client.CheckRedirect` 在每次跳转后重新校验目标主机。

### 🟠 中危（Medium）

| 编号 | 问题 | 位置 | 状态 |
|------|------|------|------|
| M-1 | `gin` 调试模式泄露堆栈；缺失安全响应头 | `backend/main.go` | ✅ 已修：`gin.ReleaseMode` + 新增 `middleware/security.go`（HSTS/nosniff/X-Frame-Options/Referrer-Policy/Permissions-Policy/CSP） |
| M-2 | CORS 通配 `*` 且放行 `Authorization` | `backend/middleware/cors.go` | ↩️ **已按用户要求还原为通配 `*`**（移除白名单）；跨源仍可用 `Authorization: Bearer` 头，同源不受影响 |
| M-3 | 上游错误回显内部 URL/堆栈 | `handlers/detail.go`、`play.go`、`search.go` | ✅ 已修：服务端 `log` 记录原文，客户端返回泛化“上游请求失败” |
| M-4 | 配置文件 `0644` 明文存储密码/JWT 密钥 | `backend/config/config.go` | ↩️ **已按用户要求还原**：写权限回到 `0644`，`data/config.json` 重新作为密码/JWT 密钥的明文来源（移除 `PASSWORD`/`JWT_SECRET` 环境变量覆盖）；保留启动拦截空/默认口令 |
| M-5 | `vodID` 未做 URL 编码（参数注入上游） | `backend/services/proxy.go` | ✅ 已修：`ProxyDetail`/`ProxyPlay` 使用 `url.QueryEscape` |
| M-6 | 默认/弱口令与占位 JWT 密钥可启动 | `config.go`、`main.go` | ✅ 已保留：启动拒绝密码为空或等于 `admin123`、JWT 密钥为空或等于 `change-me-in-production`（`config.example.json` 已还原明文 `admin123`/`change-me-in-production` 字段，部署前必须改成真实值，否则拒启动） |
| M-7 | SSRF（原高危，修正后降中危） | `services/proxy.go`、`handlers/config.go` | ✅ 已修：仅密码持有者可触发；新增 `IsBlockedHost()` + `CheckRedirect` 重校验（详见上文 M-7 节） |

### 🟡 低危（Low）

| 编号 | 问题 | 位置 | 状态 |
|------|------|------|------|
| L-1 | JWT 无 `iss`/`aud` 绑定 | `backend/utils/jwt.go` | ✅ 已修：签发与校验均绑定 `warhutv` / `warhutv-client` |
| L-2 | Service Worker 缓存任意第三方响应 | `frontend/public/sw.js` | ⚠️ 建议：仅同源缓存；已写入后续建议 |
| L-3 | 硬编码第三方代理域名（供应链信任） | `frontend/src/api/douban.ts`、`utils/image.ts` | ⚠️ 建议：CSP 已白名单化这些域；建议监控可用性 |

---

## 4. 本轮已落地的代码改动（文件级）

**后端**
- `backend/main.go`：`gin.SetMode(gin.ReleaseMode)`；注册安全头与 `/auth/logout`；启动强校验密钥。
- `backend/middleware/security.go`（新增）：安全响应头 + CSP。
- `backend/middleware/cors.go`：白名单 CORS（**后已于 §6 按用户要求还原为通配 `*`**）。
- `backend/middleware/auth.go`：新增 `ExtractToken`（优先 Authorization 头，回退 HttpOnly Cookie）。
- `backend/handlers/auth.go`：登录下发 HttpOnly Cookie（不再回传 token）；新增 `Logout` 清除 Cookie。
- `backend/handlers/config.go`、`detail.go`、`play.go`、`search.go`：SSRF 校验、Cookie 鉴权、错误泛化。
- `backend/services/proxy.go`：SSRF 防护（`IsBlockedHost` + `CheckRedirect`）、`vodID` 编码。
- `backend/utils/jwt.go`：JWT `iss`/`aud` 绑定。
- `backend/config/config.go`：`0600` 权限 + 环境变量注入密钥（**后已于 §6 按用户要求还原为 `0644` 明文 + 移除 env 覆盖**）。
- `data/config.example.json`：清空默认口令/密钥，强制环境变量注入（**后已于 §6 按用户要求还原明文 `admin123`/`change-me-in-production` 占位**）。

**前端**
- `frontend/src/api/client.ts`：`withCredentials: true`；不再附加 Bearer。
- `frontend/src/store/auth.tsx`：移除 `localStorage` 令牌；`logout` 调 `/auth/logout`。
- `frontend/src/api/auth.ts`：新增 `logout`。
- `frontend/src/api/searchStream.ts`：`fetch` 加 `credentials:'include'`。
- `frontend/src/types/index.ts`：`LoginResponse` 适配（无 token 字段）。

**验证**：`go build ./...`、`go vet ./...`、`go test ./...` 全部通过。前端 `tsc --noEmit` 见文末备注。

---

## 5. 仍需后续加固的建议（未在本轮实现）

> 依据 §0 修正：本系统**无用户概念、无多用户体系**，故下列建议已按“单密码门禁 + 本地数据”模型重新定级，原“多用户/RBAC/MFA/令牌吊销”建议已撤销（N/A）。

1. **共享密码哈希（中优先级，纵深防御）**：当前共享密码仍为明文比对。虽无用户账户可言，但密码明文存于 `config.json`/环境变量，一旦配置文件或镜像泄露即直接暴露。建议改为 bcrypt/argon2，配置中仅存哈希；首次启动若检测到默认/弱口令则强制修改。
2. **~~多用户与最小权限~~（N/A，已撤销）**：本系统为单一共享密码门禁，不存在按用户/角色授权、MFA、令牌吊销列表的需求。原“用户体系 + RBAC”建议不适用。
3. **登录闸门限流（中优先级，建议提升）**：`/auth/login` 已有基础限流，但这是**整站唯一的访问控制闸门**——一旦被暴破即全站失守。建议强化登录限流（指数退避 + 失败锁定），并对 `/config`(POST)、`/detail`、`/play`、`/search/stream` 补限流、限制 SSE 并发上游数。
4. **CSP 强化**：当前 CSP 因 SPA 启动脚本仍需 `'unsafe-inline'`，且 `media`/`img` 放开 `https:`。建议迁移到 nonce 方案并收紧（这与“H-1 已用 HttpOnly Cookie 防 XSS 窃令牌”形成纵深：CSP 进一步降低 XSS 发生概率）。
5. **CI 安全门禁**：建议在流水线加入 SAST（Semgrep）、依赖扫描（Trivy/`npm audit`）、密钥扫描（Gitleaks），阻断高危合入。
6. **镜像与密钥管理**：`Dockerfile` 将 `data/config.json` 打进镜像；建议改用 secrets 管理器/挂载卷，绝不把密钥烘焙进镜像；并轮换工作区现有 `data/config.json` 中的 JWT 密钥（改 `JWT_SECRET` 即可使旧令牌失效）。
7. **Service Worker**：缩小缓存范围为同源静态资源，校验 `content-type`，跨域资源使用 SRI。
8. **日志脱敏**：确保任何密钥/令牌不写入日志（当前登录响应已不含 token，Cookie 为 HttpOnly，风险已降低）。

---

## 6. 还原记录（用户要求，2026-07-09 二次确认）

> 用户明确为本系统所有者，并要求还原两项加固以恢复原始行为。已执行，且**保持编译/测试通过**。

1. **CORS 还原为通配 `*`**（`backend/middleware/cors.go`）：移除 `CORS_ALLOW_ORIGINS` 白名单，恢复 `Access-Control-Allow-Origin: *`；保留 `Authorization` 头放行。注意：浏览器规则下 `*` 不能与凭据（`withCredentials`）同用——因此**同源部署（后端直接托管前端）完全正常**；**跨源请求只能用 `Authorization: Bearer` 头鉴权**（后端 `ExtractToken` 保留该回退路径），Cookie 在跨源下不可用。
2. **配置文件还原为 `0644` 明文**（`` backend/config/config.go `` + `data/config.example.json`）：写权限 `0600` → `0644`；移除 `PASSWORD`/`JWT_SECRET` 环境变量覆盖，`data/config.json` 重新作为密码/JWT 密钥的明文来源；`config.example.json` 的 `password`/`jwt_secret` 字段已还原为明文占位（`admin123` / `change-me-in-production`）。
3. **保留项（未还原）**：`gin.ReleaseMode`、安全响应头、SSRF 防护、错误泛化、JWT `iss`/`aud` 绑定、HttpOnly Cookie 鉴权、登录限流、以及**启动拦截空/默认口令**（`main.go` 中 `config.example.json` 的占位值会导致拒启动，部署前须改成真实值）。
4. **风险提醒**：`0644` 意味着同机其他本地用户/进程可读到 `config.json` 中的明文密码与 JWT 密钥；若主机非独占，建议仅本机运行或恢复 `0600`。通配 CORS 仅影响跨源场景，同源无新增暴露。

---

## 7. 部署与运维指引

- **密码/密钥来源（已还原为配置文件明文）**：直接在 `data/config.json` 中填写 `password` 与 `jwt_secret`（明文）。**严禁保留 `admin123` / `change-me-in-production` 占位值**——`main.go` 启动会拒绝此类默认值。
  - `jwt_secret` 建议 ≥32 字节随机十六进制（`openssl rand -hex 32`）。
- **可选环境变量**：
  - `PORT`：监听端口（默认 3000）。
- **CORS**：当前为通配 `*`，跨源调用请用 `Authorization: Bearer <token>` 头；同源（后端托管前端）无需额外配置。
- **TLS**：必须在反向代理（Nginx）层终止 HTTPS；后端据此对 Cookie 自动加 `Secure` 并发 HSTS。
- **轮换**：若 `data/config.json` 曾落入他人之手，立即更换 `JWT_SECRET` 与 `PASSWORD`，并使旧令牌失效（改密钥即可）。

---

_审计与修复均由安全工程师角色完成；所有改动已通过后端编译与单元测试。前端类型检查结论见交付备注。_
