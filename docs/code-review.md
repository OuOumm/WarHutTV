# WarHutTV 代码审查报告

## 🔴 安全问题

### 1. `/api/search/stream` 无需认证

**位置**：`backend/main.go` 第 35 行

```go
api.GET("/search/stream", handlers.SearchStream)  // 无 AuthMiddleware
```

搜索结果包含所有源的 `vod_id`、`vod_pic`、`vod_name` 等信息，任何人都可以直接调用。SSE（EventSource）不支持自定义请求头，所以认证需要通过 query 参数传递 token（代码中已有 `token` 参数支持，但未启用校验）。

**建议**：在 `SearchStream` handler 内部校验 query 参数中的 `token`，或改用 WebSocket 替代 SSE。

---

### 2. `/api/config` 暴露所有源站 API 地址

**位置**：`backend/handlers/config.go` 第 10-17 行

```go
func GetConfig(c *gin.Context) {
    cfg := config.Get()
    c.JSON(http.StatusOK, gin.H{
        "api_site": cfg.APISite,  // 包含所有 API URL
    })
}
```

无需认证即可获取所有源站地址，可被爬虫利用。

**建议**：`GetConfig` 只返回 `site_name` 和 `announcement`，移除 `api_site` 字段；或加上认证中间件。

---

### 3. 默认密码 `admin123` + 默认 JWT Secret

**位置**：`backend/config/config.go` 第 34-35 行

```go
Password:     "admin123",
JWTSecret:    "change-me-in-production",
```

虽然支持环境变量 `PASSWORD` 和 `JWT_SECRET` 覆盖，但如果用户未设置，就是硬编码弱密码。

**建议**：启动时若检测到默认值，打印警告日志；或强制要求通过环境变量设置。

---

### 4. 登录接口无速率限制

**位置**：`backend/handlers/auth.go`

`POST /api/auth/login` 没有任何频率限制，可被暴力破解。

**建议**：加入基于 IP 的速率限制中间件（如 `gin-contrib/limiter`），限制每分钟最多 5 次尝试。

---

### 5. ProxySearch URL 拼接未转义

**位置**：`backend/services/proxy.go` 第 60 行

```go
url := fmt.Sprintf("%s?ac=detail&wd=%s&pg=%d", site.API, keyword, pg)
```

`keyword` 直接拼入 URL，含 `&`、`=`、`#` 等特殊字符会导致注入或请求异常。

**建议**：使用 `url.QueryEscape(keyword)` 转义。

---

## 🟡 性能问题

### 6. ProxyM3U8 把整个响应读入内存

**位置**：`backend/handlers/proxy.go` 第 55 行

```go
body, err := io.ReadAll(resp.Body)  // 无限大小读取
```

对于非 m3u8 的大文件（被误代理），会导致内存暴涨。

**建议**：加入大小检查，超过阈值（如 10MB）直接流式转发而非全部读入内存。

---

### 7. ProxyLogo 无大小限制

**位置**：`backend/handlers/proxy.go` 第 97 行

```go
io.Copy(c.Writer, resp.Body)  // 无限制流式传输
```

如果源站返回超大响应，会耗尽服务器带宽。

**建议**：使用 `io.LimitReader` 限制最大读取大小（如 5MB）。

---

### 8. Blob URL 泄漏（前端）

**位置**：`frontend/src/utils/adblock.ts`

```typescript
const blob = new Blob([...], { type: 'application/vnd.apple.mpegurl' });
return URL.createObjectURL(blob);
```

`fetchAndFilterM3U8` 创建 Blob URL，但播放器销毁时未调用 `revokeBlobUrl`。虽然有 `revokeBlobUrl` 工具函数，但未被使用。长时间使用会累积内存泄漏。

**建议**：在 `Player.tsx` 组件卸载时，对旧 URL 调用 `revokeBlobUrl`。

---

### 9. 直播频道缓存永不过期

**位置**：`backend/services/live.go` 第 18 行

```go
var channelCache = make(map[string]*LiveChannelsData)  // 无 TTL，无容量限制
```

内存缓存没有过期机制，频道数据可能永久陈旧。且没有最大容量限制，大量源会无限增长。

**建议**：加入 TTL（如 1 小时）和最大条目数限制，过期后自动清理。

---

