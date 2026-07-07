# WarHutTV 项目问题修复建议

本文档基于当前项目体检结果整理，用于后续按优先级修复。

## 修复优先级总览

| 优先级 | 问题 | 影响 | 建议处理 |
|---|---|---|---|
| P0 | 后端干净源码下无法直接 `go test ./...` | 阻塞后端测试、CI 和 IDE 工具链 | 调整 `embed` 策略，避免测试依赖前端构建产物 |
| P0 | 前端调用不存在的 `/api/proxy/m3u8` | 部分播放路径会失败 | 实现后端代理或移除前端代理路径 |
| P0 | 默认弱密码和固定 JWT Secret | 部署安全风险 | 首次启动强制生成 / 拒绝默认值 |
| P1 | CORS 配置不规范 | 跨域行为不稳定 | 去掉 credentials 或改为 Origin 白名单 |
| P1 | SSE token 放在 URL query | token 易进入日志、历史记录 | 改用短期 token 或 fetch stream |
| P1 | 配置读写锁使用不一致 | 并发读写 map 可能 panic / data race | 提供配置快照和统一更新方法 |
| P1 | 第三方 API 请求无状态码和大小检查 | 错误不可观测，可能内存风险 | 检查状态码、限制响应体大小 |
| P2 | 前端 lint 大面积失败 | 质量门禁缺失，潜在 bug 累积 | 分批修复或调整 ESLint 策略 |
| P2 | Bangumi 错误统一返回 200 空数组 | 掩盖故障 | 返回明确错误或 502 |
| P3 | 仓库存在构建产物 / 本地数据痕迹 | 仓库膨胀、误提交风险 | 清理已跟踪产物，完善忽略规则 |
| P3 | README / spec 与实际版本不一致 | 新开发者环境误导 | 统一 Go / Node / Vite / React 版本说明 |

---

## P0 修复项

### 1. 后端无法直接运行测试

#### 现象

执行：

```bash
cd backend && go test ./...
```

失败：

```text
main.go:16:12: pattern frontend/dist/*: no matching files found
```

#### 根因

`backend/main.go` 使用：

```go
//go:embed frontend/dist/*
var frontendFS embed.FS
```

但仓库中默认不存在 `backend/frontend/dist/*`，Go embed 要求匹配路径在编译期存在。

#### 推荐修复

优先推荐拆分静态资源 embed 逻辑：

1. 把路由注册从 `main.go` 抽出为 `setupRouter()`。
2. 将前端静态资源挂载逻辑独立到 build tag 文件中：
   - `static_embed.go`：release 构建使用，包含 `//go:embed`。
   - `static_dev.go`：开发 / 测试使用，返回空实现或本地文件系统。
3. 后端测试默认不依赖前端构建产物。

短期方案：在仓库中保留 `backend/frontend/dist/index.html` 占位文件，确保 embed 匹配成功。但该方案仍会让后端测试依赖前端路径，只适合临时过渡。

#### 验收标准

```bash
cd backend && go test ./...
```

在不预先构建前端的情况下通过。

---

### 2. 前端引用不存在的 M3U8 代理接口

#### 现象

`frontend/src/pages/Play.tsx` 中生成：

```ts
/api/proxy/m3u8?url=...
```

但后端没有注册 `/api/proxy/m3u8` 路由。

#### 影响

当逻辑进入代理分支时，播放器可能请求到不存在的接口，返回 404 或 SPA fallback 的 `index.html`，最终导致 HLS 播放失败。

#### 推荐修复方案 A：实现后端 M3U8 代理

新增：

```text
GET /api/proxy/m3u8?url=<encoded-url>
```

要求：

- 必须鉴权，避免开放代理。
- 仅允许 `http` / `https` URL。
- 防 SSRF：禁止访问 localhost、内网 IP、链路本地地址、云元数据地址。
- 限制响应体大小。
- 对 m3u8 内部相对路径做绝对化或代理重写。
- 返回正确 `Content-Type: application/vnd.apple.mpegurl`。

#### 推荐修复方案 B：移除前端代理分支

如果暂不实现代理，可将前端 `getPlayableUrlModule()` 中的代理返回改为直接返回原始 URL：

```ts
return url;
```

该方案简单，但不能解决跨域播放和 m3u8 相对路径问题。

#### 验收标准

- 关闭去广告后仍能播放 m3u8。
- `/api/proxy/m3u8` 不再返回 404 或 HTML。
- 后端代理不存在 SSRF 风险。

