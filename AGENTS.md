# WarHutTV — AGENTS.md

## Project Overview

WarHutTV 是一个自托管的媒体聚合播放器。它从多个第三方视频源聚合影视内容，提供统一的搜索、浏览和播放体验。用户可以通过该平台搜索来自不同资源站的电影、电视剧、动漫，浏览豆瓣影视榜单和 Bangumi 番组日历，以及观看直播电视频道。

核心功能包括：
- **跨源聚合搜索**：同时搜索多个视频源，支持按标题和年份聚合去重
- **影视浏览**：通过豆瓣分类浏览电影/电视剧/综艺/动漫，支持 Bangumi 番组日历每日放送
- **视频播放**：基于 DPlayer 的播放器，支持多播放线路切换
- **直播电视**：内置直播源频道浏览和播放
- **收藏与历史**：基于 IndexedDB（Dexie.js）的本地收藏和播放记录
- **多主题系统**：6 套深色视觉主题（绯红影院、影院金、星云紫、翡翠夜、极地冰、玫瑰绒），每套主题具有独特的纹理、光晕动画和卡片风格
- **播放源测速**：测试所有配置的视频源响应速度
- **广告过滤**：内置广告拦截功能
- **PWA 支持**：Service Worker 离线缓存支持

---

## Technology Stack

### Backend
| 组件 | 技术 |
|------|------|
| 语言 | Go 1.21+ |
| HTTP 框架 | Gin |
| 认证 | JWT（golang-jwt/jwt/v5） |
| 配置 | 环境变量 + JSON 文件 |
| 构建 | `go build`，`-ldflags="-s -w"` 压缩 |

### Frontend
| 组件 | 技术 |
|------|------|
| 语言 | TypeScript |
| UI 框架 | React 19 |
| 路由 | React Router DOM v6 |
| 构建工具 | Vite 6 |
| HTTP 客户端 | Axios |
| 本地存储 | Dexie.js（IndexedDB 封装） |
| 视频播放 | DPlayer |
| 样式 | Tailwind CSS（PostCSS） |
| 代码检查 | ESLint |

### DevOps
| 组件 | 技术 |
|------|------|
| 版本管理 | Git |
| CI/CD | GitHub Actions |
| 容器 | Docker（Dockerfile / Dockerfile.release） |
| 制品仓库 | GitHub Container Registry (GHCR) |
| 二进制压缩 | UPX（`--best --lzma`） |
| 跨平台构建 | GOOS/GOARCH 矩阵构建 |

---

## Project Structure

