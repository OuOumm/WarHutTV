# WarHutTV (LunaTV Go复刻版) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use compose:subagent (recommended) or compose:execute to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 使用Go+Gin后端和React+Vite前端复刻LunaTV影视聚合播放器，支持多源搜索、在线播放、收藏、播放记录、直播和智能去广告功能。

**Architecture:** 
- 后端：Go + Gin框架，提供认证API、视频源配置管理、API代理（搜索/详情/播放）、直播流代理、静态文件服务
- 前端：React + Vite + Tailwind CSS SPA，IndexedDB存储收藏和播放记录，HLS.js + ArtPlayer播放器

**Tech Stack:** Go 1.21+, Gin, React 18, Vite, Tailwind CSS, HLS.js, ArtPlayer, IndexedDB (Dexie.js)

---

## File Structure

```
WarHutTV/
├── backend/
│   ├── main.go                    # 入口文件，启动Gin服务器
│   ├── go.mod                     # Go模块定义
│   ├── go.sum                     # 依赖锁定
│   ├── config/
│   │   ├── config.go              # 配置加载和解析
│   │   └── config.json            # 默认配置文件
│   ├── middleware/
│   │   ├── auth.go                # JWT认证中间件
│   │   └── cors.go                # CORS中间件
│   ├── handlers/
│   │   ├── auth.go                # 认证处理器（登录）
│   │   ├── search.go              # 搜索代理处理器
│   │   ├── detail.go              # 详情代理处理器
│   │   ├── play.go                # 播放URL代理处理器
│   │   ├── live.go                # 直播代理处理器
│   │   └── config.go              # 配置管理处理器
│   ├── services/
│   │   ├── proxy.go               # 视频源API代理服务
│   │   ├── adblock.go             # 广告过滤服务
│   │   └── live.go                # 直播流代理服务
│   └── utils/
│       └── jwt.go                 # JWT工具函数
├── frontend/
│   ├── package.json               # 前端依赖
│   ├── vite.config.ts             # Vite配置
│   ├── tsconfig.json              # TypeScript配置
│   ├── tailwind.config.js         # Tailwind配置
│   ├── index.html                 # 入口HTML
│   ├── src/
│   │   ├── main.tsx               # React入口
│   │   ├── App.tsx                # 主应用组件
│   │   ├── api/
│   │   │   ├── client.ts          # API客户端
│   │   │   └── auth.ts            # 认证API
│   │   ├── pages/
│   │   │   ├── Login.tsx          # 登录页
│   │   │   ├── Home.tsx           # 首页
│   │   │   ├── Search.tsx         # 搜索页
│   │   │   ├── Play.tsx           # 播放页
│   │   │   └── Live.tsx           # 直播页
│   │   ├── components/
│   │   │   ├── Layout.tsx         # 布局组件
│   │   │   ├── Sidebar.tsx        # 侧边栏
│   │   │   ├── VideoCard.tsx      # 视频卡片
│   │   │   ├── Player.tsx         # 播放器组件
│   │   │   ├── SearchBar.tsx      # 搜索栏
│   │   │   └── MobileNav.tsx      # 移动端导航
│   │   ├── hooks/
│   │   │   ├── useAuth.ts         # 认证钩子
│   │   │   └── useStorage.ts      # IndexedDB存储钩子
│   │   ├── store/
│   │   │   ├── auth.ts            # 认证状态管理
│   │   │   ├── favorites.ts       # 收藏状态管理
│   │   │   └── history.ts         # 播放历史管理
│   │   └── types/
│   │       └── index.ts           # 类型定义
│   └── public/
│       └── logo.png               # Logo文件
└── README.md
```

---

## Task 1: 项目初始化

**Covers:** 无（项目脚手架）

**Files:**
- Create: `backend/go.mod`
- Create: `backend/main.go`
- Create: `frontend/package.json`
- Create: `frontend/vite.config.ts`
- Create: `frontend/tsconfig.json`
- Create: `frontend/tailwind.config.js`
- Create: `frontend/index.html`
- Create: `frontend/src/main.tsx`
- Create: `frontend/src/App.tsx`

- [ ] **Step 1: 初始化Go后端模块**

```bash
cd backend
go mod init warhutv
go get github.com/gin-gonic/gin
go get github.com/golang-jwt/jwt/v5
go get github.com/rs/cors
```

- [ ] **Step 2: 创建后端入口文件**

```go
// backend/main.go
package main

import (
    "log"
    "os"
    
    "github.com/gin-gonic/gin"
)

func main() {
    port := os.Getenv("PORT")
    if port == "" {
        port = "3000"
    }
    
    r := gin.Default()
    
    // TODO: 添加路由和中间件
    
    log.Printf("Server starting on port %s", port)
    r.Run(":" + port)
}
```

- [ ] **Step 3: 初始化React前端**

```bash
cd frontend
npm create vite@latest . -- --template react-ts
npm install
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
npm install react-router-dom axios dexie
npm install artplayer hls.js
```

- [ ] **Step 4: 配置Tailwind CSS**

```js
// frontend/tailwind.config.js
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
```

- [ ] **Step 5: 配置Vite代理**

```typescript
// frontend/vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      }
    }
  }
})
```

- [ ] **Step 6: 验证前后端启动**

后端运行：
```bash
cd backend && go run main.go
```

前端运行：
```bash
cd frontend && npm run dev
```

- [ ] **Step 7: 提交初始化代码**

```bash
git add backend/ frontend/
git commit -m "chore: initialize project with Go backend and React frontend"
```

---

## Task 2: 后端配置系统

**Covers:** [S1] 视频源配置管理

**Files:**
- Create: `backend/config/config.go`
- Create: `backend/config/config.json`

- [ ] **Step 1: 创建默认配置文件**

```json
// backend/config/config.json
{
  "site_name": "WarHutTV",
  "announcement": "本网站仅提供影视信息搜索服务",
  "username": "",
  "password": "",
  "jwt_secret": "your-secret-key-change-in-production",
  "ad_block_enabled": true,
  "api_site": {
    "demo": {
      "api": "http://xxx.com/api.php/provide/vod",
      "name": "示例资源",
      "detail": "http://xxx.com"
    }
  }
}
```

- [ ] **Step 2: 创建配置加载器**

```go
// backend/config/config.go
package config

import (
    "encoding/json"
    "os"
    "sync"
)

type SiteConfig struct {
    API    string `json:"api"`
    Name   string `json:"name"`
    Detail string `json:"detail,omitempty"`
}

type Config struct {
    SiteName       string                `json:"site_name"`
    Announcement   string                `json:"announcement"`
    Username       string                `json:"username"`
    Password       string                `json:"password"`
    JWTSecret      string                `json:"jwt_secret"`
    AdBlockEnabled bool                  `json:"ad_block_enabled"`
    APISite        map[string]SiteConfig `json:"api_site"`
    
    mu sync.RWMutex
}

var (
    globalConfig *Config
    configOnce   sync.Once
)

func Load(path string) (*Config, error) {
    var err error
    configOnce.Do(func() {
        data, readErr := os.ReadFile(path)
        if readErr != nil {
            err = readErr
            return
        }
        
        globalConfig = &Config{}
        if jsonErr := json.Unmarshal(data, globalConfig); jsonErr != nil {
            err = jsonErr
            return
        }
        
        // 环境变量覆盖
        if pass := os.Getenv("PASSWORD"); pass != "" {
            globalConfig.Password = pass
        }
        if user := os.Getenv("USERNAME"); user != "" {
            globalConfig.Username = user
        }
        if secret := os.Getenv("JWT_SECRET"); secret != "" {
            globalConfig.JWTSecret = secret
        }
    })
    return globalConfig, err
}

func Get() *Config {
    if globalConfig == nil {
        Load("config/config.json")
    }
    return globalConfig
}

func (c *Config) Update(newConfig *Config) {
    c.mu.Lock()
    defer c.mu.Unlock()
    
    if newConfig.APISite != nil {
        c.APISite = newConfig.APISite
    }
    if newConfig.SiteName != "" {
        c.SiteName = newConfig.SiteName
    }
    if newConfig.Announcement != "" {
        c.Announcement = newConfig.Announcement
    }
    if newConfig.AdBlockEnabled {
        c.AdBlockEnabled = newConfig.AdBlockEnabled
    }
}

func (c *Config) Save(path string) error {
    c.mu.RLock()
    defer c.mu.RUnlock()
    
    data, err := json.MarshalIndent(c, "", "  ")
    if err != nil {
        return err
    }
    return os.WriteFile(path, data, 0644)
}
```

- [ ] **Step 3: 验证配置加载**

```bash
cd backend && go run main.go
```