---

### 3. 默认弱密码和固定 JWT Secret

#### 现象

默认配置包含：

```go
Password:  "admin123"
JWTSecret: "change-me-in-production"
```

示例配置也包含相同默认值。

#### 风险

- 用户直接部署示例配置后，默认密码可被猜测。
- 固定 JWT secret 会导致 token 可伪造。
- 当前后端没有阻止生产环境使用默认 secret。

#### 推荐修复

1. 启动时检查配置：
   - 如果 `password == "admin123"`，输出高危警告。
   - 如果 `jwt_secret == "change-me-in-production"` 或为空，拒绝启动或自动生成随机 secret。
2. 首次启动无 `data/config.json` 时自动生成强随机 `jwt_secret`。
3. README 明确标注生产部署必须修改默认密码。
4. 中长期建议把密码改为 hash 存储，而不是明文配置。

#### 验收标准

- 默认 secret 不会在生产环境静默使用。
- 新生成配置中的 `jwt_secret` 至少 32 字节随机值。
- README 配置说明与实际行为一致。

---

## P1 修复项

### 4. CORS 配置不规范

#### 现状

`backend/middleware/cors.go`：

```go
Access-Control-Allow-Origin: *
Access-Control-Allow-Credentials: true
```

#### 问题

浏览器规范不允许 `*` 和 credentials 同时使用。

#### 推荐修复

如果当前只使用 Bearer token，删除：

```go
Access-Control-Allow-Credentials: true
```

如果未来要使用 cookie：

- 读取请求 `Origin`。
- 与白名单匹配。
- 匹配后回显具体 Origin。
- 设置 `Vary: Origin`。

#### 验收标准

- 不再同时返回 `*` 和 `Allow-Credentials: true`。
- 浏览器跨域请求无 CORS 警告。

---

### 5. SSE token 放在 URL query

#### 现状

前端使用：

```ts
const url = `/api/search/stream?wd=${encodeURIComponent(wd)}&token=${token}`;
const eventSource = new EventSource(url);
```

#### 风险

JWT 会出现在浏览器历史、服务端访问日志、反向代理日志和监控采集的 URL 中。

#### 推荐修复

优先推荐改为 `fetch` + `ReadableStream`：

- 请求头使用 `Authorization: Bearer <token>`。
- 前端手动解析 SSE 数据流。
- 后端沿用统一鉴权逻辑。

短期折中：

- 新增短期 SSE token 接口，例如 `/api/auth/sse-token`。
- SSE token 有效期 1-5 分钟，只能用于搜索流。
- URL 中不再暴露主 JWT。

#### 验收标准

- 主 JWT 不再出现在搜索流 URL 中。
- token 泄露窗口显著降低。

---

### 6. 配置读写锁使用不一致

#### 现状

`Config` 中有 `mu sync.RWMutex`，但调用方大量直接读写字段。搜索接口可能遍历 `cfg.APISite`，配置更新接口同时替换 `cfg.APISite`，存在 data race 和 map 并发读写 panic 风险。

#### 推荐修复

在 `config` 包提供快照方法：

```go
func Snapshot() Config
```

要求：

- 持 `RLock`。
- 深拷贝 `APISite` map。
- 调用方只读取快照，不直接访问全局 map。

更新配置统一走方法，例如：

```go
func Update(req UpdateConfigRequest) error
```

#### 验收标准

- 所有读取配置的 handler / service 不直接遍历全局 `APISite`。
- `go test -race ./...` 不报告配置相关 data race。

---

### 7. 第三方 API 请求缺少状态码和响应大小检查

#### 现状

`backend/services/proxy.go` 直接读取全部响应体并反序列化：

```go
body, err := io.ReadAll(resp.Body)
json.Unmarshal(body, &result)
```

#### 风险

- 404 / 500 HTML 错误页被当作 JSON 解析失败。
- 大响应可能造成内存压力。
- 错误信息不包含状态码，排障困难。

#### 推荐修复

- 检查 `resp.StatusCode` 是否在 200-299。
- 用 `io.LimitReader` 限制响应体大小，例如 10MB。
- 错误中带状态码和有限响应摘要。
- 配置 URL 保存时做基本 URL 校验。

#### 验收标准

- 第三方非 2xx 返回明确错误。
- 超大响应不会无限读入内存。
- 前端可展示更准确的源错误。