```
WarHutTV/
├── backend/                 # Go 后端
│   ├── config/              # 配置读取逻辑
│   │   └── config.go
│   ├── handlers/            # HTTP 请求处理器
│   │   ├── auth.go          #   登录认证
│   │   ├── config.go        #   站点配置
│   │   ├── search.go        #   跨源搜索
│   │   ├── play.go          #   播放地址解析
│   │   ├── detail.go        #   视频详情
│   │   ├── proxy.go         #   代理转发
│   │   ├── live.go          #   直播频道
│   │   ├── bangumi.go       #   Bangumi 番组数据
│   │   └── version.go       #   版本信息
│   ├── middleware/           # Gin 中间件
│   │   ├── auth.go          #   JWT 认证中间件
│   │   ├── cors.go          #   跨域配置
│   │   └── ratelimit.go     #   速率限制
│   ├── services/             # 业务逻辑层
│   │   ├── proxy.go         #   代理请求转发
│   │   ├── cache.go         #   文件缓存管理
│   │   └── live.go          #   直播源处理
│   ├── utils/                # 工具函数
│   │   └── jwt.go           #   JWT 令牌生成
│   ├── main.go              # 后端入口，路由注册
│   ├── go.mod
│   └── go.sum
│
├── frontend/                 # React 前端
│   ├── src/
│   │   ├── api/              # API 调用层
│   │   │   ├── client.ts    #   Axios 实例（baseURL、拦截器）
│   │   │   ├── auth.ts      #   登录/登出 API
│   │   │   ├── config.ts    #   站点配置 API
│   │   │   ├── douban.ts    #   豆瓣分类/推荐 API
│   │   │   └── bangumi.ts   #   Bangumi 番组 API
│   │   ├── components/       # 可复用组件
│   │   │   ├── Layout.tsx        #   页面布局（侧边栏 + 主内容区）
│   │   │   ├── Sidebar.tsx       #   导航侧边栏
│   │   │   ├── SearchBar.tsx     #   搜索输入框
│   │   │   ├── VideoCard.tsx     #   视频卡片展示
│   │   │   ├── Player.tsx        #   DPlayer 视频播放器
│   │   │   ├── LazyGrid.tsx      #   懒加载网格（IntersectionObserver）
│   │   │   ├── ThemeSwitcher.tsx  #   主题切换面板
│   │   │   ├── SettingsPanel.tsx  #   用户设置面板
│   │   │   ├── Announcement.tsx   #   站点公告弹窗
│   │   │   └── WeekdaySelector.tsx #   星期选择器（Bangumi 日历）
│   │   ├── pages/            # 页面组件
│   │   │   ├── Home.tsx      #   首页（热门推荐、最近播放）
│   │   │   ├── Search.tsx    #   聚合搜索结果页
│   │   │   ├── Play.tsx      #   视频播放页
│   │   │   ├── Douban.tsx    #   豆瓣影视广场（分类浏览 + Bangumi 日历）
│   │   │   ├── Live.tsx      #   直播频道页
│   │   │   ├── Login.tsx     #   登录页
│   │   │   ├── Favorites.tsx #   我的收藏
│   │   │   ├── History.tsx   #   播放历史
│   │   │   └── SpeedTest.tsx #   播放源测速
│   │   ├── store/            # 状态管理和本地存储
│   │   │   ├── auth.tsx      #   React Context 认证状态
│   │   │   ├── config.tsx    #   React Context 配置状态
│   │   │   ├── theme.ts      #   6 套主题定义 + CSS 变量应用
│   │   │   ├── db.ts         #   Dexie.js IndexedDB 数据库定义
│   │   │   ├── favorites.ts  #   收藏数据 CRUD
│   │   │   ├── history.ts    #   播放历史 CRUD
│   │   │   ├── apiCache.ts   #   API 缓存（带类型和 TTL）
│   │   │   └── detailCache.ts #   详情缓存（固定 2h TTL）
│   │   ├── hooks/            # 自定义 Hooks
│   │   │   ├── useAuth.ts    #   认证状态复用（重导出自 store/auth）
│   │   │   └── useVersionCheck.ts # 版本检查
│   │   ├── utils/            # 工具函数
│   │   │   ├── filter.ts     #   搜索结果过滤/聚合
│   │   │   ├── speedtest.ts  #   测速逻辑
│   │   │   ├── adblock.ts    #   广告拦截规则
│   │   │   └── image.ts      #   豆瓣图片 URL 代理处理
│   │   ├── types/            # TypeScript 类型定义
│   │   │   └── index.ts
│   │   ├── assets/           # 静态资源（如字体文件等）
│   │   ├── App.tsx           # 根组件（路由定义 + Provider 嵌套）
│   │   ├── main.tsx          # 前端入口
│   │   └── index.css         # Tailwind + CSS 变量 + 主题样式
│   ├── public/               # PWA 资源
│   │   ├── sw.js             #   Service Worker
│   │   ├── favicon.svg
│   │   ├── icon-{144,192,512}.png
│   │   ├── screenshot-desktop.png
│   │   └── screenshot-mobile.png
│   ├── index.html
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── tsconfig.app.json
│   ├── tsconfig.node.json
│   ├── eslint.config.js
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   └── package.json
│
├── data/
│   └── config.json           # 站点配置（视频源、直播源等）
│
├── bin/                      # 编译产物
│
├── docs/                     # 设计/评审文档
│
├── .github/workflows/
│   ├── ci.yml                # CI：push/PR 到 master 时构建验证
│   └── release.yml           # Release：打 v* tag 时构建发布
│
├── .env.example              # 环境变量模板
├── .gitignore
├── Makefile                  # 本地构建
├── build.sh                  # Linux/macOS 构建脚本
├── build.ps1                 # Windows 构建脚本
├── Dockerfile                # 开发 Docker 镜像
├── Dockerfile.release        # 发布用 Docker 镜像（多阶段）
├── version                   # 版本文件（当前 1.0.0）
└── README.md
```