### 10. SpeedTest 超时后资源清理不完整

**位置**：`frontend/src/utils/speedtest.ts`

```typescript
const timeout = setTimeout(() => {
    hls.destroy();
    video.remove();
    reject(new Error('Timeout'));
}, 5000);
```

`reject` 后 Promise 链上后续 `.then()` 仍可能执行，且 HLS 已触发的 `FRAG_LOADED` 事件可能导致双重 resolve。

**建议**：加入 `settled` 标志位，确保 Promise 只 resolve/reject 一次。

---

## 🟡 流程问题

### 11. `ProxyPlay` 忽略 `episode` 参数

**位置**：`backend/handlers/play.go` → `backend/services/proxy.go`

```go
func ProxyPlay(siteKey, vodID, episode string) (string, error) {
    // ...
    if len(playResult.List) > 0 {
        return playResult.List[0].URL, nil  // 永远返回第一个，episode 参数被忽略
    }
}
```

handler 传了 `episode` 参数，但 service 层完全没用它。虽然前端主要直接用 `vod_play_url`，但这个接口存在误导性。

**建议**：要么实现 episode 匹配逻辑，要么从 handler 和 service 中移除 `episode` 参数。

---

### 12. Config Save 并发写文件数据竞争

**位置**：`backend/config/config.go`

```go
func (c *Config) Save(path string) error {
    c.mu.RLock()
    defer c.mu.RUnlock()
    data, err := json.MarshalIndent(c, "", "  ")
    // ...
    return os.WriteFile(path, data, 0644)
}
```

`Save` 持 RLock，多个 goroutine 可以同时执行 `Save`，并发写同一个文件会导致数据损坏。

**建议**：`Save` 应使用 `c.mu.Lock()`（写锁），或使用文件锁。

---

### 13. config.Save 错误被静默忽略

**位置**：`backend/services/live.go` 第 79 行 等多处

```go
cfg.Save("data/config.json")  // 返回值未检查
```

多处调用 `Save` 不检查错误，磁盘满或权限问题会静默丢失配置。

**建议**：所有 `Save` 调用处检查返回值并记录日志。

---

## 🟢 可用性 / 代码质量

### 14. CORS `Allow-Origin: *` 不安全

**位置**：`backend/middleware/cors.go`

```go
c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
```

允许任意域名跨域访问 API，配合无认证的搜索接口，任何人都可以嵌入你的搜索服务。

**建议**：通过配置指定允许的域名列表，或至少在生产环境中限制为具体域名。

---

### 15. 前端 `NoRoute` 处理低效

**位置**：`backend/main.go`

```go
f, err := distFS.Open(filePath)
if err == nil {
    f.Close()  // Open + Close 只为检查文件存在
    http.FileServer(http.FS(distFS)).ServeHTTP(c.Writer, c.Request)
}
```

先 Open 检查存在再 Close 再 ServeHTTP，相当于请求处理了两次。

**建议**：使用 `fs.Stat` 替代 Open/Close 检查。

---

### 16. 直播流代理无响应头透传

**位置**：`backend/services/live.go` `ProxyLiveStream`

```go
w.Header().Set("Content-Type", resp.Header.Get("Content-Type"))
```

只透传了 `Content-Type`，丢失了 `Content-Length`、`Transfer-Encoding` 等头，可能导致播放器无法正确处理流。

**建议**：透传所有必要的响应头，或使用 `httputil.ReverseProxy`。

---

### 17. 两个 `defaultUA` 常量重复定义

**位置**：`backend/services/live.go` 和 `backend/handlers/proxy.go`

```go
// live.go
const defaultUA = "AptvPlayer/1.4.10"

// proxy.go
const defaultUA = "Mozilla/5.0"
```

同名常量在不同包中定义，值不同，容易混淆。

**建议**：统一 UA 常量，或通过配置管理。

---

### 18. `config.Get()` 不是线程安全的初始化

**位置**：`backend/config/config.go`

```go
func Get() *Config {
    if globalConfig == nil {
        Load("data/config.json")  // 多个 goroutine 可能同时进入
    }
    return globalConfig
}
```

`globalConfig == nil` 检查没有锁保护，多个 goroutine 可能同时调用 `Load`，导致数据竞争。

**建议**：使用 `sync.Once` 保证只初始化一次。