控制台应无报错，配置成功加载。

- [ ] **Step 4: 提交配置系统**

```bash
git add backend/config/
git commit -m "feat: add config system with JSON loader and env override"
```

---

## Task 3: JWT认证系统

**Covers:** [S2] 单密码JWT认证

**Files:**
- Create: `backend/middleware/auth.go`
- Create: `backend/handlers/auth.go`
- Create: `backend/utils/jwt.go`

- [ ] **Step 1: 创建JWT工具函数**

```go
// backend/utils/jwt.go
package utils

import (
    "time"
    
    "github.com/golang-jwt/jwt/v5"
)

type Claims struct {
    Username string `json:"username"`
    jwt.RegisteredClaims
}

func GenerateToken(username, secret string, expiry time.Duration) (string, error) {
    claims := &Claims{
        Username: username,
        RegisteredClaims: jwt.RegisteredClaims{
            ExpiresAt: jwt.NewNumericDate(time.Now().Add(expiry)),
            IssuedAt:  jwt.NewNumericDate(time.Now()),
        },
    }
    
    token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
    return token.SignedString([]byte(secret))
}

func ValidateToken(tokenString, secret string) (*Claims, error) {
    token, err := jwt.ParseWithClaims(tokenString, &Claims{}, func(token *jwt.Token) (interface{}, error) {
        return []byte(secret), nil
    })
    
    if err != nil {
        return nil, err
    }
    
    if claims, ok := token.Claims.(*Claims); ok && token.Valid {
        return claims, nil
    }
    
    return nil, jwt.ErrSignatureInvalid
}
```

- [ ] **Step 2: 创建认证中间件**

```go
// backend/middleware/auth.go
package middleware

import (
    "net/http"
    "strings"
    
    "github.com/gin-gonic/gin"
    "warhutv/config"
    "warhutv/utils"
)

func AuthMiddleware() gin.HandlerFunc {
    return func(c *gin.Context) {
        authHeader := c.GetHeader("Authorization")
        if authHeader == "" {
            c.JSON(http.StatusUnauthorized, gin.H{"error": "未提供认证令牌"})
            c.Abort()
            return
        }
        
        tokenString := strings.TrimPrefix(authHeader, "Bearer ")
        if tokenString == authHeader {
            c.JSON(http.StatusUnauthorized, gin.H{"error": "无效的认证格式"})
            c.Abort()
            return
        }
        
        cfg := config.Get()
        claims, err := utils.ValidateToken(tokenString, cfg.JWTSecret)
        if err != nil {
            c.JSON(http.StatusUnauthorized, gin.H{"error": "无效的令牌"})
            c.Abort()
            return
        }
        
        c.Set("username", claims.Username)
        c.Next()
    }
}
```

- [ ] **Step 3: 创建登录处理器**

```go
// backend/handlers/auth.go
package handlers

import (
    "net/http"
    "time"
    
    "github.com/gin-gonic/gin"
    "warhutv/config"
    "warhutv/utils"
)

type LoginRequest struct {
    Password string `json:"password" binding:"required"`
}

func Login(c *gin.Context) {
    var req LoginRequest
    if err := c.ShouldBindJSON(&req); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": "密码不能为空"})
        return
    }
    
    cfg := config.Get()
    
    // 验证密码
    if req.Password != cfg.Password {
        c.JSON(http.StatusUnauthorized, gin.H{"error": "密码错误"})
        return
    }
    
    // 生成JWT Token
    token, err := utils.GenerateToken("admin", cfg.JWTSecret, 7*24*time.Hour)
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": "生成令牌失败"})
        return
    }
    
    c.JSON(http.StatusOK, gin.H{
        "token":     token,
        "expiresAt": time.Now().Add(7 * 24 * time.Hour).Unix(),
    })
}

func Verify(c *gin.Context) {
    username := c.GetString("username")
    c.JSON(http.StatusOK, gin.H{
        "valid":    true,
        "username": username,
    })
}
```

- [ ] **Step 4: 更新main.go添加认证路由**

```go
// backend/main.go (更新)
package main

import (
    "log"
    "os"
    
    "github.com/gin-gonic/gin"
    "warhutv/config"
    "warhutv/handlers"
    "warhutv/middleware"
)

func main() {
    // 加载配置
    _, err := config.Load("config/config.json")
    if err != nil {
        log.Printf("Warning: failed to load config: %v", err)
    }
    
    port := os.Getenv("PORT")
    if port == "" {
        port = "3000"
    }
    
    r := gin.Default()
    
    // 公开路由
    api := r.Group("/api")
    {
        api.POST("/auth/login", handlers.Login)
    }
    
    // 需要认证的路由
    auth := r.Group("/api")
    auth.Use(middleware.AuthMiddleware())
    {
        auth.GET("/auth/verify", handlers.Verify)
    }
    
    log.Printf("Server starting on port %s", port)
    r.Run(":" + port)
}
```

- [ ] **Step 5: 测试登录功能**

```bash
# 启动服务器
cd backend && go run main.go

# 测试登录（另一个终端）
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"password":"admin_password"}'

# 应返回 {"token":"xxx","expiresAt":xxx}
```

- [ ] **Step 6: 提交认证系统**

```bash
git add backend/middleware/ backend/handlers/ backend/utils/ backend/main.go
git commit -m "feat: add JWT authentication with single password"
```

---

## Task 4: 视频源API代理

**Covers:** [S3] 视频源搜索和详情代理

**Files:**
- Create: `backend/services/proxy.go`
- Create: `backend/handlers/search.go`
- Create: `backend/handlers/detail.go`
- Create: `backend/handlers/play.go`

- [ ] **Step 1: 创建代理服务**

```go
// backend/services/proxy.go
package services

import (
    "encoding/json"
    "fmt"
    "io"
    "net/http"
    "time"
    
    "warhutv/config"
)

type VideoItem struct {
    VodID   interface{} `json:"vod_id"`
    VodName string      `json:"vod_name"`
    VodPic  string      `json:"vod_pic"`
    VodYear string      `json:"vod_year"`
    VodRemarks string   `json:"vod_remarks"`
    TypeID  interface{} `json:"type_id"`
    TypeName string     `json:"type_name"`
}

type SearchResult struct {
    Code  int         `json:"code"`
    Msg   string      `json:"msg"`
    Total int         `json:"total"`
    List  []VideoItem `json:"list"`
}

type VideoDetail struct {
    VodID        interface{} `json:"vod_id"`
    VodName      string      `json:"vod_name"`
    VodPic       string      `json:"vod_pic"`
    VodYear      string      `json:"vod_year"`
    VodRemarks   string      `json:"vod_remarks"`
    VodContent   string      `json:"vod_content"`
    VodPlayFrom  string      `json:"vod_play_from"`
    VodPlayURL   string      `json:"vod_play_url"`
    TypeID       interface{} `json:"type_id"`
    TypeName     string      `json:"type_name"`
}

type DetailResult struct {
    Code int          `json:"code"`
    Msg  string       `json:"msg"`
    List []VideoDetail `json:"list"`
}

var client = &http.Client{
    Timeout: 10 * time.Second,
}

func ProxySearch(siteKey, keyword string, pg int) (*SearchResult, error) {
    cfg := config.Get()
    site, ok := cfg.APISite[siteKey]
    if !ok {
        return nil, fmt.Errorf("site not found: %s", siteKey)
    }
    
    url := fmt.Sprintf("%s?ac=detail&wd=%s&pg=%d", site.API, keyword, pg)
    return doRequest[SearchResult](url)
}

func ProxyDetail(siteKey, vodID string) (*DetailResult, error) {
    cfg := config.Get()
    site, ok := cfg.APISite[siteKey]
    if !ok {
        return nil, fmt.Errorf("site not found: %s", site.API)
    }
    
    url := fmt.Sprintf("%s?ac=detail&ids=%s", site.API, vodID)
    return doRequest[DetailResult](url)
}

func ProxyPlay(siteKey, vodID, episode string) (string, error) {
    cfg := config.Get()
    site, ok := cfg.APISite[siteKey]
    if !ok {
        return "", fmt.Errorf("site not found: %s", site.API)
    }
    
    url := fmt.Sprintf("%s?ac=play&ids=%s", site.API, vodID)
    // 播放URL通常需要额外处理，这里简化返回
    return url, nil
}

func doRequest[T any](url string) (*T, error) {
    resp, err := client.Get(url)
    if err != nil {
        return nil, err
    }
    defer resp.Body.Close()
    
    body, err := io.ReadAll(resp.Body)
    if err != nil {
        return nil, err
    }
    
    var result T
    if err := json.Unmarshal(body, &result); err != nil {
        return nil, err
    }
    
    return &result, nil
}
```

