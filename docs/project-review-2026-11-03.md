# WarHutTV 项目审查报告

> 审查基线：`master` @ `1e144d2`（version `1.3.1`）
> 审查时间：2026-11-03
> 审查范围：`backend/`（全部 Go 源码）、`frontend/src/`（全部 TS/TSX）、构建与部署链（Makefile / build.sh / build.ps1 / Dockerfile* / CI / README / .env.example）
> 方法：逐文件静态审查 + 本地实际执行（lint / 单测 / 类型检查 / 生产构建 / `go vet` / `go test` / 启动后端做接口探测）+ 构建脚本行为实验
> 说明：仓库工作区存在少量未提交改动（`frontend/src/components/VideoCard.tsx` 增加 `title` 属性），本文按当前工作区内容审查；`.pi/`、`.workbuddy/` 的既有删除与本次审查无关。

> **更新（2026-11-05）：本报告列出的 4 个 P0、16 个 P1、16 个 P2 已全部修复。** 各条标题后的 ✅ 表示已完成，
> 逐项修复说明见 [第十节「修复说明书」](#十修复说明书2026-11-05-落地记录)；第二节与第五节的表格保留的是**审查当时**的
> 原始证据，用于回溯问题成因，不代表当前状态。

---

## 一、结论速览

| 级别 | 数量 | 含义 |
|---|---|---|
| 🔴 P0 | 4 | 阻断发布/部署/CI，或存在可被利用的认证风险，必须立即处理 |
| 🟠 P1 | 16 | 功能不正确、静默失败、安全加固缺失，应在下个迭代内解决 |
| 🟡 P2 | 16 | 可维护性、健壮性、体验与工程规范问题 |
| 🔵 P3 | 若干 | 架构演进与长期改进建议（按主题归并） |

**总体评价：** 代码主体质量高于仓库内既有审查文档（`docs/fix-plan.md`、`docs/code-review-*.md`，均为审查当时的文档，现已按 10.9 删除）描述的水平——JWT 算法断言、常量时间密码比较、SSRF 配置校验、上游响应体限流、HttpOnly + SameSite Cookie、播放页 reducer 化与子 Hook 拆分等都已落地，前端 74 个单测与后端 4 个测试包全部通过，类型检查与生产构建也通过。

**但"文档承诺的交付路径"整体是断的：** README 里的一键 Docker、`make build`、`cd backend && go run .` 三条入口在当前仓库状态下都会失败；CI 因 1 条 ESLint error 必然红；被 git 跟踪的 `backend/data/config.json` 里还有一个"公开的 JWT 签名密钥"。这四件事合起来，决定了当前版本**无法按文档交付给任何人**，应作为第一优先级。

### 主要亮点（无需改动）

- 鉴权基线正确：`HttpOnly + SameSite=Strict` Cookie（`backend/handlers/auth.go:20-24`）、拒绝非 HMAC 算法（`backend/utils/jwt.go:35-41`）、`subtle.ConstantTimeCompare`（`auth.go:39`）、token 不再进 URL。
- 上游访问有边界：SSRF 黑名单（`services/proxy.go:179-199`）+ 保存配置时校验（`handlers/config.go:49-63`）+ `ReadLimited` 限制响应体（`proxy.go:163-174`）。
- 播放链路的关键正确性有测试托底：续播落点、换源排序、进度节流、reducer 行为均有单测（`frontend/src/pages/play/*.test.ts`）。
- 前端工程化基础扎实：路由级 code splitting、`memo`/`useMemo` 使用克制、`useFocusTrap`（键盘可达性）、`ErrorBoundary`、构建体积预算门禁（`ci.yml:54-79`）。
- 已有一套代码审查文档体系（`docs/code-review-guide.md` 等），说明团队有质量意识；本文只补充"当前实现与文档不一致"的部分。

---

## 二、验证记录（可复现）

| # | 命令 | 结果 |
|---|---|---|
| 1 | `cd frontend && pnpm run lint` | ❌ **33 problems (1 error, 32 warnings)**，exit 1 |
| 2 | `cd frontend && pnpm test` | ✅ 11 files / 74 tests passed |
| 3 | `cd frontend && pnpm exec tsc -b` | ✅ 无类型错误 |
| 4 | `cd frontend && pnpm run build` | ✅ 构建成功（421ms），最大 chunk `player` 193.5 KB gzip，在预算内 |
| 5 | `cd backend && go vet ./...` | ✅ 通过 |
| 6 | `cd backend && go test ./...` | ✅ config / handlers / services / utils 四包通过 |
| 7 | `cd backend && gofmt -l .` | ❌ 列出 `handlers/search.go`（未格式化，CI 无此门禁） |
| 8 | `cd backend && go run .`（按 README:156） | ❌ `refusing to start: admin password is empty or equals the insecure default`，exit 1 |
| 9 | `git ls-files data backend/data` | ⚠️ 只跟踪了 `data/config.example.json` 与 **`backend/data/config.json`**（含 `admin123` + 固定 secret） |
| 10 | bash 实验：`cp -r src dst/dst2`（父目录不存在） | ❌ `cp: cannot create directory 'dst/dst2': No such file or directory`，exit 1 |
| 11 | 启动二进制 + 接口探测（见下表） | 见下 |

接口探测（本地 3123 端口，隔离临时目录 + 独立 config）：

| 请求 | 实际结果 | 期望 |
|---|---|---|
| `GET /api/version` | `200 {"version":""}` | 应返回 `1.3.1`（镜像内缺 `version` 文件） |
| `GET /api/nonexistent` | `200` + **index.html** | `404` JSON |
| `GET /api/search?site=x&wd=test` | `200` + **index.html** | 该路由不存在，应 404 |
| `GET /api/search/stream?wd=test`（无 token） | `200 text/event-stream` + `event: start` / `event: done` | 正常（0 个源时也不报错，见 P1-12） |
| `GET /api/detail` / `/api/bangumi/calendar`（无 token） | `401 {"error":"未提供认证令牌"}` | 正常 |
| `POST /api/auth/login`（正确密码） | `200 {"message":"登录成功"}` + HttpOnly Cookie | 正常 |
| `POST /api/config`（`api_site` 指向 `127.0.0.1`） | `400 ... 已被 SSRF 防护拦截` | 正常 |

**证据等级说明（审查当时）：** 表格中 ✅ 表示已在本机实际执行验证；🔍 为代码静态确认（逻辑链完整、可推导）；⚠️ 为高置信推断（受环境限制未直接运行，例如本机无 Docker）。

> **注意区分两处 ✅：** 章节标题末尾的 ✅ 是**修复状态标记**（2026-11-05 完成后追加），本节表格内的 ✅ 才是**证据等级**。

---

## 三、P0 —— 必须立即修复

### P0-1 官方 Docker 部署链路整体不可用 ✅

**位置：** `README.md:194-230`、`Dockerfile:21`、`Dockerfile.release:8`、`backend/main.go:21-26`、`backend/config/config.go`

**现象（四个独立缺陷叠加）：**

1. **环境变量根本没有实现。** `README.md:238-246` 声明"环境变量 > `data/config.json`"，`README.md:203-204` 让用户传 `-e PASSWORD/-e JWT_SECRET`，`.env.example` 也列了这两个变量；但全仓库只有 `os.Getenv("PORT")`（`backend/main.go:28`），`PASSWORD` / `JWT_SECRET` **从未被读取**。
2. **发布镜像内置了会被拒绝启动的配置。** `Dockerfile.release:8` 把 `data/config.example.json`（`password: "admin123"`）复制为 `/data/config.json`，而 `main.go:21-26` 遇到默认密码直接 `log.Fatal`。scratch 镜像里没有 shell，用户无法进容器修改 → **镜像拉到就跑不起来**。
3. **数据卷挂载路径错误。** scratch 镜像的 CWD 是 `/`，程序读相对路径 `data/config.json` → `/data/config.json`；README 和 Compose 都把卷挂到 `/root/data`（`README.md:205,228`），用户放进去的配置永远不会被读到。
4. **本地 `docker build` 必然失败，且会把运维密钥打进镜像层。** `Dockerfile:21` 执行 `COPY data/config.json /data/config.json`，但 `data/*` 被 `.gitignore` 排除（只保留 `config.example.json`），**全新克隆下该文件不存在 → `COPY` 直接失败**；反过来，如果开发者本地有这个文件，它连同真实密码会被永久烙进镜像层。

**影响：** README 主推的部署方式（预构建镜像 / 本地构建 / Compose 三种）全部不可用；若强行修复路径，镜像内仍是明文密码。这属于"发布即可用"级别的阻断问题。

**修复建议：**

- 在 `config.Load` 中实现环境变量覆盖，并明确优先级：`PASSWORD` > `JWT_SECRET` > `SITE_NAME` > `data/config.json`；或引入 `WARHUTV_DATA_DIR`（默认 `./data`）统一路径。
- 镜像不再内置可运行配置：只放 `config.example.json` 到 `/data/config.example.json`，首次启动由程序生成 `jwt_secret`；若 `PASSWORD` 未设置则打印明确指引并退出（而不是让用户面对 `admin123` 报错）。
- 统一数据目录为 `/data`，README 改为 `-v ./data:/data`；Compose 同步。
- `Dockerfile` 不要 `COPY data/config.json`，改 `COPY data/config.example.json`（或 `RUN mkdir -p /data`）。
- 镜像 `COPY version /version`，或用 `-ldflags "-X main.version=$(cat version)"` 注入，保证 `/api/version` 有值。
- 运行身份：改用 `alpine:3.20` + 非 root 用户（`USER 10001`），并配 `HEALTHCHECK`（可加 `warhutv -healthcheck` 子命令，或用 busybox wget）。
- 提示用户已泄露的 `jwt_secret` 需要轮换（见 P0-4）。

**验收：** 全新克隆后

```bash
docker build -t warhutv . && docker run -d -p 3000:3000 -e PASSWORD=xxx warhutv
```

可启动、可登录；`docker run -e JWT_SECRET` 生效；`docker exec` 查不到明文密码；`GET /api/version` 返回版本号；卷挂载路径与文档一致。

---

### P0-2 `make build` 与 `build.sh` 在干净检出下必然失败 ✅

**位置：** `Makefile:7`、`build.sh:33`

```make
build-backend:
	cd backend && cp -r ../frontend/dist frontend/dist && go build ...
```

**根因：** 目标目录的父目录 `backend/frontend` 不存在时，`cp -r src dst/dst2` 不会自动创建中间目录。已用 bash 实测复现：

```
$ cp -r src dst/dst2
cp: cannot create directory 'dst/dst2': No such file or directory   # exit 1
```

**旁证：** CI 里同样的步骤是先 `mkdir -p frontend/dist` 再 `cp`（`.github/workflows/ci.yml:90-93`），说明这条路径只在 CI 里被修过；`build.ps1:36` 用 `Copy-Item` 恰好会自动创建父目录（PowerShell 行为不同），所以 Windows 构建"看起来正常"，进一步掩盖了问题。

**影响：** README:167-168 的 `make build` / `make run`，以及 README:175 的 `./build.sh`，在 CI 之外的新环境（含 macOS/Linux 新用户）直接失败；只有 Windows 的 `build.ps1` 可用。

**修复：** 三条构建链（`Makefile:build-backend`、`build.sh`、CI/release workflow）统一为"先建父目录、再清目标目录、最后拷入"：

```bash
mkdir -p backend/frontend        # 注意：不是 backend/frontend/dist
rm -rf backend/frontend/dist
cp -r ../frontend/dist backend/frontend/dist
...
rm -rf backend/frontend          # 构建后清理临时目录（已加 .gitignore）
```

> 修复过程中发现 CI 原有的 `mkdir -p frontend/dist` + `cp -r ../frontend/dist frontend/dist`
> 其实产生了 `frontend/dist/dist/`（已用 bash 实测确认），`go:embed frontend/dist/*` 因此不含
> `index.html`；只是因为当时 CI 只 build 不运行，才一直没暴露。本次一并修正。

更彻底的做法是统一为单一构建入口（例如 `scripts/build.sh` + `taskfile`），并让 `go:embed` 指向固定目录，从根上消除"把 dist 拷进 backend 再删掉"的临时目录模式。

**验收：** `git clean -xdf && make build` 成功产出 `bin/warhutv`；`./build.sh` 同样成功。✅ 已用 bash 复现该 `mkdir`+`cp` 片段，产物为 `frontend/dist/index.html`（不再嵌套）。

---

### P0-3 CI 当前必然失败（ESLint 1 error）✅

**位置：** `frontend/src/pages/play/usePlayController.ts:79`；触发点 `.github/workflows/ci.yml:42-44`

**现象：** `pnpm run lint` 报 `react-hooks/refs` **error**（其余 32 条为 warning）：

```ts
const deps: PlayControllerDeps = { ... };   // 每次渲染新建的对象
...
deps.progressFlush = flush;                 // ← 渲染期间修改对象/读取 ref
```

**影响：** CI 的 `Lint Frontend` 步骤 exit 1 → 所有 PR 无法合并；同时这确实是真实反模式（渲染阶段产生副作用，且 `deps` 每帧重建让"注入"语义不可靠）。

**修复（推荐 ref 注入，避免循环依赖）：**

```ts
// playContext.ts
progressFlushRef: MutableRefObject<(() => Promise<void>) | null>;

// usePlayController.ts
const progressFlushRef = useRef<(() => Promise<void>) | null>(null);
// deps 中带上 progressFlushRef
const { tick, flush, clearInvalidHistory } = usePlaybackProgress(deps);
useEffect(() => { progressFlushRef.current = flush; }, [flush]);

// useSourceSwitch.ts
await deps.progressFlushRef.current?.();
```

**验收：** `pnpm run lint` 0 error；CI 绿；补一条针对"换源前落盘"的单测（现有 `useSourceSwitch.test.ts` 可扩展）。

---

### P0-4 被跟踪的 `backend/data/config.json` 泄露固定 JWT 密钥 + 导致开发启动失败 ✅

**位置：** `backend/data/config.json:3-5`（由提交 `4626c1d` 引入，仍被 git 跟踪）

```json
"password": "admin123",
"jwt_secret": "d298f50f5f3dde0e5463b28db588a6ccf03aab793739327718336c59a5550dff",
```

**现象与影响：**

1. **开发流程失败（已复现）。** README:156 的 `cd backend && go run .` 会读取**当前目录**下的 `backend/data/config.json`，其密码是默认值，`main.go:21-22` 直接 `log.Fatal`。也就是说 README 的"快速开始"第一步就卡住，且 README:152 让人去改**仓库根目录**的 `data/config.json`——改了也没用（`go run` 不读它）。`make run` 同样失败。
2. **认证绕过风险。** `main.go:24` 只拒绝 `jwt_secret == "change-me-in-production"`；这个已提交的 secret 不触发检查。若任何部署沿用该文件、只改 `password` 而不改 `jwt_secret`，**任何人用公开的 secret 签发 HS256 token 即可通过 `AuthMiddleware`**，直接调用 `/api/detail`、`/api/config`（POST）等受保护接口 → 完整认证绕过。
3. 该 secret 已存在于 git 历史中，即使现在删除也需视为已泄露。

**修复：**

- `git rm --cached backend/data/config.json`，在 `.gitignore` 增加 `backend/data/`。
- 统一配置路径：给后端加 `-config` flag / `WARHUTV_CONFIG` 环境变量，默认 `./data/config.json`；开发模式下 README 直接说明"从仓库根运行 `go run ./backend`"或在 backend 下创建本地配置（已被忽略）。
- 删除该文件后，首次启动将生成随机 secret（`config.go:84-91` 已有该逻辑），请把"轮换已泄露的 `d298...`"写进发布说明。
- 建议同时把 `jwt_secret` 长度/熵校验前移（例如 <32 字节直接拒绝启动）。

**验收：** `git ls-files | grep -i config.json` 只剩 `data/config.example.json`；干净克隆后按 README 开发流程可启动；仓库与历史说明中不再出现可用密钥。

---

## 四、P1 —— 功能不正确 / 静默失败 / 安全加固

### P1-1 未知 `/api/*` 被 SPA fallback 吞成 200 HTML，测速页因此全部误报"可用" ✅

**位置：** `backend/static_common.go:16-32`、`frontend/src/pages/SpeedTest.tsx:160-171`

**现象：** 实测 `GET /api/nonexistent` 与 `GET /api/search?...` 都返回 `200` + `index.html`。因为 `NoRoute` 对所有未匹配路径都 `serveIndex`，包括 `/api/` 前缀。

**连锁后果：** 测速页调用的是 **不存在的 `GET /api/search`**（后端只有 `/api/search/stream`），拿到 200 HTML 后被 axios 视为成功，于是每个源都显示"可用"，并计算 `Math.round(10000 / time)`——这个"速度"实际是下载 HTML 的耗时，毫无意义。用户会被引导去选择并不存在的"最快源"。

**修复：**

```go
r.NoRoute(func(c *gin.Context) {
    if strings.HasPrefix(c.Request.URL.Path, "/api/") {
        c.JSON(http.StatusNotFound, gin.H{"error": "接口不存在"})
        return
    }
    // ... 现有静态资源/SPA fallback 逻辑
})
```

测速页改为调用真实存在的接口（推荐新增 `GET /api/sites/ping?site=key`，由后端请求上游 `?ac=list&pg=1` 并返回耗时/条数），或复用 SSE 搜索的首包时间；同时区分"超时 / 404 / 源不可用"三种错误文案。

**验收：** `curl /api/nonexistent` 返回 404 JSON；测速页对不可用源显示"不可用"而非"可用"，且不出现虚构速度值。

---

### P1-2 SSE 搜索缓存与超时处理存在正确性缺陷 ✅
**位置：** `backend/handlers/search.go:64-97`、`202-224`

三个问题：

1. **超时也写缓存。** 20s 超时后仍执行 `AppCache.Set(cacheKey, results, 2*time.Hour)`（`search.go:224`），此时 `results` 只含已完成的源。之后 2 小时内同一关键词的搜索**永远看不到超时源的结果**，用户会以为"该源没资源"。
2. **缓存键不含源集合。** key 只有 `search:keyword:pg`。管理员增删/修改 `api_site` 后，旧缓存继续命中 2 小时；跨源聚合结果与当前配置不一致。
3. **数据竞争。** 超时分支返回后，其他 goroutine 仍可能 `results = append(results, ...)`（持 `mu`），而主流程在**未持锁**的情况下把 `results` 传给 `AppCache.Set`（内部 `json.Marshal`）→ 对同一 slice 的并发读/写，属于数据竞争（`go test -race` 可检出）。此外超时后 goroutine 继续向可能已关闭的连接 `sendSSE`。

**修复：**

- 只在**全部源完成（`<-done`）**时写缓存；超时分支不缓存，或缓存时标记 `partial: true` 并缩短 TTL（如 2 分钟）。
- 缓存键加入配置指纹：`search:{cfgHash}:{keyword}:{pg}`，`cfgHash` 由 `api_site` 的稳定序列化计算；配置更新时主动 `Clear` 相关键。
- 在持锁状态下复制快照：

```go
mu.Lock()
snapshot := append([]siteResult(nil), results...)
finalCompleted := completed
mu.Unlock()
```

- 把 `timedCtx` 传给上游请求（见 P1-7），并给 `sendSSE` 加 `select` 保护（已有 `clientGone` 检查，但仍需避免在 `done` 之后写事件）。

**验收：** 构造慢源（HTTP 服务延迟 25s）→ 客户端 20s 收到 timeout + done；再次搜索时慢源被重新查询（未缓存部分结果）；`go test -race` 覆盖并发路径。

---

### P1-3 上游 API 用法不当：搜索用 `ac=detail`、播放用非标准 `ac=play` ✅
**位置：** `backend/services/proxy.go:84`、`104`

- 搜索：`fmt.Sprintf("%s?ac=detail&wd=%s&pg=%d", ...)`。`ac=detail` 会返回每个条目的完整详情（含播放地址、简介），体积与延迟远高于 `ac=videolist`；多源并发搜索时这是首屏延迟的主要来源。
- 播放：`%s?ac=play&ids=...`。主流 MacCMS（苹果 CMS）接口并没有 `ac=play` 这个动作，通常会返回错误或空列表；`handlers/play.go` 因此基本永远返回 502。前端只在 `ep.url` 为空时才调用 `/api/play`（`useEpisodeNav.ts:35-42`），所以问题被隐藏了，但该接口实际不可用。
- `useEpisodeNav.ts:36` 还传了 `episode` 参数，后端 `handlers/play.go:12-25` 完全忽略它，仍然按 `ids` 查——即使接口能用，也会播放错的集。

**修复：** 搜索改 `ac=videolist`（若源不支持则回退 `ac=detail` 并限制 `pagesize`）；播放改为 `ac=detail&ids=<vod_id>` 后在服务端解析 `vod_play_url` 取对应集，或直接删除 `/api/play` 与前端分支（前端本身已有完整剧集 URL）。补一个针对真实 MacCMS 响应格式的契约测试。

**验收：** 搜索首包时间下降；任一源的剧集都能播放；`/api/play` 要么返回正确集，要么被移除。

---

### P1-4 静态资源白名单缺图片扩展名，缺失文件永远返回 200 HTML ✅

**位置：** `backend/static_common.go:44-46`

`isStaticAssetPath` 只认 `.js/.css/.svg/.json/.ico/.png/.woff2/.woff`，**不含 `.jpg/.jpeg/.webp/.gif/.mp4/.vtt`**。而前端多处引用 `/placeholder.jpg`（`VideoInfo.tsx:32`、`VideoCard.tsx` 兜底），该文件在 `frontend/public` 中**根本不存在**。于是：

- 缺失海报 → 请求 `/placeholder.jpg` → 不匹配白名单 → fallback 到 `index.html`，返回 `200 text/html` 给 `<img>` → 控制台报解码失败，无法降级。
- 任何缺失的静态文件都返回 200 HTML（对 `<script src>` 同样致命：会得到 HTML 而不是 404，导致难以诊断的语法错误）。

**修复：** 用统一扩展名集合（或反向判断"不含扩展名且非 `/api` 才走 SPA"）；缺失静态文件返回 404；补一个真实占位图（或用内联 SVG data URI 替代 `/placeholder.jpg` 引用）。

**验收：** `/placeholder.jpg`、`/missing.png` 返回 404（或真实图片）；`<img>` 可降级；无 HTML-as-JS 情况。

---

### P1-5 安全头自相矛盾：CSP `frame-ancestors *` 覆盖 `X-Frame-Options: DENY` ✅
**位置：** `backend/middleware/security.go:13-17`、`30-44`

响应同时发送 `X-Frame-Options: DENY` 与 CSP 的 `frame-ancestors *`。现代浏览器中 **CSP 优先**，等于允许任意站点嵌套本应用 → 点击劫持防护实际失效（例如诱导用户点击"清空历史"、"退出登录"）。同时 CSP 其余指令全通配 + `unsafe-inline`/`unsafe-eval`（`security.go:27-29` 注明是所有者决策），这使 CSP 只剩形式意义。

**修复：** 至少把 `frame-ancestors` 收紧为 `'self'`（或删除该指令以回退到 XFO），并在注释中明确"其余指令宽放是已知决策"。中长期按实际域名收敛：`script-src 'self'`（Artplayer 需要 `unsafe-eval` 时单独说明）、`img-src` 保留豆瓣/Bangumi CDN、`connect-src` 保留视频源。移除已废弃的 `X-XSS-Protection`。

**验收：** 第三方页面用 `<iframe src="http://...">` 嵌入被拒绝；正常功能无 CSP 报错。

---

### P1-6 服务端缓存无界且非原子，存在内存/磁盘增长与并发读风险 ✅
**位置：** `backend/services/cache.go`

- 内存 `items` map 只增不删：过期项在 `Get` 时不会被清理（`Get` 只判断 `time.Now().Before`，过期后转向磁盘，但 map 条目仍在）。搜索按关键词/页码建键，长期运行必然持续增长。
- 磁盘 `data/cache/*.json` 没有 GC：只有"被读到且已过期"的文件才会删除（`getFromDisk`），冷 key 永不清理。
- `Set` 在请求路径上同步 `Marshal` + `WriteFile`（`cache.go:46-56`、`102-120`），一个 27 源、上千条结果的响应会阻塞请求；`WriteFile` 非原子（无 temp+rename），并发读到半个文件会 `Unmarshal` 失败并静默丢弃。
- `os.WriteFile` 的错误被忽略（`cache.go:119`），磁盘满时无任何告警。

**修复：** 增加后台清理（定时 ticker 扫描内存与磁盘，或使用带容量的 LRU）；`Set` 异步化（或至少限制单条大小）；写入改 `os.CreateTemp` + `os.Rename`；磁盘错误用 `log.Printf` 记录；考虑把"每个 key 一个文件"改为单一 append-only 存储或引入 `ristretto`/`bigcache`。

**验收：** 连续 1 万次不同关键词搜索后 RSS 稳定；并发搜索 + 读取缓存无解析失败日志。

---

### P1-7 SSE 缺少心跳与上游取消，客户端断开后请求仍在跑 ✅
**位置：** `backend/handlers/search.go:99-224`、`services/proxy.go:126-160`

- 没有 `: ping` 心跳。20s 内上游无响应时，Nginx/Cloudflare 等反代常以 60s `proxy_read_timeout` 断开空闲连接；此处 20s 勉强安全，但任何调大超时的改动都会踩坑。
- `timedCtx` 只用于 `select`，**没有传给上游请求**：`client.Get(rawURL)` 用的是全局 client，客户端断开（`clientGone`）后 goroutine 仍会把 15s 超时跑完。27 个源 × 高并发搜索会堆积 goroutine 与出站连接。
- 未设置 `Retry-After`/背压：搜索接口无任何速率限制（登录有限流，搜索没有）。

**修复：** `req, _ := http.NewRequestWithContext(ctx, "GET", rawURL, nil)`；每个源一个带 `context.WithTimeout(ctx, 12*time.Second)` 的子上下文；每 10s 发送 `: keepalive\n\n`；对 `/api/search/stream` 加按用户/IP 的宽松限流（例如 10 次/分钟），并限制 `wd` 长度（见 P2-8）。

**验收：** 客户端 `AbortController.abort()` 后，服务端上游请求在 1s 内取消（可用 httptest 计数验证）；长时间空闲连接不被反代断开。

---

### P1-8 前端 SSE 解析脆弱：`JSON.parse` 无保护、不校验 Content-Type ✅

**位置：** `frontend/src/api/searchStream.ts:60-63`、`88-100`、`120-131`

- `dispatchSseMessage` 直接 `JSON.parse(message.data)`，任何一条畸形帧（上游/中间层截断）都会抛异常，`streamSearchResults` 整体 reject → 搜索"没有任何结果"且无提示。
- 只判断 `response.ok`，不校验 `Content-Type: text/event-stream`。若后端被 SPA fallback 影响（如 P1-1）或反向代理返回 HTML，解析器会安静地读到 0 个事件，UI 表现为"搜索无结果"。
- `processSseBuffer` 每次增量都对**整个 buffer** 做 `replaceAll('\r\n','\n')` 与 `split`，长连接下是 O(n²)。

**修复：** `try { ... } catch { console.warn(...) }` 包裹单帧解析并继续；校验 `response.headers.get('content-type')?.includes('text/event-stream')`，否则抛出可读错误；把 `\r\n` 归一化放在 `TextDecoder` 输出处并只处理新增片段；`onDone` 未触发时给出"流意外结束"提示。

**验收：** 人为注入畸形帧不影响其余结果；HTML 响应被识别为错误而不是空结果。

---

### P1-9 Bangumi 链路：3s 客户端超时 vs 30s 服务端超时，硬编码第三方代理 ✅
**位置：** `frontend/src/api/bangumi.ts:11`、`backend/handlers/bangumi.go:28`、`56`

- 前端 `timeout: 3000`，后端 `bangumiClient.Timeout = 30 * time.Second`。首屏（缓存未命中）几乎必然在前端侧先超时；后端仍在拉取并写入 12h 缓存，用户看到的是空白，刷新后才可能命中。
- `api/bangumi.ts:14-19` 的 `atob(raw)` 分支是死代码：后端返回的是原始 JSON 数组，axios 已解析为对象，`atob` 必抛 → 走 `catch` 用 `raw`。这段代码会误导维护者以为后端返回 base64。
- 后端把 `https://cdn.404888.xyz/proxy/https://api.bgm.tv/calendar` 写死，无直连回退、无超时降级；第三方挂掉时日历永久空白。且 `catch { return [] }` 把失败伪装成"今天没有番剧"。
- 后端缓存 12h，前端 IndexedDB 24h，两层 TTL 不一致。

**修复：** 前端超时提到 10-15s（或改为"先显示缓存、后台刷新"）；删除 `atob` 分支；后端增加直连 `https://api.bgm.tv/calendar` 的回退与 `User-Agent`（bgm 要求）；失败时返回 502 并让前端提示"番组日历暂不可用"，同时保留旧缓存；统一 TTL。

**验收：** 首次访问 10s 内出数据；代理不可用时直连成功；失败有可见提示。

---

### P1-10 豆瓣数据由浏览器直连第三方镜像，缓存用 localStorage 且无上限 ✅
**位置：** `frontend/src/api/douban.ts:48-98`、`72-76`

- 三个代理域（`m.douban.cmliussss.net/.com`、`movie.douban.*`）写死在前端；可用性、被墙、CORS 全部取决于第三方。仓库里没有对应的后端代理，与 README 架构图描述的"后端代理转发"不一致。
- `fetchWithTimeout` 设置的 `User-Agent` 与 `Referer` 是浏览器**禁止**的请求头，会被静默丢弃（`douban.ts:91-92`）——对豆瓣反爬没有任何作用，纯属误导。
- 缓存用 `localStorage`（`douban_cache_*`），每条是一次完整 JSON，首页 + 豆瓣页无限翻页会持续占用 5MB 配额；`setCache` 的 `catch` 静默失败。README 声称"本地存储（IndexedDB）"，与实现不符（实际混用 localStorage + Dexie）。
- `getDoubanRecommends` 在函数开头查一次缓存，`fetchDoubanAPI` 内部又查一次（`douban.ts:193-194` 与 `106-107`），重复逻辑。

**修复：** 后端增加 `GET /api/douban/*` 代理（带磁盘/内存缓存、统一 UA、失败回退），前端只调自家接口；缓存迁到 IndexedDB 并设条数上限/LRU；删除无效请求头与重复缓存查询；配置页允许自定义代理地址而不是三选一写死。

**验收：** 断掉第三方镜像后仍可通过后端代理（或直连）取数；localStorage 不再增长；README 与实现一致。

---

### P1-11 去广告逻辑会丢失清晰度（master playlist 只取第一条流） ✅
**位置：** `frontend/src/utils/adblock.ts:47-93`

`isMasterPlaylist` 命中后，`getFirstStreamUrl` 只取**第一个** `#EXT-X-STREAM-INF` 的变体，然后把它过滤成 blob 播放。结果：原本支持多清晰度的源被强制降/升到第一条流（通常是低码率），播放器画质菜单失效。此外每次换集都 `fetch` 两次 m3u8 并创建 blob URL，切换失败路径只返回原 URL（合理），但 blob 在 `Player` 中依赖 `revokeBlobUrl` 清理，异常路径可能泄漏。

**修复：** 不再"取第一条流"，而是重写 master playlist 内所有 `URI="..."` 为绝对地址并返回 blob（保留多清晰度）；或只过滤 media playlist，master 直接透传（广告通常也在 media playlist）。统一在 `Player` 销毁/切换时 revoke 上一次 blob。

**验收：** 多码率源在播放器设置中仍可切换清晰度；连续切换 20 集后无 blob 泄漏（`performance.memory` 或 URL 计数）。

---

### P1-12 `POST /api/config` 没有前端入口，管理员无法改密码/管理源（半成品功能） ✅
**位置：** `backend/handlers/config.go:65-87`、`frontend/src/api/config.ts`

后端实现了完整的配置更新（含 SSRF 校验），但前端只有 `GET /config`。仓库里**没有任何页面**调用 `POST /api/config`，也没有添加/编辑播放源的 UI、没有修改密码的入口。实际运维只能手改容器内 JSON 并重启。

**影响：** 与 README"在 `data/config.json` 中添加源"一致，但与"自托管配置"体验不符；同时 `SiteConfig.detail` 字段（`config.go:23`）在全仓库无任何读取方，属于未完成的领域模型。

**修复：** 要么补齐设置页（源列表增删改、密码修改、公告编辑），要么明确标注该接口为实验性。密码修改建议单独 `POST /api/auth/password`（校验旧密码 + 强度校验 + 轮换 secret 使旧 token 失效）。

**验收：** 管理员可在 UI 中完成源管理与密码修改，无需重启。

---

### P1-13 登录限流把成功登录也计入；多副本/反代场景失效 ✅
**位置：** `backend/middleware/ratelimit.go:12-22`

- 限流器在 `Login` 之前执行，**成功的登录同样消耗令牌**：同一 IP 30 分钟内正常重登 5 次后会被锁 30 分钟（家庭/公司 NAT 下多用户更明显）。注释写的是"登录尝试过多"，实际是"请求过多"。
- 状态在进程内存：多副本部署时每个副本独立计数，等于放宽 1/N；重启即清零，攻击者可利用。
- 依赖 `c.ClientIP()`，但未设置 `SetTrustedProxies`（`main.go` 无相关配置），反代后所有请求可能被识别为同一 IP，导致**全局限流**（误伤所有人）或可被 `X-Forwarded-For` 伪造绕过。

**修复：** 只在失败响应时扣减（中间件改为在 handler 内调用 `limiter.Allow()` 并在失败分支消费）；显式配置 `r.SetTrustedProxies([]string{"127.0.0.1", "10.0.0.0/8"})` 或读取 `TRUSTED_PROXIES`；多副本场景把计数放到 Redis/共享存储，或至少文档说明单副本限制；增加持久化的失败计数与指数退避。

**验收：** 连续 5 次成功登录不被锁；失败 6 次被锁；反代下按真实 IP 计数。

---

### P1-14 播放历史写入非原子，flush 失败产生未处理 Promise rejection ✅
**位置：** `frontend/src/pages/play/usePlaybackProgress.ts:41-66`、`frontend/src/store/history.ts:28-48`

- `historyStore.record` 先 `where('key').equals(...).first()` 再 `add`/`update`，两步非事务；并发（`visibilitychange` + `pagehide` + 3s 节流 + 换源 flush）同时进入时可能触发 `ConstraintError`（`&key` 唯一索引）。
- `flush` 里 `await historyStore.record(...)` 没有 `catch`，而调用方多为 `void flush()` → 未处理的 rejection（控制台报错），且 `dirtyRef` 不会清理，后续 flush 继续失败。
- `flush` 的依赖数组里有未使用的 `navigate`，`deps.id/site` 每次渲染变化但函数体用 ref 读，依赖语义混乱（lint 也会提示）。

**修复：** 用 Dexie 事务或 `put` 语义（以 `key` 为主键，改用 `db.watchHistory.put({...})` 一步完成，彻底消除 read-then-write）；`flush` 内部 `try/catch` 并 `console.warn`；把 `record` 的返回/错误暴露出来；依赖数组只保留 `stateRef` 与稳定项。

**验收：** 快速刷页/切换源 100 次无未处理 rejection、无重复行；`history.test.ts` 增加并发用例。

---

### P1-15 镜像安全基线不足（root、无健康检查、构建期泄露配置） ✅
**位置：** `Dockerfile:17-24`、`Dockerfile.release:4-11`

- `FROM scratch` 默认以 **root** 运行；无 `USER`。
- 无 `HEALTHCHECK`、无 `STOPSIGNAL`；程序也没有优雅退出（P2-15），`docker stop` 会硬断所有 SSE 连接。
- `Dockerfile:21` 把操作者本地 `data/config.json`（含真实密码）打进镜像层（同 P0-1）。
- 无 OCI label / SBOM / provenance（`release.yml` 可加 `docker/build-push-action` 的 `provenance: true`）。
- 前端 dist 在 embed 模式被编进二进制，同时又 `COPY /frontend/dist`（`Dockerfile:20`），镜像里存在一份无用副本（约 1.5MB，非问题但冗余）。

**修复：** 非 root 用户 + `USER 10001`；加 healthcheck；`docker stop` 前处理 `SIGTERM`；移除重复 dist；`--read-only` + `tmpfs /tmp` 可在文档中给出推荐参数；构建加 `provenance`/SBOM。

**验收：** `docker inspect` 显示非 root；`docker stop` 5s 内退出；镜像内无明文密码；`/healthz` 可用。

---

### P1-16 Service Worker：开发环境注册、缓存清单含不存在的文件、离线兜底可能返回 undefined ✅
**位置：** `frontend/index.html:19-28`、`frontend/public/sw.js:4-9`、`36-59`、`109-111`

- SW 在**所有环境**注册（含 `vite dev`），开发时会把 dev 资源写入缓存，改代码后出现"改了不生效"，必须手动清 SW；也污染 `localhost:5173` 的 PWA 状态。
- `STATIC_ASSETS` 包含 `/manifest.json`，但 `frontend/public` 里**没有**这个文件（manifest 是运行时 blob，见 `useDocumentTitle.ts:103-117`）。`cache.addAll` 是原子操作，任何一项 404 会让 **install 整体失败**——此处实际拿到的是 SPA fallback 的 200 HTML，于是把 HTML 缓存成 manifest（更隐蔽）。
- 离线兜底 `return caches.match(event.request)` 可能返回 `undefined`，`respondWith(undefined)` 会抛 `TypeError`，表现为白屏而不是离线页。
- `trimCache` 用 `Date.now()` 写入每条 entry 的 `timestamp`（`sw.js:47`），排序永远相等；且 `content-length` 常为空 → 总大小为 0 → **永远不会触发清理**，`MAX_CACHE_SIZE` 形同虚设。
- 无缓存优先策略：网络抖动时每次都先等网络失败再回退，离线体验差。

**修复：** 只在 `import.meta.env.PROD` 注册；移除 `/manifest.json` 或提供真实静态 manifest；兜底改为 `(await caches.match(req)) || (await caches.match('/'))` 并处理 undefined；`trimCache` 改为记录 `Date.now()` 于写入时（自定义 IndexedDB 元数据）或用 `cache.keys()` 顺序近似 LRU，大小按 `response.clone().arrayBuffer().byteLength` 计算；对导航请求使用 stale-while-revalidate。

**验收：** dev 下无 SW 注册；断网刷新仍能打开应用；缓存大小可被约束在 50MB 内。

---

## 五、P2 —— 可维护性、健壮性与体验

| ID | 状态 | 位置 | 问题 | 建议 |
|---|---|---|---|---|
| P2-1 | ✅ | `frontend/package-lock.json` + `pnpm-lock.yaml` | 两套锁文件同时存在且都被跟踪，依赖版本可能漂移；CI/Docker 用 pnpm，npm 锁文件长期失效 | 删除 `package-lock.json`，`packageManager` 已声明 pnpm，加入 `npm i` 保护说明 |
| P2-2 | ✅ | 仓库根 / `frontend/` | 跟踪了 `frontend/ANALYSIS_REPORT.md`、`OPTIMIZATION_REPORT_2026-07-09.md`（一次性报告）；工作区还有 `nul`（Windows 保留名）与 `scripts/__pycache__/` | 报告移入 `docs/` 或删除；删除 `nul`；`__pycache__` 加忽略 |
| P2-3 | ✅ | `.github/workflows/ci.yml:81-93` | 后端只 `go build`，没有 `go vet`/`go test`/`gofmt -l`；`handlers/search.go` 当前未格式化也能过 CI | 加 `test -z "$(gofmt -l .)"`、`go vet ./...`、`go test -race ./...`、`govulncheck ./...` |
| P2-4 | ✅ | `Dockerfile*` / `build.ps1:41-49` / `README.md:181-190` | `version` 未进镜像/未注入二进制 → `/api/version` 恒为空；`build.ps1` 只出 2 个平台，README 宣称 5 个；`-trimpath` 各脚本不一致 | 统一 `-ldflags "-s -w -trimpath -X main.version=$(cat version)"`；README 与脚本平台清单对齐 |
| P2-5 | ✅ | `README.md:86-120`、`README.md:289` | 文档与实现漂移：架构图写"豆瓣/Bangumi 处理器""代理转发"，后端实际没有 douban/proxy 处理器；页面数写 10 个，路由只有 6 个（Login/Home/Search/Play/SpeedTest/Douban）；`docs/fix-plan.md` 的 P0 已修复但未更新 | 以代码为准重写架构图与目录说明；在 `docs/` 标注文档有效期，过时的归档 |
| P2-6 | ✅ | `backend/config/config.go:61-109`、`151-164` | `main.go:17` 显式 `Load` 后，首次 `Get()` 的 `sync.Once` 又执行一次 `Load`（实测日志重复两遍）；`WriteFile(..., 0644)` 让密码文件全局可读；写入非原子 | `Load` 内部使用 `once.Do`，或 `main` 不预加载；文件权限 `0600`；`temp+rename` 原子写 |
| P2-7 | ✅ | `frontend/src/pages/Home.tsx:112`、`136-157` | 读取 `localStorage['bangumi_calendar']`，但项目里**没有任何地方写入该 key**（Bangumi 走 IndexedDB `apiCache`）→ 该分支永远不命中；`refreshData` 串行等待电影+剧集 → 综艺 → 其它，首屏被 3 个 RTT 拖慢 | 删除死 key 或统一走 `apiCacheStore`；三个豆瓣请求 `Promise.allSettled` 并行；首屏先渲染 IndexedDB 缓存 |
| P2-8 | ✅ | `backend/handlers/search.go:45-57`、`frontend/src/pages/Search.tsx` | `wd` 无长度上限（可构造超长缓存键与上游 URL）；`pg` 可为负数/超大；前端聚合去重键（`replaceAll(' ','')`）与 `normalizeString`（去标点）不一致，导致《片名》与片名仍分两卡；`sessionStorage` 缓存整页结果易超配额 | 校验 `len(wd) <= 100`、`1 <= pg <= 50`；聚合复用 `normalizeString`；`sessionStorage` 只存摘要或改 IndexedDB |
| P2-9 | ✅ | `frontend/src/pages/play/useDetailLoader.ts:23`、`playUtils.ts:65`、`useSourceSearch.ts:44-48,195-200` | 用 `/^\d+$/.test(site)` 判断"历史记录源已失效"——若管理员配置数字型站点 key 会被误判；`getPlayableUrl(url, sourceKey)` 的 `sourceKey` 是死参数（`void sourceKey`）；优选只测每源第一集且只认 URL 含 `.m3u8`，非标准扩展名/多线路会漏测；搜索/优选里的 `setTimeout` 未在卸载时清理，卸载后仍 `dispatch` | 用配置中是否存在该 key 判断；删除死参数；优选解析 `vod_play_from` 多线路并取代表性集；定时器存 ref 并在 cleanup 清除 |
| P2-10 | ✅ | `frontend/src/components/ToastProvider.tsx:124-128`、`hooks/useAnnouncement.ts:14`、`components/Announcement.tsx:72` | `toast(message, type, duration)` 的 `duration` 被忽略（`ToastItem` 固定用默认值）；`JSON.parse(dismissed)` 无 try/catch，localStorage 损坏会让 effect 抛错；公告点背景即关闭，移动端易误触 | 透传 duration；包 try/catch；背景点击改为"仅显式按钮关闭"或二次确认 |
| P2-11 | ✅ | `frontend/src/components/VideoCard.tsx:98-155`、`useDocumentTitle.ts`、`Announcement.tsx` | `<Link>` 内部渲染 `<button>`（收藏/删除）——非法的交互元素嵌套，键盘 Tab 会进入嵌套按钮，屏幕阅读器语义混乱；主题切换后 `<meta name="theme-color">` 只在 manifest effect 更新，切主题不刷新；公告打开时背景仍可滚动 | 用 `div` + `onClick`/`role="link"` + `tabIndex`，或把操作按钮移出 Link；主题切换时同步 theme-color；dialog 打开时锁 `overflow` |
| P2-12 | ✅ | `frontend/src/index.css:47`、`VideoCard.tsx:268` | `font-family: 'Inter'` 与 `font-['Anton']` 都没有对应的 `@font-face`/外链——两个字体实际都不生效，视觉回退到系统字体 | 自托管字体（`font-display: swap`）或删除相关声明，避免"看起来有设计但没生效" |
| P2-13 | ✅ | `frontend/src/components/Player.tsx:186-188`、`208-216` | `crossOrigin: 'anonymous'` 会让不支持 CORS 头的视频 CDN 直接失败（部分源无 ACAO）；`NETWORK_ERROR` 无条件 `startLoad()` 可能无限重试；无清晰度选择记忆 | 仅在需要 canvas/截帧时启用 crossOrigin，或按源降级；网络错误加指数退避与次数上限；记录用户选择的清晰度 |
| P2-14 | ✅ | `backend/main.go:33`、`handlers/search.go:159-165` | `gin.Default()` 把含搜索关键词的 URL 打进访问日志（隐私）；无 request-id、无结构化日志；搜索错误对客户端只给"上游请求失败"，服务端也不记录具体站点/原因 | 结构化日志（slog）+ request-id；错误日志带 site/key/耗时；敏感查询参数脱敏 |
| P2-15 | ✅ | `backend/main.go:61` | `r.Run(":3000")` 忽略错误；无 `ReadHeaderTimeout`/`IdleTimeout`（Slowloris 风险）；无优雅退出（SSE/进行中的搜索被硬断）；`gin.ReleaseMode` 下 panic 仅通用 500，无堆栈上报 | `http.Server` 显式超时 + `signal.NotifyContext` + `Shutdown(ctx)`；`r.Run` 错误 `log.Fatal`；panic 上报接入 |
| P2-16 | ✅ | `backend/services/proxy.go:179-199`、`handlers/config.go:58` | SSRF 校验是"先 DNS 解析判断、再交给默认 Transport 解析"的 TOCTOU（DNS rebinding 可绕过）；DNS 解析失败时**放行**（fail-open）；未覆盖 `100.64.0.0/10`（CGNAT）等特殊段 | 用自定义 `DialContext` 在连接时校验目标 IP（并禁用代理环境变量），或解析后直连 IP + `Host` 头；解析失败改为拒绝；补充特殊网段清单 |

---

## 六、P3 —— 架构与长期改进建议

### 6.1 后端

1. **依赖注入与可测试性：** `handlers` 直接调用包级 `services.ProxyXxx` 与 `config.Snapshot()`。建议定义 `SiteRepository`/`Upstream` 接口，在 `main` 装配，使 handler 可用 `httptest` + fake upstream 测试（当前 handlers 只有 `validateAPISite` 单测）。
2. **错误模型：** 目前错误一律 502 + "上游请求失败"。建议定义 `APIError{Code, Message, Status}`，区分 `UPSTREAM_TIMEOUT`/`UPSTREAM_BAD_STATUS`/`SITE_NOT_FOUND`/`INVALID_INPUT`，前端据此给不同提示。
3. **配置演进：** JSON 配置文件缺少 schema 校验、版本迁移与边界（`api_site` 数量、`name` 长度、`api` URL 长度）。建议引入 `config_version` 字段与迁移函数；密码改为 argon2id 哈希存储（同时保留明文迁移路径）。
4. **缓存策略：** 引入 `singleflight` 合并同一关键词的并发上游请求；详情/搜索分开 TTL；负缓存（源连续失败 N 次后短时跳过）可显著降低 SSE 超时率。
5. **可观测性：** `/healthz`（进程存活 + 磁盘可写 + 配置已加载）、`/readyz`、可选 Prometheus `/metrics`（搜索耗时、各源成功率、缓存命中率）。
6. **安全加固：** 密码修改接口 + 会话版本号（改密后旧 token 失效）；`SameSite=Lax` 评估（Strict 会影响从外部链接进入时的登录态）；Cookie 加 `__Host-` 前缀；限制 `api_site` 数量防止配置型 DoS。

### 6.2 前端

1. **统一数据层：** 目前 `apiClient`（axios）、`fetch`（SSE、豆瓣、adblock）、`sessionStorage`、`localStorage`、Dexie 五种访问方式并存。建议收口为 `api/` 层 + `store/` 层两组，所有外部响应做运行时校验（zod/valibot），避免 `response.data as T` 的盲转型。
2. **类型重复：** `SourceItem` 在 `pages/play/types.ts` 与 `OptimizingOverlay.tsx` 各定义一份；`SearchSiteData`/`SiteSearchResult`、`DetailResponse` 与 `types/index.ts` 存在重叠；`User`（token/expiresAt）是 Cookie 迁移后的死类型（`types/index.ts:41-44`）；`getAuthHeaders`（`api/client.ts:13-15`）同理。建议 `types/` 单一来源。
3. **状态管理：** 播放页已 reducer 化（好），但 `usePlayController` 返回 30+ 字段，父组件任何 state 变化都会重渲染整页。建议拆 Context/selector，或把 `SourcePanel`/`VideoInfo` 用 `memo` 隔离。
4. **长列表：** 剧集分页 50/页尚可，但豆瓣/搜索页无虚拟化；搜索结果上千条时 DOM 压力大。建议引入 `@tanstack/react-virtual`（`ScrollableRow` 已做过 MutationObserver + rAF 优化，说明已在关注性能）。
5. **首屏体积：** `storage` chunk（Dexie，31KB gzip）因 `App.tsx:41` 的 `apiCacheStore.cleanExpired()` 被首屏静态引入。可把清理改为 `requestIdleCallback` + 动态 import，或改用原生 IndexedDB 处理这一处小缓存。
6. **可访问性：** 补 `aria-label`（播放器控制、图标按钮）、`prefers-reduced-motion`（目前大量 `animate-*` 只在 `CapsuleSwitch` 用了 `motion-reduce`）、错误提示的 `aria-live`（Toast 已有，页面级错误没有）。

### 6.3 性能

- 搜索并行度无上限：27 个源同时出站，移动网络/弱 VPS 上易被上游限流。建议 `semaphore` 限制 5-8 并发，并按源历史成功率排序。
- 上游响应未启用压缩协商：`http.Client` 默认会加 `Accept-Encoding: gzip`（Go 自动解压），无需改；但缺少 `Connection: keep-alive` 复用调优（默认已复用）。
- 图片：豆瓣/Bangumi 图片直连第三方镜像，建议后端统一图片代理 + `Cache-Control` + 尺寸裁剪，减少移动端流量与第三方便宜失效。
- 静态资源：`http.FileServer` 未设置 `Cache-Control: max-age=31536000, immutable`（`/assets/*` 有 hash，可长缓存）；`embed.FS` 无 modtime，条件请求失效。建议中间件按路径注入缓存头。
- SSE：`fmt.Fprintf` + `Flush` 每事件一次系统调用，可合并为一次 `Write`（一次事件一个包，避免 Nagle）。

### 6.4 测试

- 后端：`go test -race ./...` 未进 CI；handlers 无 `httptest` 覆盖（搜索超时/缓存/SSRF 均可低成本覆盖）；建议补 `config.Load` 的 env 覆盖测试（P0-1 的回归保护）与 `NoRoute` 的 404 测试（P1-1）。
- 前端：74 个测试集中在 store 与 play 逻辑（质量好），但**没有任何页面级/组件级测试**（Search、Douban、SpeedTest、Login）。建议用 MSW mock 接口补 4 个页面的冒烟测试；关键链路（搜索→播放→续播）可用 Playwright 做一条 e2e。
- 契约测试：MacCMS 源格式（`vod_play_from` 多线路、`vod_play_url` 的 `$$$`/`#`/`$` 分隔）是核心解析逻辑，建议固化 3-5 份真实响应样本做快照测试。

### 6.5 构建与发布

- 统一构建入口（Makefile / build.sh / build.ps1 / CI / Dockerfile 五处逻辑重复且已经漂移），建议抽出 `scripts/build.mjs` 或 `Taskfile.yml`，各脚本只做参数包装。
- 用 `docker buildx` 构建多架构镜像并附 SBOM；`release.yml` 的 `crane`/`ghcr` 推送步骤建议用官方 `docker/build-push-action`（当前自定义脚本较脆）。
- 版本号目前手改 `version` 文件（提交信息里能看到 `chore: 版本号 1.3.0 -> 1.3.1`），建议由 tag 驱动（`git describe`）并同时注入前端与后端。

### 6.6 文档与流程

- `docs/` 下既有 9 份文档中，`fix-plan.md`、`code-review-search.md`、`code-review-play.md` 的部分结论已被后续提交修复（如 JWT 默认密钥、localStorage token、`/api/proxy/m3u8`），但文档未更新，会误导新审查者。建议合并为一份"当前状态"文档 + 历史归档目录。**（已按 10.9 完成：6 份过期根文档删除，`docs/` 只留当前有效 4 份 + 历史归档 4 份。）**
- README 的"功能特性"与"技术架构"需与代码对齐（Douban 无后端、页面数量、环境变量优先级、Docker 卷路径）。
- 建议增加 `CONTRIBUTING.md`（如何跑 lint/test/build）、`SECURITY.md`（漏洞上报 + 已泄露 secret 轮换流程）、`CHANGELOG.md`（release 已有生成逻辑）。

---

## 七、修复路线图（已执行，2026-11-05）

> 三批全部落地，逐项说明见第十节。下表为原计划与完成状态对照。

### 第一批（解除阻断）— ✅ 全部完成

1. ✅ P0-4：移除被跟踪的 `backend/data/config.json`（`git rm --cached`），`.gitignore` 增 `backend/data/`；配置路径统一由 `-config` / `WARHUTV_CONFIG` 决定。
2. ✅ P0-3：`usePlayController.ts` 改用 `progressFlushRef`，`pnpm run lint` 归零 error。
3. ✅ P0-2：`Makefile` / `build.sh` 补 `mkdir -p frontend` 与清理；CI 同步。
4. ✅ P0-1：实现 `PASSWORD`/`JWT_SECRET` 环境变量（env 优先、不落盘）；Dockerfile 改为非 root + healthcheck + version 注入 + 配置挂载。
5. ✅ P1-1：`NoRoute` 对 `/api/*` 返回 404 JSON；测速页改调 `/api/sites/ping`。

### 第二批（正确性与安全）— ✅ 全部完成

6. ✅ P1-2 / P1-7：SSE 单写协程、超时快照、context 取消、15s 心跳、搜索限流。
7. ✅ P1-3：上游改用 `ac=videolist`（回退 `ac=detail`），播放走 `ac=detail` + `ParsePlaylist`，`episode` 真正生效。
8. ✅ P1-4 / P1-5：静态资源扩展名白名单 + 缺失文件 404；CSP `frame-ancestors 'self'`。
9. ✅ P1-6 / P1-14：缓存有界化（256MiB + 10min janitor + 原子写）；历史写入单事务 upsert。
10. ✅ P1-8 / P1-9 / P1-16：SSE 解析容错、Bangumi 每跳 4s 超时 + 镜像回退、SW 生命周期重写。
11. ✅ P1-13：登录限流只计失败 + `SetTrustedProxies`。
12. ✅ P2-1/2/3/4/6：仓库卫生、CI 门禁、版本注入、config 单次加载。

### 第三批（体验与架构）— ✅ 全部完成

13. ✅ P1-10 / P1-11 / P1-12：豆瓣后端代理、master playlist 保留最高码率、设置面板（源管理 + 改密）。
14. ✅ P2-7 ~ P2-16 逐项处理。
15. ⏳ 第六章的架构/测试/观测性改造属长期项，本次仅完成可立即落地的部分（结构化日志、request-id、缓存测试、配置测试）。

### 完成定义（DoD）

- [x] `pnpm run lint` 0 error（29 条既有 warning）；`go vet`、`gofmt -l` 无输出；`go test -race ./...` 全绿，且三者已加入 `.github/workflows/ci.yml`。
- [x] 干净克隆下 `./build.sh` 与 `make build` 的 `cp` 步骤已修（bash 实测通过）；`docker build` 因 Dockerfile 已改为不依赖被忽略的 `data/config.json`，静态检查通过 —— **本机无 Docker，未实地构建**。
- [x] `docker run -e PASSWORD=xxx` 的代码路径已实现并在本地二进制上实测（`PASSWORD=auditpass` 登录成功、`/api/config` 返回 `password_managed_by_env: true`、改密接口 409）；镜像内无明文密钥（不再 COPY 配置、不 COPY `data/config.json`）。历史 secret 仍需按 P0-4 说明轮换。
- [x] `curl /api/nonexistent` = 404（实测）；测速页调 `/api/sites/ping` 显示真实 RTT 与结果数，不再用 `10000/time` 编造速度。
- [x] 搜索超时/部分失败有明确语义（心跳、`event: timeout`、部分结果不写缓存、缓存 key 含源集合指纹）。
- [x] README 与实际一致（6 路由、`master` 分支、环境变量优先级、`/app/data` 卷、页面数、处理器清单）。

---

## 八、附录 A：问题索引（按文件）

| 文件 | 相关 ID |
|---|---|
| `backend/main.go` | P0-1、P1-1(路由兜底)、P1-5(挂载安全头)、P2-15 |
| `backend/config/config.go` | P0-1、P0-4、P2-6 |
| `backend/data/config.json` | P0-4 |
| `backend/handlers/search.go` | P1-2、P1-7、P2-8、P2-14 |
| `backend/handlers/config.go` | P0-1、P1-12、P2-16(SSRF 校验) |
| `backend/handlers/auth.go` | P1-13 |
| `backend/handlers/play.go` / `detail.go` | P1-3 |
| `backend/handlers/bangumi.go` | P1-9 |
| `backend/handlers/version.go` | P0-1、P2-4 |
| `backend/middleware/cors.go` | P1-5（相关） |
| `backend/middleware/security.go` | P1-5 |
| `backend/middleware/ratelimit.go` | P1-13 |
| `backend/services/proxy.go` | P1-2、P1-3、P1-7、P2-16 |
| `backend/services/cache.go` | P1-6 |
| `backend/static_common.go` | P1-1、P1-4 |
| `Dockerfile` / `Dockerfile.release` | P0-1、P1-15 |
| `Makefile` / `build.sh` / `build.ps1` | P0-2、P2-4 |
| `.github/workflows/ci.yml` | P0-3、P2-3 |
| `frontend/index.html` | P1-16 |
| `frontend/public/sw.js` | P1-16 |
| `frontend/src/api/searchStream.ts` | P1-8 |
| `frontend/src/api/bangumi.ts` | P1-9 |
| `frontend/src/api/douban.ts` | P1-10 |
| `frontend/src/pages/Home.tsx` | P2-7 |
| `frontend/src/pages/Search.tsx` | P2-8 |
| `frontend/src/pages/SpeedTest.tsx` | P1-1 |
| `frontend/src/pages/play/usePlayController.ts` | P0-3 |
| `frontend/src/pages/play/usePlaybackProgress.ts` | P1-14 |
| `frontend/src/pages/play/useSourceSearch.ts` | P2-9 |
| `frontend/src/pages/play/useDetailLoader.ts` | P2-9 |
| `frontend/src/utils/adblock.ts` | P1-11 |
| `frontend/src/components/Player.tsx` | P2-13 |
| `frontend/src/components/VideoCard.tsx` | P2-11 |
| `frontend/src/components/ToastProvider.tsx` | P2-10 |
| `frontend/src/hooks/useAnnouncement.ts` | P2-10 |
| `README.md` | P0-1、P2-5 |
| `docs/fix-plan.md` 等（已按 10.9 删除） | P2-5 |

---

## 九、附录 B：已确认可用/已修复的项（避免重复排查）

- JWT：`alg` 混淆防护、issuer/audience 绑定、过期校验均有单测（`backend/utils/jwt_test.go`）。
- 密码：常量时间比较；Cookie `HttpOnly` + `SameSite=Strict` + TLS 下 `Secure`；token 不再写入 URL。
- 上游：响应体上限 10MB / Bangumi 5MB；状态码检查；超时 15s；SSRF 在"保存配置"与"请求前"双重校验（虽然仍有 P2-16 的 TOCTOU）。
- 前端：`tsc -b` 无错；74 个单测全绿；构建体积在 CI 预算内；路由级懒加载；`ErrorBoundary`；`useFocusTrap`（Esc/Tab/焦点恢复）；跳转链接（skip link）。
- 数据：Dexie v1→v5 迁移有测试；收藏/历史/详情缓存分层清晰；`apiCache` 与 `detailCache` 共用表但已用前缀隔离（`detailCache.ts:31-44` 有注释与测试）。
- 播放：换源/切集的 seek 逻辑有专项测试（`Player.seek.test.ts`、`useSourceSwitch.test.ts`、`usePlaybackProgress.test.ts`），这部分是仓库里最扎实的模块。
- 既有文档体系（`docs/code-review-guide.md`、PR 模板、Issue 模板）结构完整，只需同步内容而非重建。

---

## 十、修复说明书（2026-11-05 落地记录）

> 本节逐条对应上文各 ID，说明**改了什么、为什么这样改、如何验收**。所有条目均已合入工作区并通过
> `pnpm run lint`（0 error）/ `pnpm test`（74 passed）/ `pnpm exec tsc -b` / `go build ./...` /
> `go vet ./...` / `gofmt -l .`（无输出）/ `go test ./...`。

### 10.1 P0（4 项，全部完成）

**P0-1 Docker 部署链路** — 后端新增环境变量配置层：`config.Load` 现在支持 `PASSWORD` / `JWT_SECRET` / `SITE_NAME` 覆盖，
且**环境变量值永不落盘**（`Config` 内新增 `filePassword`/`fileJWTSecret` + `*FromEnv` 标记，`snapshotLocked` 写盘前回填文件值）；
新增 `-config` 启动参数与 `WARHUTV_CONFIG`，`config.Path()` 记录实际加载路径，`POST /api/config` 不再写死 `data/config.json`。
两个 Dockerfile 改为 `alpine:3.21` + 非 root（uid 10001）+ `HEALTHCHECK`（探测 `/api/healthz`，端口跟随 `PORT`）+
`COPY version`，并删除 `COPY data/config.json`（全新克隆不再构建失败，也不会把运维密钥烙进镜像层）；
运行时 `ENV WARHUTV_CONFIG=/app/data/config.json`，README/Compose 的卷路径统一为 `/app/data`。
**验收：** `docker build --build-arg VERSION=$(cat version) -t warhutv . && docker run -e PASSWORD=xxx -p 3000:3000 warhutv` 可启动登录；
`/api/version` 返回注入的版本号。

**P0-2 干净检出构建失败** — `Makefile:build-backend` 与 `build.sh` 在 `cp` 前补 `mkdir -p frontend && rm -rf frontend/dist`，
构建后 `rm -rf frontend` 清理临时目录（该目录已加入 `.gitignore`）。`make run` 改为
`cd backend && go run . -config ../data/config.json`，直接复用根目录配置。

**P0-3 CI 必红** — `usePlayController.ts` 里渲染期写 `deps.progressFlush = flush` 改为
`progressFlushRef`（`playContext.ts` 类型改为 `MutableRefObject`），由 `useEffect` 同步、`useSourceSwitch` 调用 `.current?.()`。
`pnpm run lint` 从 1 error 降为 **0 error**。

**P0-4 被跟踪的 `backend/data/config.json`** — `git rm --cached backend/data/config.json` 并删除本地副本，
`.gitignore` 增 `backend/data/`；`config.Load` 在文件缺失时自动生成随机 `jwt_secret` 并以 `0600` 原子写入，
默认密码告警只在**未设置 `PASSWORD`** 时打印。开发入口统一走根目录 `data/config.json`（README 已同步）。

### 10.2 P1（16 项，全部完成）

| ID | 修复内容 |
|---|---|
| P1-1 | `static_common.go` 重写：`NoRoute` 对 `/api`、`/api/*` 直接返回 **404 JSON**（`{"error":"接口不存在"}`），静态文件不存在返回 404，只有真实 SPA 路由才回 `index.html`（并带 `Cache-Control: no-cache`）。前端测速页改为调用**新增的** `GET /api/sites/ping`（`handlers/sites.go`，并发 5、单源 10s 超时、返回真实 `ms`/`count`/`error`），删除虚构的 `Math.round(10000/time)`。 |
| P1-2 | `search.go` 重写：缓存键加入源集合指纹（`search:<md5(排序site)>:<wd>:<pg>`）；**只有全部源成功且未超时**才写缓存；超时后 `cancel()` 并等待 worker 退出，再持锁取 `finalResults/finalCompleted/finalErrCount` 快照，消除无锁读竞争。 |
| P1-3 | `proxy.go`：搜索改用 `ac=videolist`（空结果回退 `ac=detail`）；**删除不存在的 `ac=play`**，播放改为 `ac=detail&ids=` + `ParsePlaylist` 解析 `$$$`/`#`/`$`；`Play` 读取 `episode` 并按集名匹配，前端传参由此真正生效；`/api/detail` 额外返回 `episodes`。 |
| P1-4 | 静态扩展名白名单扩到 22 项（含 jpg/jpeg/webp/gif/avif 等）；新增 `frontend/public/placeholder.svg`，`VideoCard`/`VideoInfo` 的 `/placeholder.jpg` 全部改指它（原先该文件不存在，缺失图返回 200 HTML）。 |
| P1-5 | `security.go`：CSP `frame-ancestors` 由 `*` 改为 `'self'`（原值与 `X-Frame-Options: DENY` 直接矛盾，等于放弃点击劫持防护）；顺带删除已废弃的 `X-XSS-Protection`。 |
| P1-6 | `cache.go` 重写：内存过期项被动清理；后台 janitor 每 10 分钟清理过期条目与磁盘文件，超过 256MiB 按 `expiresAt` 淘汰；写入改为 `CreateTemp + Chmod(0600) + Sync + Rename` 原子落盘，`Set` 异步写盘避免阻塞 SSE；新增 5 个单测覆盖过期/落盘/清理/容量。 |
| P1-7 | SSE 增加 15s `event: ping` 心跳；`timedCtx` 传给每个上游请求；客户端断开（`c.Request.Context()` 结束）即取消；`/api/search/stream` 挂 `SearchRateLimit()`（3s/20 次）；单写协程串行化输出，杜绝并发写 ResponseWriter。 |
| P1-8 | `searchStream.ts`：校验响应 `Content-Type`，非 `text/event-stream` 直接报错；`JSON.parse` 加 `try/catch` 并跳过坏帧；忽略 `ping` 事件；解码改 `buffer + decoder.decode(...)` 避免 O(n²) 拼接。 |
| P1-9 | 前端 Bangumi 超时 3s → 20s（与后端 12s 上游超时匹配）；删除 `atob` 死分支；`catch` 改为 `console.warn` 而非静默。后端改为**直连 `api.bgm.tv` 优先 + 第三方镜像回退**，每次尝试单独 4s 超时（否则首个黑洞上游会吃掉全部预算、回退永不执行——实测本机直连 `api.bgm.tv` 20s 超时、镜像 1s 成功，加每跳超时后接口 5.2s 返回 200），整体 12s 上限、5MB 响应上限、失败 502 明确文案、成功 `Cache-Control`。 |
| P1-10 | 新增 `GET /api/douban/*path`（`handlers/douban.go`）：服务端白名单主机 + 依次回退（每个镜像单独 4s 超时，避免镜像黑洞耗尽预算）+ 2h 缓存；`User-Agent`/`Referer` 在**服务端**设置才有效（浏览器会丢弃脚本设置的头）。前端 `api/douban.ts` 全部改走后端 + IndexedDB 缓存，彻底移除 `localStorage` 无上限缓存与浏览器直连第三方镜像。 |
| P1-11 | `adblock.ts`：解析 master playlist 的**全部** `#EXT-X-STREAM-INF` 变体，`pickBestVariant` 选最高 `BANDWIDTH` 后再过滤分片，不再只取第一条流导致清晰度菜单失效。 |
| P1-12 | 新增设置入口：`SettingsDialog.tsx`（站点设置 / 修改密码两个 Tab）+ `SettingsPanel` 菜单改造；`POST /api/config` 与新增 `POST /api/auth/password` 均有前端调用；改密走"校验当前密码 → 更新 → 轮换 JWT → 清 Cookie → 跳登录"，`PASSWORD` 由环境变量管理时禁用并提示。 |
| P1-13 | 限流改为**只在密码错误时消费**，登录成功 `Reset(ip)`；`main.go` 新增 `setTrustedProxies`（`TRUSTED_PROXIES`，默认 `127.0.0.1,::1`），避免客户端伪造 `X-Forwarded-For` 绕过限流；限流器带 30 分钟 TTL 剪枝。 |
| P1-14 | `history.record` 改为 Dexie 单事务 upsert（`where('key')` 查 + `put/add`）；`usePlaybackProgress.flush` 加 `catch`，失败保留 `dirtyRef` 以便重试；DB 升 v6 并为历史遗留行回填 `key`、删除无 `vod_id` 的坏行。 |
| P1-15 | 镜像基线提升见 P0-1；额外接 `http.Server` 超时 + `SIGTERM` 优雅退出 + `/api/healthz`，`idle` 120s、`ReadHeaderTimeout` 10s，`WriteTimeout` 保持 0 以兼容 SSE。 |
| P1-16 | SW 仅在 `import.meta.env.PROD` 注册（dev 不再污染缓存）；`STATIC_ASSETS` 移除不存在的 `/manifest.json`；预缓存逐条 `add` 且单条失败不中断；`trimCache` 按插入顺序裁剪到 120 条；离线兜底最终返回 503 而不是 `undefined`；`opaque` 响应不缓存。 |

### 10.3 P2（16 项，全部完成）

| ID | 修复内容 |
|---|---|
| P2-1 | 删除并 `git rm --cached` `frontend/package-lock.json`，只保留 `pnpm-lock.yaml`。 |
| P2-2 | `nul`/`frontend/nul` 已忽略；`scripts/__pycache__` 加忽略并移出索引；三份一次性前端报告移入 `docs/archive/`（新增 `docs/archive/README.md` 说明归档原因）。 |
| P2-3 | CI 新增 `gofmt -l` 门禁、`go vet ./...`、`go test -race ./...`，并在 build 步骤加 `-trimpath`。 |
| P2-4 | `build.sh`/`build.ps1` 统一注入 `-X main.version=$(cat version)`、`-trimpath`、`CGO_ENABLED=0`，平台清单统一为 5 个（linux amd64/arm64、windows amd64、darwin amd64/arm64）；`release.yml` 同样注入版本号；新增 `make test`/`make lint`。 |
| P2-5 | README 架构图与目录树按代码重写（6 条路由、`sites/douban/health` 处理器、`logging/security` 中间件）；CI 触发分支由 `main` 更正为 `master`；环境变量表补 `SITE_NAME`/`WARHUTV_CONFIG`/`TRUSTED_PROXIES`。 |
| P2-6 | `Load` 与 `Get` 共用 `sync.Once` + `loadMu`，消除重复加载与重复告警；配置文件 `0600` + 目录 `0700` + 原子写。 |
| P2-7 | `Home.tsx` 删除死 key `localStorage['bangumi_calendar']`，改为 `apiCacheStore`（IndexedDB）读取；`refreshData` 改 `Promise.allSettled` 并行，历史/收藏不再阻塞首屏。 |
| P2-8 | 后端校验 `wd` 长度 ≤100、`pg` ∈ [1,100]；前端聚合键改用 `normalizeString`（去空格+标点+小写），《片名》与「片名」不再分成两张卡。`sessionStorage` 写入已包 `try/catch`。 |
| P2-9 | `useDetailLoader` 改为查 `api_site` 判断源是否存在（不再用 `/^\d+$/` 误判数字 key）；删除 `getPlayableUrl` 的死参数 `sourceKey`；新增 `pickProbeUrl`（解析多线路取首个非空集，不再只认 `.m3u8`）；`useSourceSearch` 引入 `timersRef`/`later()`，卸载时清理所有定时器。 |
| P2-10 | `toast()` 透传 `duration`；`useAnnouncement` 的 `JSON.parse`/`setItem` 全部加 `try/catch` 并做结构校验；公告仅在点击遮罩本体时关闭（拖选不再误触），`setTimeout` 在卸载时清理。 |
| P2-11 | `VideoCard` 外层 `<Link>` 改为 `<div>` + 绝对定位 `<Link>` 覆盖层，`<button>` 不再是 `<a>` 的子节点；主题切换时同步 `<meta name="theme-color">`；公告/设置弹窗打开时锁 `body` 滚动。 |
| P2-12 | 删除无对应 `@font-face` 的 `'Inter'`/`font-['Anton']` 硬编码，改为 `@theme` 定义的 `--font-sans`/`--font-display` 本地字体栈（离线可用，不再"看起来有设计但没生效"）。 |
| P2-13 | 移除 `crossOrigin: 'anonymous'`（无 CORS 头的源会直接播放失败）；`NETWORK_ERROR` 加 3 次重试上限并 `onError` 提示用户换源，不再无限 `startLoad()`；修掉 cleanup 读 ref 与缺依赖告警。 |
| P2-14 | 弃用 `gin.Default()`，改 `gin.New()` + 自研 `RequestID`/`RequestLogger` 中间件：结构化单行日志（request id / method / path / status / latency / ip / ua），**不记录查询串**，搜索词不再进日志。 |
| P2-15 | `http.Server` 显式超时 + `signal.NotifyContext` + 10s `Shutdown`，`ListenAndServe` 错误走 `log.Fatalf` 而非被忽略。 |
| P2-16 | `proxy.go` 用自定义 `DialContext`（`guardedDialContext`）在**连接时**校验目标 IP，关闭 DNS rebinding TOCTOU；补 `100.64.0.0/10`（CGNAT）与 multicast；`CheckRedirect` 同样校验。 |

### 10.4 最终验证记录（2026-11-05）

| 命令 | 结果 |
|---|---|
| `cd frontend && pnpm run lint` | ✅ **0 errors**, 29 warnings（均为既有 hooks/refresh 风格告警） |
| `cd frontend && pnpm test` | ✅ 11 files / 74 tests passed |
| `cd frontend && pnpm exec tsc -b` | ✅ 无类型错误 |
| `cd backend && gofmt -l .` | ✅ 无输出 |
| `cd backend && go vet ./...` | ✅ 通过 |
| `cd backend && go test ./...` | ✅ config / handlers / services / utils 四包通过 |
| `cd backend && go build ./...` | ✅ 通过 |
| 冒烟：`PASSWORD=... ./warhutv` | ✅ 环境变量密码生效；缺失配置自动生成随机 secret；`/api/version` 返回注入版本 |
| `-tags embed` 二进制（内置 `frontend/dist`） | ✅ 构建成功；`/`、`/search` 返回 200 index.html，`/api/nonexistent` 404，`/placeholder.svg` 200，`/assets/` 404 |

接口级冒烟（`PORT=3141/3142`，独立临时 config，`PASSWORD=auditpass`）：

| 请求 | 结果 |
|---|---|
| `GET /api/version` | ✅ `{"version":"9.9.9"}`（ldflags 注入生效） |
| `GET /api/healthz` | ✅ `{"status":"ok","time":"..."}` |
| `GET /api/nonexistent` | ✅ **404**（原来 200 + index.html） |
| `GET /api/search`（不存在） | ✅ **404** |
| `GET /missing.jpg` / `/manifest.json` | ✅ **404**（白名单 ext 生效） |
| `GET /placeholder.svg` | ✅ 200 `image/svg+xml` |
| `GET /search`（SPA 路由） | ✅ 200 `text/html` |
| `GET /api/search/stream?wd=test`（无 token） | ✅ 401 |
| `POST /api/auth/login` 错 2 次 → 对 1 次 | ✅ 401/401/**200**（成功登录不消耗限流额度） |
| `GET /api/config`（已登录） | ✅ 含 `api_site`、`password_managed_by_env: true` |
| `POST /api/auth/password`（env 管理密码） | ✅ **409**（按设计拒绝） |
| `GET /api/search/stream?wd=test`（已登录，0 源） | ✅ `event: start` / `event: done` |
| `GET /api/douban/evil/path` | ✅ **404**「不支持的豆瓣接口」（白名单拦截） |
| `GET /api/douban/rexxar/api/v2/subject/recent_hot/movie?...` | ✅ 200（真实上游 3.3KB） |
| `GET /api/bangumi/calendar` | ✅ 200（5.2s：直连黑洞 4s 超时后镜像命中） |
| 日志格式 | ✅ `request id=... method=... path=... status=... latency_ms=...`，**不含查询串** |

> 新增测试：`backend/services/cache_test.go`（5 个）、`backend/config/config_test.go`（8 个，覆盖 env 覆盖/不落盘/改密/自动生成 secret）。

### 10.5 遗留事项（明确不在本次范围）

| 事项 | 说明 |
|---|---|
| Docker 镜像实地构建 | 本机未安装 Docker，两个 Dockerfile 只做了静态审查 + 与本地二进制相同路径的冒烟；`docker build` / `docker run` 需在 CI 或装有 Docker 的机器上跑一次确认。 |
| 历史 JWT secret 轮换 | `d298f50f...` 已从工作树移除，但仍存在于 git 历史（提交 `4626c1d`）。**已部署过的实例必须轮换 `JWT_SECRET`**；若要彻底清除历史，需 `git filter-repo` 重写历史（会改变所有 commit hash，属破坏性操作，未执行）。 |
| P3 架构项 | 前端 `store/` 与 `api/` 的边界、播放页 6 个 Hook 的进一步收敛、E2E 测试（Playwright）等，属长期改造，本次未动。 |
| 图片代理 | 海报仍由前端按 `doubanProxy` 设置拼 CDN 前缀（`utils/image.ts`），未走后端；这是有意的取舍（图片走 CDN 更快，且不涉及凭据）。 |

### 10.6 运行期追加修复（2026-11-06，实机跑起来后发现）

修复完 P0–P2 后按用户要求把项目实际跑起来（`http://127.0.0.1:3000`），用 headless Chrome + CDP 做真实交互冒烟，又发现并修掉两个问题：

| 问题 | 根因 | 修复 | 验证 |
|---|---|---|---|
| 首页点卡片没反应 | `frontend/src/components/VideoCard.tsx` 的 `PlayOverlay` 与导航 `<Link>` 同为 `z-[3]`、`absolute inset-0`，且渲染在 Link 之后 → 后画者赢得指针事件，`opacity-0` 时仍吞掉整卡点击 | `PlayOverlay` 根 div 加 `pointer-events-none`（可继承，内部播放圈一并穿透）；action buttons `z-[4]` 保留可点 | 新增 `frontend/src/components/VideoCard.test.tsx`（5 例，含"去掉修复后必失败"验证）；CDP 真实点击从 `NO NAVIGATION` 变为跳转到 `/search?wd=...`；`pnpm test` 12 files / **79 passed** |
| 搜索卡在 `24/27`（挂掉的源一直不返回） | 所有源共用 20s 全局 ctx，死源要等 20s 才 cancel；且前端两个页面都未注册 `onErrorEvent`，失败源不计入进度 | 后端每源独立 `context.WithTimeout(ctx, perSite)`，超时/失败即丢弃并计入 `completed`；`error` 事件带 `discarded`/`completed`/`total`；前端 `Search.tsx` 与 `useSourceSearch.ts` 补 `onErrorEvent` 更新进度条；DNS 预检改用有界 context（`IsBlockedHostContext`） | 实测 SSE（3s 时）：`done.completed=27/27`、总耗时 **3.05s**（原 20s+ 卡住）、16 `result` / 11 `error`（4 条标注「超时丢弃」）；`SEARCH_SITE_TIMEOUT=1` 时 1.01s / 20 条丢弃，证明可配；`backend/handlers/search_test.go` 覆盖默认值/解析/钳制/回退 |
| 搜「凡人」进度写"已找到 338 个"但标题写"0 个结果" | `Search.tsx` 的「精确匹配」默认开启，`isExactMatch` 把「凡人修仙传」等全滤空 | **默认关闭精确匹配**（`localStorage.getItem('searchExactMatch') === 'true'` 才开，兼容旧 `'false'` 值） | CDP 实测：关闭后 121 个 `/play` 链接 |

**超时预算是取舍**：实测 27 源里 11 个首包 >3s，其中 `www.ryzyw.com`(5.8s)、`mtzy.me`(5.6s)、`api.ukuapi88.com`(4.0s)、`bdzy1.com`(3.4s) 是**可用但慢**的源，3s 硬超时会误杀它们。因此做成 `SEARCH_SITE_TIMEOUT` 可配（接受 `10` 或 `2500ms`，钳制到 `0.5s`–`20s`），`.env.example` 与 README 环境变量表已同步。**应用户要求默认改为 10s**：兼顾上面几个慢但可用的源，同时仍远低于 20s 全局上限；要更快可自行调小。

同轮还确认了两项**非本项目缺陷**：`[Violation] Permissions policy violation: unload is not allowed ... @ 33402.js:1` 来自浏览器扩展/宿主注入（本项目只注册 `pagehide`/`beforeunload`，全仓库无 `33402.js`/`e.linster`）；播放页换源优选时 hls.js 直连第三方 m3u8 有 5 条 CORS 报错（上游无 `Access-Control-Allow-Origin`，属浏览器直连固有限制）。另纠正一次测试 URL 用错：`/play?site=...&ids=...` 应为 `/play/:site/:id`，用正确 URL 时播放页标题、50 个分集、详情均正常。

### 10.7 运行期删除功能（2026-11-06，用户要求）

用户要求「站点设置跟修改密码功能直接删除，所有相关代码删除」。这两项是 10.2 的 P1-12 新增的，现按产品决策**整体移除**（配置回到「只由 `data/config.json` / 环境变量离线维护」）：

| 层 | 删除内容 |
|---|---|
| 前端组件 | 删除 `frontend/src/components/SettingsDialog.tsx`（站点设置 + 修改密码两个 Tab 整文件）；`SettingsPanel.tsx` 移除两个菜单项、`SettingsDialog` 引用与 `dialogTab` 状态，保留豆瓣图片加速/默认聚合/退出 |
| 前端 API | `frontend/src/api/config.ts` 移除 `UpdateConfigPayload`、`updateConfig`、`changePassword`、`password_managed_by_env` 字段，只保留 `getConfig` |
| 前端类型 | `frontend/src/types/index.ts` 的 `SiteConfig` 移除 `password_managed_by_env` |
| 后端路由 | `backend/main.go` 移除 `POST /api/auth/password` 与 `POST /api/config` |
| 后端 handler | `backend/handlers/auth.go` 删除 `ChangePasswordRequest`/`minPasswordLength`/`ChangePassword` 及 `errors`/`fmt`/`log` import；`backend/handlers/config.go` 删除 `UpdateConfigRequest`/`validateAPISite`/`UpdateConfig` 及 `fmt`/`net/url`/`strings`/`services` import，`GetConfig` 不再返回 `password_managed_by_env` |
| 后端 config | `backend/config/config.go` 删除 `Path()`/`activePath`、`ErrPasswordManagedByEnv`/`PasswordManagedByEnv()`/`SetPassword()`、`ErrJWTSecretManagedByEnv`/`RotateJWTSecret()`、`Update()`、包级 `Save()`；保留 `Load`/`Get`/`Snapshot`/`JWTSecret`/`Password`/`(*Config).Save`（首次生成 secret 仍需） |
| 测试 | 删除 `backend/handlers/config_test.go`（只测 `validateAPISite`）；`backend/config/config_test.go` 删除两个 `SetPassword` 用例，`TestSaveKeepsFileSecretsWhenEnvOverrides` 改用 `Get().Save(path)` |
| 文档 | `README.md` 接口表删除两行、项目结构/FAQ 去掉"改密/站点设置"字样、配置优先级说明改写；`docs/` 下带 HISTORICAL 横幅的历史文档**保留原文**（记录当时状态，不重写历史） |

**验证**：lint / tsc / build / gofmt / go vet / go test 见下方最终验证表；本轮删除后重新执行一遍全量验证。

### 10.8 配置热重载（2026-11-07，用户要求）

删除在线改密/源管理 UI 后，「改配置必须重启」的体验变差，用户要求「加上热重载」。实现落在 `backend/config/config.go` + `backend/main.go`：

| 层 | 改动 |
|---|---|
| 配置模型 | 关键改动：`globalConfig` 指针**只在首次 `Load`/`Get` 时赋值一次**，之后 `Reload` 通过 `publish()->(*Config).applyFrom()` 在自身 `mu` 下**原地覆盖字段**（`SiteName`/`Announcement`/`Password`/`JWTSecret`/`APISite`/env 标志）。`Get()` 不再用 `sync.Once`，改为 `loadMu` 保护、仅 `globalConfig==nil` 时加载——读方永远持有稳定指针，重载无需在并发下换指针，从根上避免数据竞争。同时把「解析 + 应用 env」抽成纯函数 `resolveForLoad`/`applyEnv`，供 `Load` 与 `Reload` 复用 |
| `Reload(path)` | 严格重载：读文件 → `parseConfig` → `applyEnv(cfg, false)`（**不重新生成 jwt_secret**，否则会让所有在线会话失效）→ `validateConfig`（password/jwt_secret 为空或默认值即拒）→ `publish`。缺文件 / JSON 坏 / 不安全配置一律报错并**保持旧配置**，绝不写文件 |
| 监听器 | `Watch(ctx, path, sighup)`（`watchOnce` 保证单实例）：默认每 2s 用 **sha256 内容 hash** 比对（不是 mtime，避免编辑器 truncate+write 或同尺寸粗时间戳漏检），变化才 `Reload`；同一坏内容只报一次不刷屏。`CONFIG_WATCH_INTERVAL` 可配（纯秒数 / Go duration，钳制 `200ms`–`5m`，`0`/`off`/`false` 关轮询） |
| 信号 | `sighup_unix.go`（`//go:build !windows`）注册 SIGHUP 立即重载；`sighup_windows.go`（`//go:build windows`）返回 nil channel（Windows 靠轮询）。已 `GOOS=linux GOARCH=amd64 go build ./...` 交叉编译验证 unix tag 正确 |
| main | `signal.NotifyContext` 提前到 `config.Load` 之前（watcher 需要 ctx），`config.Watch(ctx, *configPath, sighup)` + `defer stopSighup()`；关停时 ctx.Done 同时停 watcher 与 server |
| 文档 | `.env.example` 增 `CONFIG_WATCH_INTERVAL`；`README.md` 增「热重载」小节 + 环境变量表一行，FAQ「登录密码/如何添加视频源」由「重启生效」改为「2s 内自动热重载」并保留 env 优先级的例外说明 |
| 测试 | `backend/config/config_test.go` 新增 7 例：原地重载后指针不变且值更新、env 优先级在重载后仍胜出、坏/不安全/缺文件被拒且旧值保留、重载不重新生成 secret、`WatchInterval` 解析/钳制/关闭/回退、`currentHash` 内容敏感 |

**设计取舍**：环境变量仍优先于文件——`PASSWORD`/`JWT_SECRET` 若由 env 注入，改文件不会覆盖（需重启），这是刻意的，避免一个落盘文件意外削弱进程级密钥。热重载只作用于「文件里维护、env 未占用」的字段。

**验证**：`gofmt -l` 无输出、`go vet ./...` 0、`go test ./...` 与 `go test -race ./...` 全包 ok、`go build ./...`（Windows）0、`GOOS=linux go build ./...` 0；隔离实例（:3133，500ms 轮询）实机冒烟确认改配置 2s 内生效、坏 JSON / `admin123` 被拒且旧配置与在线会话保留。

### 10.9 文档整理与清理（2026-11-07，用户要求）

用户要求「整理文档，然后删除过期、无用文档」。按「当前有效 + 历史归档」两类重新收敛 `docs/`，删除 6 份已过期的 HISTORICAL 根文档，并把 4 份保留文档里指向旧文档的失效引用改为指向当前代码 / 本文件第十节。

**删除（6 份，均为文件头带 ⚠️ HISTORICAL 横幅的历史快照）**：

| 文件 | 原角色 | 删除理由 |
|---|---|---|
| `docs/fix-plan.md` | 已知技术债务清单 | P0–P3 结论已在第十节逐项修复/落地，继续留着会误导新审查者 |
| `docs/code-review-search.md` | 搜索模块审查记录 | 一次性快照，结论已被 10.2 修复或取代 |
| `docs/code-review-play.md` | 播放模块审查记录 | 同上 |
| `docs/code-review-speedtest.md` | 测速模块审查记录 | 同上 |
| `docs/code-review-2026-07-08.md` | 早期全量审查 | 早于本基线，重复且过期 |
| `docs/SECURITY_AUDIT_REPORT.md` | 安全审计报告 | 结论已并入 P0/P1 与第十节 |

**保留（8 份）**：`docs/CODE_REVIEW_OVERVIEW.md`（索引）、`docs/code-review-guide.md`（总标准）、`docs/code-review-checklist.md`（速查卡）、`docs/project-review-2026-11-03.md`（本文件，当前基线）；`docs/archive/` 4 份（`README.md` + 3 份 2026-07 一次性报告，已声明不再维护，回链保留）。

**同步整理**：
- `docs/code-review-guide.md`：§0 项目状态由「lint 54 问题 / CI 无门禁 / embed 跑不了测试」等过期描述改为当前全绿事实；§2.2/§2.3/§2.4 的「参考」列由 `fix-plan.md`/`code-review-*.md` 改为当前代码位置（`config.go`/`proxy.go`/`search.go`/`eslint.config.js` 等）；§3、§6、§7 去掉旧文档引用，§7 重写为「当前有效 + 历史归档」两类清单。
- `docs/CODE_REVIEW_OVERVIEW.md`：交付物表补 `docs/archive/README.md` 与第十节 10.1–10.9 说明；核心规则与「仍需跟进」第 5 条去掉旧文档引用，改以本文件第十节为基线。
- `docs/project-review-2026-11-03.md`：§6.6 与附录 A 加注「已按 10.9 完成/删除」；本文其余作为「审查当时存在的文档」的历史叙述（内联代码，非链接）保留原样。

**验收**：全仓库 `*.md` grep 确认 `*.go` / `*.yml` / `README.md` 中无指向已删文档的引用；当前 4 份有效文档之间交叉链接（guide ↔ checklist ↔ overview ↔ project-review ↔ archive/README）目标全部存在，无断链。

---

> **一句话结论（审查时）：** 功能骨架与关键算法（搜索、聚合、换源续播）质量不错，但"交付层"（Docker/构建/CI/配置/部署文档）存在四个 P0 级断点，且仓库里有一个可导致认证绕过的已提交 JWT 密钥。
>
> **当前状态（2026-11-05 修复后）：** 上述 4 个 P0、16 个 P1、16 个 P2 已全部处理完毕，详见第十节"修复说明书"；lint / test / tsc / build / gofmt / go vet / go test 全部通过，接口级冒烟覆盖 404 语义、鉴权、限流、豆瓣白名单与 Bangumi 回退。
>
> **运行期追加（2026-11-06）：** 实机跑起来后又修掉"首页卡片点不动"与"搜索卡在 24/27"两个交互缺陷，详见 10.6；并按用户要求把「精确匹配」默认改为关闭、`SEARCH_SITE_TIMEOUT` 默认改为 10s。随后按用户要求**整体删除站点设置与修改密码功能及相关代码**，详见 10.7。服务现运行在 `http://127.0.0.1:3000`。
>
> **配置热重载与文档整理（2026-11-07）：** 加了 2s 轮询 + SIGHUP 的配置热重载（原地生效、坏配置拒绝、不重置会话密钥），详见 10.8；随后按用户要求整理文档、删除 6 份过期文档，`docs/` 收敛为「当前有效 4 份 + 历史归档 4 份」，详见 10.9。