---

## Backend Architecture

### Entry Point (`backend/main.go`)

Gin 路由注册，主要路径：
- `POST /api/auth/login` — 登录获取 JWT Token
- `GET  /api/config` — 获取站点配置（无需认证）
- `GET  /api/version` — 版本号
- `POST /api/douban/categories` — 豆瓣分类列表
- `POST /api/douban/recommends` — 豆瓣推荐
- `POST /api/bangumi/calendar` — Bangumi 番组日历
- `GET  /api/search` — 跨源搜索（需认证）
- `GET  /api/detail` — 视频详情（需认证）
- `GET  /api/play` — 播放地址解析（需认证）
- `GET  /api/live` — 直播频道列表（需认证）
- `GET  /api/proxy` — 代理转发（需认证）

### Configuration (`backend/config/config.go`)

配置读取优先级：
1. **环境变量**（PORT, PASSWORD, JWT_SECRET）
2. **`data/config.json`** — 站点列表、直播源、公告内容等

### Middleware
- **auth** — JWT Bearer Token 验证，`RequireAuth` 中间件保护需要登录的路由
- **cors** — 允许所有来源（开发友好）
- **ratelimit** — 基于 IP 的请求频率限制

### Data Flow

前端 → Axios → Go Handler → 请求第三方视频源 API → 返回处理后的数据

搜索流程：
1. 前端发送 `GET /api/search?site=xxx&wd=xxx`
2. 后端根据 `site` 参数转发到对应视频源的 API
3. 返回标准化的搜索结果列表
4. 前端对多个源的结果做聚合去重（`utils/filter.ts`）

---

## Frontend Architecture

### Routing (`App.tsx`)

```
/login          → Login 页面（公开）
/               → Home 首页（需认证）
/search         → Search 搜索（需认证）
/play/:id       → Play 播放（需认证）
/douban         → Douban 影视广场（需认证）
/live           → Live 直播（需认证）
/favorites      → Favorites 收藏（需认证）
/history        → History 历史（需认证）
/speedtest      → SpeedTest 测速（需认证）
```

认证路由通过 `<PrivateRoute>` 组件保护，未登录自动重定向到 `/login`。

### State Management

前端使用以下方式管理状态：

1. **React Context** — 认证状态（`AuthContext`）和站点配置（`ConfigContext`）
2. **localStorage** — 主题选择、设置偏好（豆瓣代理、聚合搜索开关）
3. **IndexedDB（Dexie.js）** — 收藏、播放历史、API 缓存、详情缓存

### API Client (`api/client.ts`)

- Axios 实例，`baseURL` 为相对路径 `/api`
- 请求拦截器自动附加 JWT Token
- 响应拦截器处理 401 自动跳转登录

### Cache Strategy

| 缓存类型 | 存储位置 | TTL |
|---------|---------|-----|
| Bangumi 日历 | IndexedDB | 24h |
| 站点配置 | IndexedDB | 24h |
| 直播源列表 | IndexedDB | 24h |
| 直播频道 | IndexedDB | 24h |
| Logo | IndexedDB | 7d |
| 搜索结果 | IndexedDB | 2h |
| 视频详情 | IndexedDB | 2h |

### Theme System

6 套预定义深色主题，每套包含：
- 7 种颜色变量（deep, card, surface, primary, primaryDim, primaryGlow, text, muted, glass, glassBorder）
- 3 层光晕颜色（glow1, glow2, glow3）
- 视觉风格：纹理（6种）、光晕动画（6种）、卡片风格（4种）、强调特效（6种）
- 主题通过 CSS 变量 `data-*` 属性应用到 `:root`

---

## Build and Test Commands

### Development

```bash
# 前端开发服务器
cd frontend && npm install && npm run dev

# 后端热重载开发
cd backend && go run .

# 构建生产版本
make build            # 或 ./build.sh / ./build.ps1
```

### Frontend Scripts

```json
{
  "dev": "vite",
  "build": "tsc -b && vite build",
  "preview": "vite preview",
  "lint": "eslint ."
}
```

### Production Build