---

## P2 修复项

### 8. 前端 lint 大面积失败

#### 当前结果

执行：

```bash
cd frontend && npm run lint
```

结果：

```text
54 problems (51 errors, 3 warnings)
```

主要问题：

- `@typescript-eslint/no-explicit-any`
- `react-hooks/set-state-in-effect`
- `react-hooks/immutability`
- `react-refresh/only-export-components`
- `no-empty`
- `no-useless-escape`

#### 推荐修复顺序

1. 先修真实 bug 和低风险项：
   - 空 catch 改成注释或日志。
   - 未使用表达式改为明确语句。
   - 函数声明移动到 effect 前，或用 `useCallback` 包裹。
2. 再修类型：
   - 为 Douban API 响应补充接口。
   - `LazyGrid` 改成泛型组件。
   - store 中缓存数据使用 `unknown` 或泛型。
3. 最后处理 React hooks 新规则：
   - 明确哪些规则适合项目。
   - 对不符合当前架构的规则，考虑在 ESLint 配置中降级或关闭。

#### CI 建议

在 lint 修复完成后，将以下步骤加入 `.github/workflows/ci.yml`：

```yaml
- name: Lint Frontend
  working-directory: frontend
  run: npm run lint
```

---

### 9. Bangumi 接口错误处理不透明

#### 现状

`backend/handlers/bangumi.go` 在多个错误分支中返回：

```go
c.JSON(http.StatusOK, []interface{}{})
```

#### 问题

前端无法区分“没有数据”和“服务故障”。

#### 推荐修复

- 第三方请求失败返回 `502 Bad Gateway`。
- 响应体包含 `{ "error": "获取 Bangumi 日历失败" }`。
- 前端捕获错误后展示降级空状态。
- 缓存命中时做类型断言保护，避免 panic。

#### 验收标准

- Bangumi 第三方服务异常时，后端不再返回假成功。
- 前端能展示“服务暂不可用”或降级状态。

---

## P3 修复项

### 10. 清理构建产物和本地数据

#### 发现内容

工作区中存在：

- `bin/warhutv-linux-amd64`
- `bin/warhutv-windows-amd64.exe`
- `data/cache/*.json`
- `data/config.json`
- `frontend/nul`

`.gitignore` 已忽略部分内容，但仍建议确认是否已被 Git 跟踪。

#### 推荐修复

执行检查：

```bash
git ls-files bin data frontend/nul
```

如果这些文件已被跟踪，应使用：

```bash
git rm --cached <file>
```

保留本地文件但从版本库移除。

#### 验收标准

- 构建产物不再被 Git 跟踪。
- `data/config.json` 不进入版本库。
- 仓库只保留 `data/config.example.json`。

---

### 11. README / spec 与实际版本不一致

#### 现状

README 描述：

- Go 1.21+
- React 19
- Vite 6

实际配置：

- `backend/go.mod`: `go 1.26.2`
- CI: Go `1.26`
- Dockerfile: `golang:1.26-alpine`
- `frontend/package.json`: Vite `^8.1.0`

#### 推荐修复

- 统一 README、go.mod、CI、Dockerfile 中的版本要求。
- 如果 Go 1.26 是必需版本，README 明确说明。
- 如果不需要 Go 1.26，考虑降到当前稳定版本，并同步 CI / Dockerfile。
- 更新 Trellis spec 中对应版本说明。

#### 验收标准

- 新开发者按 README 准备环境可以成功构建。
- README、CI、Dockerfile、go.mod 版本一致。

---

## 建议修复顺序

1. 修复后端测试入口问题，让 `cd backend && go test ./...` 在干净 checkout 下可跑。
2. 补齐或移除 `/api/proxy/m3u8`，解决播放链路问题。
3. 修复默认密码 / JWT secret / CORS，建立安全基线。
4. 修复 config 并发访问和第三方 API 请求健壮性。
5. 决定前端 lint 策略，并分批修复 lint error。
6. 清理构建产物、本地缓存和版本说明。

## 已验证命令记录

```bash
cd frontend && npm run build
# 通过

cd frontend && npm run lint
# 失败：54 problems (51 errors, 3 warnings)

cd backend && go test ./...
# 干净状态失败：frontend/dist embed 文件缺失

cd backend && mkdir -p frontend && cp -r ../frontend/dist frontend/dist && go test ./...; rm -rf frontend
# 通过
```