- [ ] **Step 2: 创建搜索处理器**

```go
// backend/handlers/search.go
package handlers

import (
    "net/http"
    "strconv"
    
    "github.com/gin-gonic/gin"
    "warhutv/services"
)

func Search(c *gin.Context) {
    site := c.Query("site")
    keyword := c.Query("wd")
    pg := 1
    
    if pgStr := c.Query("pg"); pgStr != "" {
        if p, err := strconv.Atoi(pgStr); err == nil {
            pg = p
        }
    }
    
    if keyword == "" {
        c.JSON(http.StatusBadRequest, gin.H{"error": "搜索关键词不能为空"})
        return
    }
    
    // 如果指定了站点，搜索该站点
    if site != "" {
        result, err := services.ProxySearch(site, keyword, pg)
        if err != nil {
            c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
            return
        }
        c.JSON(http.StatusOK, result)
        return
    }
    
    // 否则搜索所有站点
    cfg := config.Get()
    allResults := make(map[string]interface{})
    
    for siteKey := range cfg.APISite {
        result, err := services.ProxySearch(siteKey, keyword, pg)
        if err == nil {
            allResults[siteKey] = result
        }
    }
    
    c.JSON(http.StatusOK, allResults)
}
```

- [ ] **Step 3: 创建详情处理器**

```go
// backend/handlers/detail.go
package handlers

import (
    "net/http"
    
    "github.com/gin-gonic/gin"
    "warhutv/services"
)

func Detail(c *gin.Context) {
    site := c.Query("site")
    vodID := c.Query("ids")
    
    if site == "" || vodID == "" {
        c.JSON(http.StatusBadRequest, gin.H{"error": "缺少站点或视频ID"})
        return
    }
    
    result, err := services.ProxyDetail(site, vodID)
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
        return
    }
    
    c.JSON(http.StatusOK, result)
}
```

- [ ] **Step 4: 创建播放处理器**

```go
// backend/handlers/play.go
package handlers

import (
    "net/http"
    
    "github.com/gin-gonic/gin"
    "warhutv/services"
)

func Play(c *gin.Context) {
    site := c.Query("site")
    vodID := c.Query("ids")
    episode := c.Query("episode")
    
    if site == "" || vodID == "" {
        c.JSON(http.StatusBadRequest, gin.H{"error": "缺少站点或视频ID"})
        return
    }
    
    playURL, err := services.ProxyPlay(site, vodID, episode)
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
        return
    }
    
    c.JSON(http.StatusOK, gin.H{
        "url": playURL,
    })
}
```

- [ ] **Step 5: 更新main.go添加代理路由**

```go
// backend/main.go (更新auth组)
auth := r.Group("/api")
auth.Use(middleware.AuthMiddleware())
{
    auth.GET("/auth/verify", handlers.Verify)
    auth.GET("/search", handlers.Search)
    auth.GET("/detail", handlers.Detail)
    auth.GET("/play", handlers.Play)
}
```

- [ ] **Step 6: 测试搜索功能**

```bash
# 先登录获取token
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"password":"admin_password"}' | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

# 测试搜索
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3000/api/search?site=demo&wd=流浪地球"
```

- [ ] **Step 7: 提交代理系统**

```bash
git add backend/services/ backend/handlers/ backend/main.go
git commit -m "feat: add video source API proxy for search, detail, play"
```

---

## Task 5: 广告过滤服务

**Covers:** [S4] 智能去广告

**Files:**
- Create: `backend/services/adblock.go`

- [ ] **Step 1: 创建广告过滤服务**

```go
// backend/services/adblock.go
package services

import (
    "regexp"
    "strings"
)

// 广告特征关键词
var adPatterns = []string{
    "广告",
    "ad",
    "commercial",
    "sponsor",
    "promo",
    "skip",
    "pre-roll",
    "mid-roll",
}

// HLS广告段检测
type AdBlocker struct {
    enabled     bool
    adPattern   *regexp.Regexp
    segmentTime float64
}

func NewAdBlocker(enabled bool) *AdBlocker {
    return &AdBlocker{
        enabled:   enabled,
        adPattern: regexp.MustCompile(`(?i)(ad|commercial|sponsor|promo)`),
    }
}

// IsAdSegment 检测是否为广告片段
func (a *AdBlocker) IsAdSegment(segmentURI string) bool {
    if !a.enabled {
        return false
    }
    
    lowerURI := strings.ToLower(segmentURI)
    return a.adPattern.MatchString(lowerURI)
}

// FilterM3U8 过滤m3u8播放列表中的广告
func (a *AdBlocker) FilterM3U8(content string) string {
    if !a.enabled {
        return content
    }
    
    lines := strings.Split(content, "\n")
    var filtered []string
    skipNext := false
    
    for i, line := range lines {
        if skipNext {
            skipNext = false
            continue
        }
        
        // 检查是否为广告片段
        if strings.HasPrefix(line, "#") {
            // EXT-X-DISCONTINUITY 可能标记广告边界
            if strings.Contains(line, "DISCONTINUITY") {
                continue
            }
            filtered = append(filtered, line)
        } else if a.IsAdSegment(line) {
            // 跳过广告URI和下一个片段
            skipNext = true
            continue
        } else {
            filtered = append(filtered, line)
        }
        
        _ = i // 使用索引避免警告
    }
    
    return strings.Join(filtered, "\n")
}

// SetEnabled 动态开关广告过滤
func (a *AdBlocker) SetEnabled(enabled bool) {
    a.enabled = enabled
}

// IsEnabled 获取当前状态
func (a *AdBlocker) IsEnabled() bool {
    return a.enabled
}
```

- [ ] **Step 2: 集成到播放流程**

在 `backend/services/proxy.go` 中添加广告过滤：

```go
// 在文件顶部添加
var adBlocker *AdBlocker

func init() {
    cfg := config.Get()
    adBlocker = NewAdBlocker(cfg.AdBlockEnabled)
}

// 添加新函数
func GetFilteredPlayURL(siteKey, vodID, episode string) (string, error) {
    playURL, err := ProxyPlay(siteKey, vodID, episode)
    if err != nil {
        return "", err
    }
    
    // 如果是HLS流，过滤广告
    if strings.HasSuffix(playURL, ".m3u8") || strings.Contains(playURL, "m3u8") {
        // 获取m3u8内容并过滤
        resp, err := client.Get(playURL)
        if err != nil {
            return playURL, nil // 获取失败则返回原URL
        }
        defer resp.Body.Close()
        
        body, _ := io.ReadAll(resp.Body)
        filtered := adBlocker.FilterM3U8(string(body))
        
        // TODO: 缓存过滤后的m3u8或返回处理后的URL
        _ = filtered
    }
    
    return playURL, nil
}
```

- [ ] **Step 3: 添加广告过滤配置API**

```go
// backend/handlers/adblock.go
package handlers

import (
    "net/http"
    
    "github.com/gin-gonic/gin"
    "warhutv/services"
)

type AdBlockRequest struct {
    Enabled bool `json:"enabled"`
}

func GetAdBlockStatus(c *gin.Context) {
    cfg := config.Get()
    c.JSON(http.StatusOK, gin.H{
        "enabled": cfg.AdBlockEnabled,
    })
}

func SetAdBlockStatus(c *gin.Context) {
    var req AdBlockRequest
    if err := c.ShouldBindJSON(&req); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": "无效的请求"})
        return
    }
    
    cfg := config.Get()
    cfg.AdBlockEnabled = req.Enabled
    
    c.JSON(http.StatusOK, gin.H{
        "enabled": cfg.AdBlockEnabled,
        "message": "广告过滤设置已更新",
    })
}
```

- [ ] **Step 4: 更新main.go添加广告过滤路由**

```go
auth.GET("/adblock/status", handlers.GetAdBlockStatus)
auth.POST("/adblock/status", handlers.SetAdBlockStatus)
```

- [ ] **Step 5: 测试广告过滤**

```bash
# 获取广告过滤状态
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/adblock/status

# 开启广告过滤
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"enabled":true}' \
  http://localhost:3000/api/adblock/status
```

- [ ] **Step 6: 提交广告过滤**

```bash
git add backend/services/adblock.go backend/handlers/adblock.go
git commit -m "feat: add HLS ad blocking service"
```

---

## Task 6: 直播流代理

**Covers:** [S5] 直播功能

**Files:**
- Create: `backend/services/live.go`
- Create: `backend/handlers/live.go`

- [ ] **Step 1: 创建直播代理服务**