```bash
# 1. 构建前端
cd frontend && npm ci && npm run build

# 2. 将前端产物复制到后端目录
# （构建脚本自动处理）

# 3. 编译 Go 后端
cd backend && go build -ldflags="-s -w" -trimpath -o ../bin/warhutv .
```

### Docker Build

```bash
docker build -t warhutv .                          # 开发镜像
docker build -f Dockerfile.release -t warhutv .     # 发布镜像
```

---

## CI/CD Pipeline

### CI (`ci.yml`)
- 触发条件：push / PR 到 `master` 分支
- 步骤：Checkout → Node 20 构建前端 → Go 1.21 编译后端 → 上传 Linux amd64 制品（保留 7 天）

### Release (`release.yml`)
- 触发条件：推送 `v*` 标签
- 3 个并行 Job：
  1. **build** — 矩阵构建 5 个平台：linux/amd64, linux/arm64, windows/amd64, darwin/amd64, darwin/arm64。每个编译后经 UPX 压缩，上传为 artifact
  2. **release** — 下载所有 artifact，打包为 `.tar.gz`（Linux/macOS）或 `.zip`（Windows），通过 `softprops/action-gh-release` 创建 GitHub Release，自动生成 Release Notes
  3. **docker** — 构建 linux/amd64 二进制，推送到 GHCR（`ghcr.io/<repo>`），打 `latest` 和 semver 标签

---

## Security Considerations

1. **认证**：所有非公开 API 均需 JWT Bearer Token，Token 在登录时通过密码验证签发
2. **密码配置**：通过环境变量 `PASSWORD` 设置，`JWT_SECRET` 应使用强随机字符串
3. **速率限制**：基于 IP 的请求频率限制，防止滥用
4. **CORS**：开发阶段允许所有来源，生产环境应考虑收紧
5. **编译安全**：Go 后端使用 `-s -w` 剥离符号表，`-trimpath` 移除构建路径信息
6. **依赖**：前端 React 19 + 后端 Go 均保持版本更新，无已知高危依赖
7. **前端安全**：所有图片 URL 经过 `processImageUrl` 处理，代理到可信 CDN

---

## Development Conventions

1. **语言**：项目注释和提交信息以中文为主，代码标识符使用英文
2. **Go 代码风格**：遵循标准 Go 格式化（`gofmt`），包名小写，错误处理使用 `if err != nil` 模式
3. **TypeScript 代码风格**：使用 TypeScript 严格模式，组件为函数式组件 + Hooks，类型定义集中在 `types/index.ts`
4. **CSS**：使用 Tailwind CSS 工具类 + CSS 变量实现主题化，不在组件中写内联样式（除动态主题值外）
5. **路由**：所有页面对应 `/src/pages/` 下的一个组件，布局统一在 `Layout.tsx` 中管理
6. **API 调用**：通过 `/src/api/` 下的模块封装，不直接在组件中调用 Axios
7. **存储操作**：所有 IndexedDB 操作通过 `/src/store/` 下的 Store 模块封装
8. **构建产物**：前端构建到 `frontend/dist/`，后端编译到 `bin/` 目录，两者均被 `.gitignore` 忽略
9. **版本管理**：版本号写入 `version` 文件，通过 `-ldflags` 注入 Go 二进制，前端通过 `__APP_VERSION__` 全局变量使用

---

## When Working on This Codebase

- **添加新页面**：在 `frontend/src/pages/` 创建组件，在 `App.tsx` 中添加路由
- **添加新 API**：在 `backend/handlers/` 创建 handler，在 `main.go` 注册路由，在 `frontend/src/api/` 添加对应客户端
- **修改主题**：编辑 `frontend/src/store/theme.ts` 中的主题定义，确保 CSS 变量名与 `index.css` 一致
- **修改数据缓存**：编辑 `frontend/src/store/apiCache.ts` 或 `detailCache.ts`，TTL 常量定义在文件顶部
- **修改视频源配置**：编辑 `data/config.json`
- **修改认证逻辑**：后端 `backend/handlers/auth.go` + `backend/utils/jwt.go`，前端 `frontend/src/store/auth.tsx`
- **发布新版本**：更新 `version` 文件，打 `v*` 标签推送即可触发 GitHub Actions Release