```go
// backend/services/live.go
package services

import (
    "io"
    "net/http"
    "time"
)

type LiveChannel struct {
    Name    string `json:"name"`
    URL     string `json:"url"`
    Logo    string `json:"logo,omitempty"`
    Group   string `json:"group,omitempty"`
}

var liveClient = &http.Client{
    Timeout: 30 * time.Second,
}

func ProxyLiveStream(url string, w http.ResponseWriter) error {
    req, err := http.NewRequest("GET", url, nil)
    if err != nil {
        return err
    }
    
    // 复制必要的请求头
    req.Header.Set("User-Agent", "Mozilla/5.0")
    
    resp, err := liveClient.Do(req)
    if err != nil {
        return err
    }
    defer resp.Body.Close()
    
    // 设置响应头
    w.Header().Set("Content-Type", resp.Header.Get("Content-Type"))
    w.Header().Set("Cache-Control", "no-cache")
    w.Header().Set("Connection", "keep-alive")
    
    // 流式传输
    _, err = io.Copy(w, resp.Body)
    return err
}
```

- [ ] **Step 2: 创建直播处理器**

```go
// backend/handlers/live.go
package handlers

import (
    "net/http"
    
    "github.com/gin-gonic/gin"
    "warhutv/services"
)

func GetLiveChannels(c *gin.Context) {
    // 从配置或外部源获取直播频道列表
    channels := []services.LiveChannel{
        {Name: "CCTV-1", URL: "http://example.com/cctv1.m3u8", Group: "央视频道"},
        {Name: "CCTV-5", URL: "http://example.com/cctv5.m3u8", Group: "央视频道"},
    }
    
    c.JSON(http.StatusOK, gin.H{
        "channels": channels,
    })
}

func StreamLive(c *gin.Context) {
    streamURL := c.Query("url")
    if streamURL == "" {
        c.JSON(http.StatusBadRequest, gin.H{"error": "缺少直播流URL"})
        return
    }
    
    // 代理直播流
    if err := services.ProxyLiveStream(streamURL, c.Writer); err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": "直播流获取失败"})
        return
    }
}
```

- [ ] **Step 3: 更新main.go添加直播路由**

```go
auth.GET("/live/channels", handlers.GetLiveChannels)
auth.GET("/live/stream", handlers.StreamLive)
```

- [ ] **Step 4: 测试直播功能**

```bash
# 获取直播频道列表
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/live/channels
```

- [ ] **Step 5: 提交直播功能**

```bash
git add backend/services/live.go backend/handlers/live.go
git commit -m "feat: add live stream proxy service"
```

---

## Task 7: CORS中间件

**Covers:** 跨域支持

**Files:**
- Create: `backend/middleware/cors.go`

- [ ] **Step 1: 创建CORS中间件**

```go
// backend/middleware/cors.go
package middleware

import (
    "github.com/gin-gonic/gin"
)

func CORSMiddleware() gin.HandlerFunc {
    return func(c *gin.Context) {
        c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
        c.Writer.Header().Set("Access-Control-Allow-Credentials", "true")
        c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Content-Length, Authorization, Accept, X-Requested-With")
        c.Writer.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS, GET, PUT, DELETE")
        
        if c.Request.Method == "OPTIONS" {
            c.AbortWithStatus(204)
            return
        }
        
        c.Next()
    }
}
```

- [ ] **Step 2: 更新main.go启用CORS**

```go
func main() {
    // ... 配置加载 ...
    
    r := gin.Default()
    r.Use(middleware.CORSMiddleware())
    
    // ... 路由配置 ...
}
```

- [ ] **Step 3: 提交CORS**

```bash
git add backend/middleware/cors.go backend/main.go
git commit -m "feat: add CORS middleware"
```

---

## Task 8: 前端认证模块

**Covers:** [S2] 登录页面和认证状态

**Files:**
- Create: `frontend/src/api/client.ts`
- Create: `frontend/src/api/auth.ts`
- Create: `frontend/src/hooks/useAuth.ts`
- Create: `frontend/src/store/auth.ts`
- Create: `frontend/src/pages/Login.tsx`
- Create: `frontend/src/types/index.ts`

- [ ] **Step 1: 创建类型定义**

```typescript
// frontend/src/types/index.ts
export interface LoginRequest {
  password: string;
}

export interface LoginResponse {
  token: string;
  expiresAt: number;
}

export interface VideoItem {
  vod_id: string | number;
  vod_name: string;
  vod_pic: string;
  vod_year?: string;
  vod_remarks?: string;
  type_id?: string | number;
  type_name?: string;
}

export interface SearchResult {
  code: number;
  msg: string;
  total: number;
  list: VideoItem[];
}

export interface VideoDetail {
  vod_id: string | number;
  vod_name: string;
  vod_pic: string;
  vod_year?: string;
  vod_remarks?: string;
  vod_content?: string;
  vod_play_from?: string;
  vod_play_url?: string;
  type_id?: string | number;
  type_name?: string;
}

export interface LiveChannel {
  name: string;
  url: string;
  logo?: string;
  group?: string;
}

export interface User {
  username: string;
  token: string;
  expiresAt: number;
}
```

- [ ] **Step 2: 创建API客户端**

```typescript
// frontend/src/api/client.ts
import axios from 'axios';

const apiClient = axios.create({
  baseURL: '/api',
  timeout: 10000,
});

// 请求拦截器 - 添加Token
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// 响应拦截器 - 处理401
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default apiClient;
```

- [ ] **Step 3: 创建认证API**

```typescript
// frontend/src/api/auth.ts
import apiClient from './client';
import { LoginRequest, LoginResponse } from '../types';

export const authApi = {
  login: async (data: LoginRequest): Promise<LoginResponse> => {
    const response = await apiClient.post('/auth/login', data);
    return response.data;
  },
  
  verify: async (): Promise<boolean> => {
    try {
      const response = await apiClient.get('/auth/verify');
      return response.data.valid;
    } catch {
      return false;
    }
  },
};
```

- [ ] **Step 4: 创建认证Hook**

```typescript
// frontend/src/hooks/useAuth.ts
import { useState, useEffect } from 'react';
import { authApi } from '../api/auth';

export const useAuth = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        setIsLoading(false);
        return;
      }
      
      const valid = await authApi.verify();
      setIsAuthenticated(valid);
      setIsLoading(false);
    };
    
    checkAuth();
  }, []);
  
  const login = async (password: string) => {
    const response = await authApi.login({ password });
    localStorage.setItem('token', response.token);
    localStorage.setItem('expiresAt', response.expiresAt.toString());
    setIsAuthenticated(true);
  };
  
  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('expiresAt');
    setIsAuthenticated(false);
  };
  
  return { isAuthenticated, isLoading, login, logout };
};
```

- [ ] **Step 5: 创建登录页面**

```tsx
// frontend/src/pages/Login.tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

const Login = () => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    try {
      await login(password);
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.error || '登录失败');
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900">
      <div className="w-full max-w-md p-8 bg-gray-800 rounded-lg shadow-xl">
        <h1 className="text-2xl font-bold text-white text-center mb-6">
          WarHutTV
        </h1>
        
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="请输入访问密码"
              className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
              disabled={loading}
            />
          </div>
          
          {error && (
            <div className="mb-4 text-red-500 text-sm">{error}</div>
          )}
          
          <button
            type="submit"
            disabled={loading || !password}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white font-medium rounded-lg transition-colors"
          >
            {loading ? '登录中...' : '进入'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;
```

- [ ] **Step 6: 测试登录流程**

```bash
cd frontend && npm run dev
```

访问 http://localhost:5173/login，输入密码测试登录。

- [ ] **Step 7: 提交认证模块**

```bash
git add frontend/src/api/ frontend/src/hooks/ frontend/src/pages/Login.tsx frontend/src/types/
git commit -m "feat: add frontend auth module with login page"
```

---

## Task 9: 前端IndexedDB存储

**Covers:** [S6] 收藏和播放记录

**Files:**
- Create: `frontend/src/store/favorites.ts`
- Create: `frontend/src/store/history.ts`
- Create: `frontend/src/hooks/useStorage.ts`

- [ ] **Step 1: 安装Dexie.js**

```bash
cd frontend && npm install dexie
```

- [ ] **Step 2: 创建数据库定义**

```typescript
// frontend/src/store/db.ts
import Dexie, { Table } from 'dexie';
import { VideoItem } from '../types';

export interface Favorite extends VideoItem {
  addedAt: number;
}

export interface WatchHistory extends VideoItem {
  watchedAt: number;
  progress?: number;
  duration?: number;
  episode?: string;
}

class WarHutTVDatabase extends Dexie {
  favorites!: Table<Favorite>;
  watchHistory!: Table<WatchHistory>;
  
  constructor() {
    super('WarHutTV');
    this.version(1).stores({
      favorites: '++id, vod_id, vod_name, addedAt',
      watchHistory: '++id, vod_id, vod_name, watchedAt',
    });
  }
}

export const db = new WarHutTVDatabase();
```

- [ ] **Step 3: 创建收藏存储**

```typescript
// frontend/src/store/favorites.ts
import { db, Favorite } from './db';
import { VideoItem } from '../types';

export const favoritesStore = {
  async add(video: VideoItem): Promise<void> {
    const exists = await db.favorites.where('vod_id').equals(video.vod_id).first();
    if (!exists) {
      await db.favorites.add({
        ...video,
        addedAt: Date.now(),
      });
    }
  },
  
  async remove(vodId: string | number): Promise<void> {
    await db.favorites.where('vod_id').equals(vodId).delete();
  },
  
  async toggle(video: VideoItem): Promise<boolean> {
    const exists = await db.favorites.where('vod_id').equals(video.vod_id).first();
    if (exists) {
      await this.remove(video.vod_id);
      return false;
    } else {
      await this.add(video);
      return true;
    }
  },
  
  async isFavorite(vodId: string | number): Promise<boolean> {
    const exists = await db.favorites.where('vod_id').equals(vodId).first();
    return !!exists;
  },
  
  async getAll(): Promise<Favorite[]> {
    return db.favorites.orderBy('addedAt').reverse().toArray();
  },
  
  async clear(): Promise<void> {
    await db.favorites.clear();
  },
};
```

- [ ] **Step 4: 创建播放历史存储**

```typescript
// frontend/src/store/history.ts
import { db, WatchHistory } from './db';
import { VideoItem } from '../types';

export const historyStore = {
  async add(video: VideoItem, episode?: string): Promise<void> {
    // 检查是否已存在
    const existing = await db.watchHistory.where('vod_id').equals(video.vod_id).first();
    
    if (existing) {
      // 更新记录
      await db.watchHistory.update(existing.id!, {
        watchedAt: Date.now(),
        episode: episode || existing.episode,
      });
    } else {
      // 添加新记录
      await db.watchHistory.add({
        ...video,
        watchedAt: Date.now(),
        episode,
      });
    }
  },
  
  async updateProgress(vodId: string | number, progress: number, duration: number): Promise<void> {
    const existing = await db.watchHistory.where('vod_id').equals(vodId).first();
    if (existing) {
      await db.watchHistory.update(existing.id!, {
        progress,
        duration,
      });
    }
  },
  
  async remove(vodId: string | number): Promise<void> {
    await db.watchHistory.where('vod_id').equals(vodId).delete();
  },
  
  async getAll(): Promise<WatchHistory[]> {
    return db.watchHistory.orderBy('watchedAt').reverse().toArray();
  },
  
  async getRecent(limit: number = 10): Promise<WatchHistory[]> {
    return db.watchHistory.orderBy('watchedAt').reverse().limit(limit).toArray();
  },
  
  async clear(): Promise<void> {
    await db.watchHistory.clear();
  },
};
```

- [ ] **Step 5: 提交存储模块**

```bash
cd frontend
npm install dexie
git add src/store/db.ts src/store/favorites.ts src/store/history.ts
git commit -m "feat: add IndexedDB storage for favorites and watch history"
```

---

## Task 10: 前端布局和导航

**Covers:** [S7] 响应式布局

**Files:**
- Create: `frontend/src/components/Layout.tsx`
- Create: `frontend/src/components/Sidebar.tsx`
- Create: `frontend/src/components/MobileNav.tsx`
- Create: `frontend/src/App.tsx`

- [ ] **Step 1: 创建布局组件**

```tsx
// frontend/src/components/Layout.tsx
import { ReactNode } from 'react';
import Sidebar from './Sidebar';
import MobileNav from './MobileNav';

interface LayoutProps {
  children: ReactNode;
}

const Layout = ({ children }: LayoutProps) => {
  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* 桌面侧边栏 */}
      <Sidebar />
      
      {/* 主内容区 */}
      <main className="lg:ml-64 pb-20 lg:pb-0">
        <div className="p-4 lg:p-6">
          {children}
        </div>
      </main>
      
      {/* 移动底部导航 */}
      <MobileNav />
    </div>
  );
};

export default Layout;
```

- [ ] **Step 2: 创建侧边栏组件**

```tsx
// frontend/src/components/Sidebar.tsx
import { NavLink } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

const Sidebar = () => {
  const { logout } = useAuth();
  
  const navItems = [
    { path: '/', label: '首页', icon: '🏠' },
    { path: '/search', label: '搜索', icon: '🔍' },
    { path: '/favorites', label: '收藏', icon: '❤️' },
    { path: '/history', label: '历史', icon: '📺' },
    { path: '/live', label: '直播', icon: '📡' },
  ];
  
  return (
    <aside className="hidden lg:flex flex-col w-64 h-screen fixed left-0 top-0 bg-gray-800 border-r border-gray-700">
      {/* Logo */}
      <div className="p-6 border-b border-gray-700">
        <h1 className="text-xl font-bold text-white">WarHutTV</h1>
      </div>
      
      {/* 导航链接 */}
      <nav className="flex-1 p-4">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-lg mb-2 transition-colors ${
                isActive
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:bg-gray-700 hover:text-white'
              }`
            }
          >
            <span>{item.icon}</span>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
      
      {/* 退出按钮 */}
      <div className="p-4 border-t border-gray-700">
        <button
          onClick={logout}
          className="w-full px-4 py-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
        >
          退出登录
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
```

- [ ] **Step 3: 创建移动导航**

```tsx
// frontend/src/components/MobileNav.tsx
import { NavLink } from 'react-router-dom';

const MobileNav = () => {
  const navItems = [
    { path: '/', label: '首页', icon: '🏠' },
    { path: '/search', label: '搜索', icon: '🔍' },
    { path: '/favorites', label: '收藏', icon: '❤️' },
    { path: '/history', label: '历史', icon: '📺' },
    { path: '/live', label: '直播', icon: '📡' },
  ];
  
  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-gray-800 border-t border-gray-700 z-50">
      <div className="flex justify-around">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `flex flex-col items-center py-3 px-4 ${
                isActive ? 'text-blue-500' : 'text-gray-400'
              }`
            }
          >
            <span className="text-xl">{item.icon}</span>
            <span className="text-xs mt-1">{item.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
};

export default MobileNav;
```

- [ ] **Step 4: 更新App.tsx**

```tsx
// frontend/src/App.tsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import Layout from './components/Layout';
import Login from './pages/Login';
import Home from './pages/Home';
import Search from './pages/Search';
import Play from './pages/Play';
import Live from './pages/Live';

const PrivateRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, isLoading } = useAuth();
  
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-white">加载中...</div>
      </div>
    );
  }
  
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" />;
};

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/"
          element={
            <PrivateRoute>
              <Layout>
                <Home />
              </Layout>
            </PrivateRoute>
          }
        />
        <Route
          path="/search"
          element={
            <PrivateRoute>
              <Layout>
                <Search />
              </Layout>
            </PrivateRoute>
          }
        />
        <Route
          path="/play/:site/:id"
          element={
            <PrivateRoute>
              <Layout>
                <Play />
              </Layout>
            </PrivateRoute>
          }
        />
        <Route
          path="/live"
          element={
            <PrivateRoute>
              <Layout>
                <Live />
              </Layout>
            </PrivateRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
```

- [ ] **Step 5: 测试布局**

```bash
cd frontend && npm run dev
```

检查侧边栏和移动导航是否正常显示。

- [ ] **Step 6: 提交布局组件**

```bash
git add frontend/src/components/ frontend/src/App.tsx
git commit -m "feat: add responsive layout with sidebar and mobile nav"
```

---

## Task 11: 前端页面实现

**Covers:** [S3, S4] 首页、搜索页、播放页

**Files:**
- Create: `frontend/src/pages/Home.tsx`
- Create: `frontend/src/pages/Search.tsx`
- Create: `frontend/src/pages/Play.tsx`
- Create: `frontend/src/components/VideoCard.tsx`
- Create: `frontend/src/components/SearchBar.tsx`
- Create: `frontend/src/components/Player.tsx`

- [ ] **Step 1: 创建视频卡片组件**

```tsx
// frontend/src/components/VideoCard.tsx
import { Link } from 'react-router-dom';
import { VideoItem } from '../types';

interface VideoCardProps {
  video: VideoItem;
}

const VideoCard = ({ video }: VideoCardProps) => {
  return (
    <Link
      to={`/play/${video.type_id || 'default'}/${video.vod_id}`}
      className="block bg-gray-800 rounded-lg overflow-hidden hover:ring-2 hover:ring-blue-500 transition-all"
    >
      <div className="aspect-video relative">
        <img
          src={video.vod_pic || '/placeholder.jpg'}
          alt={video.vod_name}
          className="w-full h-full object-cover"
          loading="lazy"
        />
        {video.vod_remarks && (
          <span className="absolute top-2 right-2 px-2 py-1 bg-blue-600 text-xs rounded">
            {video.vod_remarks}
          </span>
        )}
      </div>
      <div className="p-3">
        <h3 className="text-white font-medium truncate">{video.vod_name}</h3>
        <p className="text-gray-400 text-sm mt-1">
          {video.vod_year && <span>{video.vod_year}</span>}
          {video.type_name && <span className="ml-2">{video.type_name}</span>}
        </p>
      </div>
    </Link>
  );
};

export default VideoCard;
```

- [ ] **Step 2: 创建搜索栏组件**

```tsx
// frontend/src/components/SearchBar.tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const SearchBar = () => {
  const [keyword, setKeyword] = useState('');
  const navigate = useNavigate();
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (keyword.trim()) {
      navigate(`/search?wd=${encodeURIComponent(keyword.trim())}`);
    }
  };
  
  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <input
        type="text"
        value={keyword}
        onChange={(e) => setKeyword(e.target.value)}
        placeholder="搜索影片..."
        className="flex-1 px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
      />
      <button
        type="submit"
        className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
      >
        搜索
      </button>
    </form>
  );
};

export default SearchBar;
```

- [ ] **Step 3: 创建首页**

```tsx
// frontend/src/pages/Home.tsx
import { useState, useEffect } from 'react';
import SearchBar from '../components/SearchBar';
import VideoCard from '../components/VideoCard';
import { VideoItem } from '../types';
import { favoritesStore } from '../store/favorites';
import { historyStore } from '../store/history';

const Home = () => {
  const [recentHistory, setRecentHistory] = useState<VideoItem[]>([]);
  const [recentFavorites, setRecentFavorites] = useState<VideoItem[]>([]);
  
  useEffect(() => {
    loadData();
  }, []);
  
  const loadData = async () => {
    const history = await historyStore.getRecent(10);
    const favorites = await favoritesStore.getAll();
    setRecentHistory(history);
    setRecentFavorites(favorites.slice(0, 10));
  };
  
  return (
    <div>
      <SearchBar />
      
      {/* 继续观看 */}
      {recentHistory.length > 0 && (
        <section className="mt-8">
          <h2 className="text-xl font-bold text-white mb-4">继续观看</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {recentHistory.map((item) => (
              <VideoCard key={item.vod_id} video={item} />
            ))}
          </div>
        </section>
      )}
      
      {/* 我的收藏 */}
      {recentFavorites.length > 0 && (
        <section className="mt-8">
          <h2 className="text-xl font-bold text-white mb-4">我的收藏</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {recentFavorites.map((item) => (
              <VideoCard key={item.vod_id} video={item} />
            ))}
          </div>
        </section>
      )}
      
      {/* 空状态 */}
      {recentHistory.length === 0 && recentFavorites.length === 0 && (
        <div className="mt-16 text-center text-gray-400">
          <p className="text-lg">欢迎使用 WarHutTV</p>
          <p className="mt-2">使用搜索栏查找影片</p>
        </div>
      )}
    </div>
  );
};

export default Home;
```

- [ ] **Step 4: 创建搜索页**

```tsx
// frontend/src/pages/Search.tsx
import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import SearchBar from '../components/SearchBar';
import VideoCard from '../components/VideoCard';
import apiClient from '../api/client';
import { VideoItem } from '../types';

const Search = () => {
  const [searchParams] = useSearchParams();
  const keyword = searchParams.get('wd') || '';
  const [results, setResults] = useState<VideoItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  useEffect(() => {
    if (keyword) {
      searchVideos(keyword);
    }
  }, [keyword]);
  
  const searchVideos = async (wd: string) => {
    setLoading(true);
    setError('');
    
    try {
      const response = await apiClient.get('/search', {
        params: { wd }
      });
      
      // 处理多源结果
      const allResults: VideoItem[] = [];
      const data = response.data;
      
      if (Array.isArray(data)) {
        // 单站点结果
        allResults.push(...data);
      } else if (typeof data === 'object') {
        // 多站点结果
        Object.values(data).forEach((siteResult: any) => {
          if (siteResult?.list) {
            allResults.push(...siteResult.list);
          }
        });
      }
      
      setResults(allResults);
    } catch (err: any) {
      setError(err.response?.data?.error || '搜索失败');
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div>
      <SearchBar />
      
      <div className="mt-6">
        {loading && (
          <div className="text-center text-gray-400 py-8">
            搜索中...
          </div>
        )}
        
        {error && (
          <div className="text-center text-red-500 py-8">
            {error}
          </div>
        )}
        
        {!loading && !error && results.length === 0 && keyword && (
          <div className="text-center text-gray-400 py-8">
            未找到相关结果
          </div>
        )}
        
        {results.length > 0 && (
          <>
            <h2 className="text-lg text-gray-400 mb-4">
              搜索 "{keyword}" - 找到 {results.length} 个结果
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {results.map((item) => (
                <VideoCard key={`${item.vod_id}`} video={item} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Search;
```

- [ ] **Step 5: 创建播放器组件**

```tsx
// frontend/src/components/Player.tsx
import { useEffect, useRef } from 'react';
import Artplayer from 'artplayer';
import Hls from 'hls.js';

interface PlayerProps {
  url: string;
  title?: string;
}

const Player = ({ url, title }: PlayerProps) => {
  const artRef = useRef<HTMLDivElement>(null);
  const artInstance = useRef<Artplayer | null>(null);
  
  useEffect(() => {
    if (!artRef.current) return;
    
    // 销毁旧实例
    if (artInstance.current) {
      artInstance.current.destroy();
    }
    
    const art = new Artplayer({
      container: artRef.current,
      url: url,
      title: title || '播放中',
      type: url.endsWith('.m3u8') ? 'm3u8' : 'mp4',
      autoplay: true,
      pip: true,
      autoSize: true,
      autoMini: true,
      fullscreen: true,
      fullscreenWeb: true,
      subtitleOffset: true,
      miniProgressBar: true,
      mutex: true,
      backdrop: true,
      playsInline: true,
      autoPlayback: true,
      airplay: true,
      theme: '#2563eb',
      lang: navigator.language.toLowerCase() === 'zh-cn' ? 'zh-cn' : 'en',
      moreVideoAttr: {
        crossOrigin: 'anonymous',
      },
      settings: [
        {
          width: 200,
          html: '广告过滤',
          tooltip: '开启',
          switch: true,
          switchTips: '关闭',
          switchTips2: '开启',
          onSwitch: function (item: any) {
            item.switch = !item.switch;
            item.tooltip = item.switch ? '开启' : '关闭';
            return item.switch;
          },
        },
      ],
      hotkey: true,
      mutex: true,
      backdrop: true,
    });
    
    // HLS支持
    if (url.endsWith('.m3u8') && Hls.isSupported()) {
      const hls = new Hls();
      hls.loadSource(url);
      hls.attachMedia(art.video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        art.video.play();
      });
      
      art.on('destroy', () => {
        hls.destroy();
      });
    }
    
    artInstance.current = art;
    
    return () => {
      art.destroy();
    };
  }, [url, title]);
  
  return (
    <div ref={artRef} className="w-full aspect-video bg-black rounded-lg overflow-hidden" />
  );
};

export default Player;
```

- [ ] **Step 6: 创建播放页**

```tsx
// frontend/src/pages/Play.tsx
import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import Player from '../components/Player';
import apiClient from '../api/client';
import { VideoDetail } from '../types';
import { favoritesStore } from '../store/favorites';
import { historyStore } from '../store/history';

const Play = () => {
  const { site, id } = useParams<{ site: string; id: string }>();
  const [detail, setDetail] = useState<VideoDetail | null>(null);
  const [currentEpisode, setCurrentEpisode] = useState('');
  const [playUrl, setPlayUrl] = useState('');
  const [isFavorite, setIsFavorite] = useState(false);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    if (site && id) {
      loadDetail();
    }
  }, [site, id]);
  
  const loadDetail = async () => {
    setLoading(true);
    try {
      const response = await apiClient.get('/detail', {
        params: { site, ids: id }
      });
      
      const data = response.data;
      if (data?.list?.length > 0) {
        const videoDetail = data.list[0];
        setDetail(videoDetail);
        
        // 解析播放集数
        if (videoDetail.vod_play_url) {
          const episodes = videoDetail.vod_play_url.split('#');
          if (episodes.length > 0) {
            setCurrentEpisode(episodes[0]);
          }
        }
        
        // 检查收藏状态
        const fav = await favoritesStore.isFavorite(videoDetail.vod_id);
        setIsFavorite(fav);
        
        // 记录播放历史
        await historyStore.add(videoDetail);
      }
    } catch (err) {
      console.error('加载详情失败:', err);
    } finally {
      setLoading(false);
    }
  };
  
  const handleEpisodeClick = (episode: string) => {
    setCurrentEpisode(episode);
    // 获取播放URL
    loadPlayUrl(episode);
  };
  
  const loadPlayUrl = async (episode: string) => {
    try {
      const response = await apiClient.get('/play', {
        params: { site, ids: id, episode }
      });
      setPlayUrl(response.data.url);
    } catch (err) {
      console.error('获取播放URL失败:', err);
    }
  };
  
  const toggleFavorite = async () => {
    if (!detail) return;
    const result = await favoritesStore.toggle(detail);
    setIsFavorite(result);
  };
  
  if (loading) {
    return <div className="text-center text-gray-400 py-8">加载中...</div>;
  }
  
  if (!detail) {
    return <div className="text-center text-gray-400 py-8">未找到视频</div>;
  }
  
  return (
    <div>
      {/* 播放器 */}
      {playUrl && <Player url={playUrl} title={detail.vod_name} />}
      
      {/* 视频信息 */}
      <div className="mt-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-white">{detail.vod_name}</h1>
          <button
            onClick={toggleFavorite}
            className={`px-4 py-2 rounded-lg transition-colors ${
              isFavorite
                ? 'bg-red-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            {isFavorite ? '已收藏' : '收藏'}
          </button>
        </div>
        
        <p className="text-gray-400 mt-2">
          {detail.vod_year && <span>{detail.vod_year}</span>}
          {detail.type_name && <span className="ml-2">{detail.type_name}</span>}
          {detail.vod_remarks && <span className="ml-2">{detail.vod_remarks}</span>}
        </p>
        
        {detail.vod_content && (
          <p className="text-gray-400 mt-4 line-clamp-3">
            {detail.vod_content.replace(/<[^>]*>/g, '')}
          </p>
        )}
      </div>
      
      {/* 剧集列表 */}
      {detail.vod_play_url && (
        <div className="mt-6">
          <h2 className="text-lg font-bold text-white mb-3">播放列表</h2>
          <div className="flex flex-wrap gap-2">
            {detail.vod_play_url.split('#').map((episode, index) => (
              <button
                key={index}
                onClick={() => handleEpisodeClick(episode)}
                className={`px-3 py-1 rounded ${
                  currentEpisode === episode
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                {episode.split('$')[0] || `第${index + 1}集`}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default Play;
```

- [ ] **Step 7: 创建直播页**

```tsx
// frontend/src/pages/Live.tsx
import { useState, useEffect } from 'react';
import Player from '../components/Player';
import apiClient from '../api/client';
import { LiveChannel } from '../types';

const Live = () => {
  const [channels, setChannels] = useState<LiveChannel[]>([]);
  const [currentChannel, setCurrentChannel] = useState<LiveChannel | null>(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    loadChannels();
  }, []);
  
  const loadChannels = async () => {
    try {
      const response = await apiClient.get('/live/channels');
      setChannels(response.data.channels || []);
      if (response.data.channels?.length > 0) {
        setCurrentChannel(response.data.channels[0]);
      }
    } catch (err) {
      console.error('加载直播频道失败:', err);
    } finally {
      setLoading(false);
    }
  };
  
  if (loading) {
    return <div className="text-center text-gray-400 py-8">加载中...</div>;
  }
  
  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-6">直播</h1>
      
      <div className="flex gap-6">
        {/* 频道列表 */}
        <div className="w-full lg:w-64 bg-gray-800 rounded-lg p-4 max-h-[600px] overflow-y-auto">
          <h2 className="text-lg font-bold text-white mb-3">频道列表</h2>
          <div className="space-y-2">
            {channels.map((channel, index) => (
              <button
                key={index}
                onClick={() => setCurrentChannel(channel)}
                className={`w-full text-left px-3 py-2 rounded ${
                  currentChannel?.url === channel.url
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-300 hover:bg-gray-700'
                }`}
              >
                <div className="font-medium">{channel.name}</div>
                {channel.group && (
                  <div className="text-xs text-gray-400">{channel.group}</div>
                )}
              </button>
            ))}
          </div>
        </div>
        
        {/* 播放器 */}
        <div className="flex-1">
          {currentChannel ? (
            <>
              <Player url={currentChannel.url} title={currentChannel.name} />
              <div className="mt-4 text-gray-400">
                当前播放: {currentChannel.name}
              </div>
            </>
          ) : (
            <div className="text-center text-gray-400 py-8">
              请选择频道
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Live;
```

- [ ] **Step 8: 测试所有页面**

```bash
cd frontend && npm run dev
```

测试首页、搜索、播放、直播功能。

- [ ] **Step 9: 提交页面实现**

```bash
git add frontend/src/pages/ frontend/src/components/
git commit -m "feat: implement all frontend pages with search, play, live"
```

---

## Task 12: 前端状态管理集成

**Covers:** [S6] 收藏和历史页面

**Files:**
- Create: `frontend/src/pages/Favorites.tsx`
- Create: `frontend/src/pages/History.tsx`

- [ ] **Step 1: 创建收藏页**

```tsx
// frontend/src/pages/Favorites.tsx
import { useState, useEffect } from 'react';
import VideoCard from '../components/VideoCard';
import { VideoItem } from '../types';
import { favoritesStore } from '../store/favorites';

const Favorites = () => {
  const [favorites, setFavorites] = useState<VideoItem[]>([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    loadFavorites();
  }, []);
  
  const loadFavorites = async () => {
    const items = await favoritesStore.getAll();
    setFavorites(items);
    setLoading(false);
  };
  
  const handleRemove = async (vodId: string | number) => {
    await favoritesStore.remove(vodId);
    await loadFavorites();
  };
  
  if (loading) {
    return <div className="text-center text-gray-400 py-8">加载中...</div>;
  }
  
  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-6">我的收藏</h1>
      
      {favorites.length === 0 ? (
        <div className="text-center text-gray-400 py-8">
          暂无收藏
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {favorites.map((item) => (
            <div key={item.vod_id} className="relative group">
              <VideoCard video={item} />
              <button
                onClick={() => handleRemove(item.vod_id)}
                className="absolute top-2 left-2 px-2 py-1 bg-red-600 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity"
              >
                移除
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Favorites;
```

- [ ] **Step 2: 创建历史页**

```tsx
// frontend/src/pages/History.tsx
import { useState, useEffect } from 'react';
import VideoCard from '../components/VideoCard';
import { VideoItem } from '../types';
import { historyStore } from '../store/history';

const History = () => {
  const [history, setHistory] = useState<VideoItem[]>([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    loadHistory();
  }, []);
  
  const loadHistory = async () => {
    const items = await historyStore.getAll();
    setHistory(items);
    setLoading(false);
  };
  
  const handleClear = async () => {
    if (confirm('确定要清空播放历史吗？')) {
      await historyStore.clear();
      await loadHistory();
    }
  };
  
  if (loading) {
    return <div className="text-center text-gray-400 py-8">加载中...</div>;
  }
  
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">播放历史</h1>
        {history.length > 0 && (
          <button
            onClick={handleClear}
            className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
          >
            清空历史
          </button>
        )}
      </div>
      
      {history.length === 0 ? (
        <div className="text-center text-gray-400 py-8">
          暂无播放历史
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {history.map((item) => (
            <VideoCard key={item.vod_id} video={item} />
          ))}
        </div>
      )}
    </div>
  );
};

export default History;
```

- [ ] **Step 3: 更新App.tsx添加收藏和历史路由**

```tsx
// 在App.tsx中添加
import Favorites from './pages/Favorites';
import History from './pages/History';

// 在Routes中添加
<Route
  path="/favorites"
  element={
    <PrivateRoute>
      <Layout>
        <Favorites />
      </Layout>
    </PrivateRoute>
  }
/>
<Route
  path="/history"
  element={
    <PrivateRoute>
      <Layout>
        <History />
      </Layout>
    </PrivateRoute>
  }
/>
```

- [ ] **Step 4: 测试收藏和历史功能**

```bash
cd frontend && npm run dev
```

测试收藏添加/移除、播放历史记录。

- [ ] **Step 5: 提交收藏和历史**

```bash
git add frontend/src/pages/Favorites.tsx frontend/src/pages/History.tsx frontend/src/App.tsx
git commit -m "feat: add favorites and watch history pages"
```

---

## Task 13: 静态文件服务和部署

**Covers:** 生产环境部署

**Files:**
- Modify: `backend/main.go`
- Create: `Makefile`
- Create: `Dockerfile`

- [ ] **Step 1: 更新main.go添加静态文件服务**

```go
// backend/main.go (完整版)
package main

import (
    "log"
    "os"
    "path/filepath"
    
    "github.com/gin-gonic/gin"
    "warhutv/config"
    "warhutv/handlers"
    "warhutv/middleware"
)

func main() {
    // 加载配置
    _, err := config.Load("config/config.json")
    if err != nil {
        log.Printf("Warning: failed to load config: %v", err)
    }
    
    port := os.Getenv("PORT")
    if port == "" {
        port = "3000"
    }
    
    r := gin.Default()
    r.Use(middleware.CORSMiddleware())
    
    // API路由
    api := r.Group("/api")
    {
        api.POST("/auth/login", handlers.Login)
    }
    
    auth := r.Group("/api")
    auth.Use(middleware.AuthMiddleware())
    {
        auth.GET("/auth/verify", handlers.Verify)
        auth.GET("/search", handlers.Search)
        auth.GET("/detail", handlers.Detail)
        auth.GET("/play", handlers.Play)
        auth.GET("/live/channels", handlers.GetLiveChannels)
        auth.GET("/live/stream", handlers.StreamLive)
        auth.GET("/adblock/status", handlers.GetAdBlockStatus)
        auth.POST("/adblock/status", handlers.SetAdBlockStatus)
        auth.GET("/config", handlers.GetConfig)
        auth.POST("/config", handlers.UpdateConfig)
    }
    
    // 静态文件服务
    frontendDist := "../frontend/dist"
    if _, err := os.Stat(frontendDist); err == nil {
        r.Static("/assets", filepath.Join(frontendDist, "assets"))
        r.StaticFile("/favicon.ico", filepath.Join(frontendDist, "favicon.ico"))
        r.StaticFile("/logo.png", filepath.Join(frontendDist, "logo.png"))
        
        // SPA兜底路由
        r.NoRoute(func(c *gin.Context) {
            c.File(filepath.Join(frontendDist, "index.html"))
        })
    }
    
    log.Printf("Server starting on port %s", port)
    r.Run(":" + port)
}
```

- [ ] **Step 2: 创建配置处理器**

```go
// backend/handlers/config.go
package handlers

import (
    "net/http"
    
    "github.com/gin-gonic/gin"
    "warhutv/config"
)

func GetConfig(c *gin.Context) {
    cfg := config.Get()
    c.JSON(http.StatusOK, gin.H{
        "site_name":     cfg.SiteName,
        "announcement":  cfg.Announcement,
        "ad_block":      cfg.AdBlockEnabled,
        "api_site":      cfg.APISite,
    })
}

type UpdateConfigRequest struct {
    SiteName       *string                `json:"site_name,omitempty"`
    Announcement   *string                `json:"announcement,omitempty"`
    AdBlockEnabled *bool                  `json:"ad_block,omitempty"`
    APISite        *map[string]config.SiteConfig `json:"api_site,omitempty"`
}

func UpdateConfig(c *gin.Context) {
    var req UpdateConfigRequest
    if err := c.ShouldBindJSON(&req); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": "无效的请求"})
        return
    }
    
    cfg := config.Get()
    
    if req.SiteName != nil {
        cfg.SiteName = *req.SiteName
    }
    if req.Announcement != nil {
        cfg.Announcement = *req.Announcement
    }
    if req.AdBlockEnabled != nil {
        cfg.AdBlockEnabled = *req.AdBlockEnabled
    }
    if req.APISite != nil {
        cfg.APISite = *req.APISite
    }
    
    // 保存配置
    if err := cfg.Save("config/config.json"); err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": "保存配置失败"})
        return
    }
    
    c.JSON(http.StatusOK, gin.H{"message": "配置已更新"})
}
```

- [ ] **Step 3: 创建Makefile**

```makefile
# Makefile
.PHONY: build run clean dev

# 构建前端
build-frontend:
	cd frontend && npm run build

# 构建后端
build-backend:
	cd backend && go build -o ../bin/warhutv .

# 构建全部
build: build-frontend build-backend

# 运行
run:
	cd backend && go run main.go

# 开发模式
dev:
	cd frontend && npm run dev

# 清理
clean:
	rm -rf bin/ frontend/dist/ backend/warhutv

# Docker构建
docker:
	docker build -t warhutv .
```

- [ ] **Step 4: 创建Dockerfile**

```dockerfile
# Dockerfile
FROM node:18-alpine AS frontend-builder
WORKDIR /app
COPY frontend/ ./
RUN npm ci && npm run build

FROM golang:1.21-alpine AS backend-builder
WORKDIR /app
COPY backend/ ./
RUN go build -o warhutv .

FROM alpine:latest
RUN apk --no-cache add ca-certificates
WORKDIR /root/
COPY --from=backend-builder /app/warhutv .
COPY --from=frontend-builder /app/dist ./frontend/dist
COPY backend/config/config.json ./config/config.json

EXPOSE 3000
CMD ["./warhutv"]
```

- [ ] **Step 5: 测试构建**

```bash
# 构建前端
cd frontend && npm run build

# 运行后端
cd backend && go run main.go

# 访问 http://localhost:3000
```

- [ ] **Step 6: 提交部署配置**

```bash
git add backend/main.go backend/handlers/config.go Makefile Dockerfile
git commit -m "feat: add static file serving and deployment configs"
```

---

## Task 14: 环境变量和最终测试

**Covers:** 系统集成测试

**Files:**
- Create: `.env.example`
- Create: `README.md`

- [ ] **Step 1: 创建环境变量示例**

```bash
# .env.example
# 服务端口
PORT=3000

# 认证密码
PASSWORD=your_password_here

# 管理员用户名
USERNAME=admin

# JWT密钥（生产环境请修改）
JWT_SECRET=your-super-secret-jwt-key-change-this
```

- [ ] **Step 2: 创建README**

```markdown
# WarHutTV

基于Go+Gin和React+Vite的影视聚合播放器，复刻自LunaTV。

## 功能特性

- 多源聚合搜索
- 在线视频播放（HLS支持）
- 收藏管理（IndexedDB）
- 播放历史记录
- 直播频道播放
- 智能广告过滤
- 响应式布局

## 快速开始

### 环境要求

- Go 1.21+
- Node.js 18+

### 开发模式

```bash
# 后端
cd backend && go run main.go

# 前端
cd frontend && npm run dev
```

### 生产构建

```bash
# 构建全部
make build

# 运行
make run
```

### Docker部署

```bash
docker build -t warhutv .
docker run -p 3000:3000 -e PASSWORD=your_password warhutv
```

## 配置

编辑 `backend/config/config.json`：

```json
{
  "site_name": "WarHutTV",
  "password": "your_password",
  "api_site": {
    "site1": {
      "api": "http://example.com/api.php/provide/vod",
      "name": "示例资源"
    }
  }
}
```

## 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| PORT | 服务端口 | 3000 |
| PASSWORD | 访问密码 | - |
| USERNAME | 用户名 | admin |
| JWT_SECRET | JWT密钥 | - |

## License

MIT
```

- [ ] **Step 3: 最终测试**

```bash
# 启动服务
cd backend && go run main.go

# 在另一个终端构建前端
cd frontend && npm run build

# 访问 http://localhost:3000 测试完整功能
```

- [ ] **Step 4: 提交最终代码**

```bash
git add .env.example README.md
git commit -m "docs: add environment config and README"
```

---

## Summary

| Task | 内容 | 文件数 |
|------|------|--------|
| 1 | 项目初始化 | 9 |
| 2 | 后端配置系统 | 2 |
| 3 | JWT认证系统 | 4 |
| 4 | 视频源API代理 | 4 |
| 5 | 广告过滤服务 | 2 |
| 6 | 直播流代理 | 2 |
| 7 | CORS中间件 | 1 |
| 8 | 前端认证模块 | 6 |
| 9 | 前端IndexedDB存储 | 4 |
| 10 | 前端布局和导航 | 4 |
| 11 | 前端页面实现 | 6 |
| 12 | 前端状态管理集成 | 3 |
| 13 | 静态文件服务和部署 | 4 |
| 14 | 环境变量和最终测试 | 2 |
| **Total** | | **53** |
