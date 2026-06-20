<p align="center">
  <img src="frontend/public/icon-192.png" width="80" alt="WarHutTV Logo">
</p>

<h1 align="center">WarHutTV</h1>

<p align="center">
  自托管影视聚合播放器 · 跨源搜索 · 在线点播 · 直播电视
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Go-1.21+-00ADD8?logo=go&logoColor=white" alt="Go">
  <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white" alt="React">
  <img src="https://img.shields.io/badge/Vite-6-646CFF?logo=vite&logoColor=white" alt="Vite">
  <img src="https://img.shields.io/badge/Docker-Ready-2496ED?logo=docker&logoColor=white" alt="Docker">
  <img src="https://img.shields.io/badge/PWA-Supported-5A0FC8?logo=pwa&logoColor=white" alt="PWA">
  <img src="https://img.shields.io/badge/License-CC%20BY--NC--SA%204.0-lightgrey" alt="CC BY-NC-SA 4.0">
</p>

---

## 📖 项目简介

WarHutTV 是一个自托管的媒体聚合播放器，从多个第三方视频源聚合影视内容，提供统一的搜索、浏览和播放体验。

- **搜索即所得** — 同时搜索多个资源站，SSE 流式实时返回结果
- **聚合去重** — 按标题和年份自动合并不同来源的同一影片
- **智能优选** — 自动测速所有可播放源，选择最流畅的线路
- **沉浸观看** — 基于 HLS.js + Artplayer，支持倍速、画中画、广告过滤
- **全端覆盖** — PWA 支持，移动端底部导航 + 桌面端侧边栏

---

## ✨ 功能特性

### 🔍 跨源聚合搜索

- SSE 流式搜索，同时查询所有已配置的资源站
- 实时进度展示，每个源返回结果即显示
- 搜索结果按标题和年份智能聚合去重

### ▶️ 在线播放

- Artplayer 播放器，支持 HLS（.m3u8）流媒体
- 多播放线路切换 + 自动测速优选
- 倍速播放、画中画、进度拖拽
- 广告拦截（内置规则过滤）

### 📺 直播电视

- 支持 M3U / TXT 格式直播源
- 频道分组管理
- 键盘快捷键切换（方向键）

### 🎬 影视发现

- 豆瓣热门推荐：电影、电视剧、综艺、动漫分类浏览
- Bangumi 番组日历：每日放送列表，星期筛选

### 🎨 多主题系统

6 套深色视觉主题，每套包含独特的纹理、光晕动画和卡片风格：

| 主题 | 风格特点 |
|------|----------|
| 🔴 绯红影院 | 热力红，动感光晕 |
| 🟡 影院金 | 金色质感，奢华纹理 |
| 🟣 星云紫 | 紫色星云，柔和渐变 |
| 🟢 翡翠夜 | 墨绿翡翠，沉稳低调 |
| 🔵 极地冰 | 冰蓝冷色，干净利落 |
| 🌹 玫瑰绒 | 粉紫暖色，绒面质感 |

### 📦 本地存储（IndexedDB）

| 存储内容 | 说明 | TTL |
|---------|------|-----|
| 💛 收藏夹 | 影片收藏，永久保存 | — |
| 📜 播放历史 | 自动记录进度，支持续播 | — |
| ⚡ API 缓存 | 搜索结果、详情、配置 | 2h ~ 7d |
| 📅 Bangumi 日历 | 番组放送表 | 24h |

### 🔧 其他

- **PWA 支持** — Service Worker 离线缓存，可添加到桌面
- **密码保护** — JWT 认证，保护非公开 API
- **速率限制** — 基于 IP 的请求频率控制
- **响应式布局** — 桌面端侧边栏、移动端底部导航栏
- **快捷部署** — Docker 一键启动，支持 Docker Compose

---

## 🏗️ 技术架构

```
┌──────────────────────────────────────────────────┐
│                   前端 (React + Vite)             │
│  ┌────────┐ ┌──────────┐ ┌───────────────────┐   │
│  │ 页面层  │ │  组件层   │ │  状态层            │   │
│  │ 10 页   │ │ Layout   │ │ AuthContext       │   │
│  │ 路由    │ │ Player   │ │ ConfigContext     │   │
│  │ 鉴权    │ │ VideoCard│ │ IndexedDB(Dexie)  │   │
│  └────┬───┘ └────┬─────┘ └────────┬──────────┘   │
│       └──────────┼────────────────┘              │
│                  ▼                                │
│          ┌──────────────┐                        │
│          │  API 客户端   │  Axios + SSE          │
│          └──────┬───────┘                        │
└─────────────────┼────────────────────────────────┘
                  │  /api/*
┌─────────────────┼────────────────────────────────┐
│                 ▼                                 │
│         后端 (Go + Gin)                            │
│  ┌────────┐ ┌──────────┐ ┌────────────────────┐  │
│  │ 中间件  │ │ 处理器    │ │  服务层             │  │
│  │ CORS   │ │ search   │ │  代理转发           │  │
│  │ JWT    │ │ detail   │ │  直播源处理         │  │
│  │ 限流   │ │ play     │ │  文件缓存           │  │
│  │        │ │ live     │ │                    │  │
│  │        │ │ douban   │ │                    │  │
│  │        │ │ bangumi  │ │                    │  │
│  └────────┘ └──────────┘ └────────────────────┘  │
│                                                   │
│  ┌──────────────┐  ┌─────────────────────┐        │
│  │ 配置层 env   │  │ 第三方视频源 API    │        │
│  │ + config.json│  │ 豆瓣 / Bangumi     │        │
│  └──────────────┘  └─────────────────────┘        │
└───────────────────────────────────────────────────┘
```

### 数据流

```
用户搜索 → 前端 SSE → 后端并发请求各视频源 → 标准化返回
              ↓
        前端聚合去重 → 展示结果
              ↓
        用户点击 → 获取详情 → 解析播放地址
              ↓
        多源测速优选 → 播放
```

---

## 🚀 快速开始

### 环境要求

- **Go** 1.21+
- **Node.js** 18+ & **npm** 9+（仅开发需要）

### 开发模式

```bash
# 克隆项目
git clone https://github.com/OuOumm/WarHutTV.git
cd WarHutTV

# 1. 配置密码
# 创建或编辑 data/config.json，至少设置 password
# 详见下方配置章节

# 2. 启动后端（默认 :3000）
cd backend && go run main.go

# 3. 新终端，启动前端（Vite dev server :5173）
cd frontend && npm install && npm run dev
```

浏览器打开 `http://localhost:5173`，输入配置的密码即可登录。

### 生产构建

```bash
make build    # 构建前端 + 后端，输出到 bin/
make run      # 直接运行（需先构建）
```

跨平台构建：

```bash
# Linux / macOS
chmod +x build.sh && ./build.sh

# Windows PowerShell
powershell -ExecutionPolicy Bypass -File build.ps1
```

构建产物：

```
bin/
├── warhutv-linux-amd64
├── warhutv-linux-arm64
├── warhutv-windows-amd64.exe
├── warhutv-darwin-amd64
└── warhutv-darwin-arm64
```

---

## 🐳 Docker 部署

### 使用预构建镜像

```bash
docker pull ghcr.io/OuOumm/warhutv:latest
docker run -d \
  --name warhutv \
  -p 3000:3000 \
  -e PASSWORD=your_password \
  -e JWT_SECRET=your_secret \
  -v ./data:/root/data \
  ghcr.io/OuOumm/warhutv:latest
```

### 本地构建运行

```bash
docker build -t warhutv .
docker run -d --name warhutv -p 3000:3000 -e PASSWORD=your_password warhutv
```

### Docker Compose

```yaml
services:
  warhutv:
    build: .
    ports:
      - "3000:3000"
    environment:
      - PASSWORD=your_password
      - JWT_SECRET=your_secret
    volumes:
      - ./data:/root/data
    restart: unless-stopped
```

---

## ⚙️ 配置

### 配置优先级

**环境变量 > `data/config.json`**

### 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `PORT` | HTTP 监听端口 | `3000` |
| `PASSWORD` | 登录密码（必填） | — |
| `JWT_SECRET` | JWT 签名密钥（必填） | — |

> ⚠️ 生产环境请务必设置 `PASSWORD` 和 `JWT_SECRET`，并使用强随机字符串。

### data/config.json

```json
{
  "site_name": "WarHutTV",
  "announcement": "欢迎使用 WarHutTV",
  "password": "your_password",
  "jwt_secret": "your_secret",
  "api_site": {
    "source_1": {
      "api": "http://example.com/api.php/provide/vod",
      "name": "资源站 1"
    },
    "source_2": {
      "api": "http://example2.com/api.php/provide/vod",
      "name": "资源站 2"
    }
  },
  "live_config": [
    {
      "key": "my_live",
      "name": "我的直播源",
      "url": "http://example.com/live.m3u"
    }
  ]
}
```

| 字段 | 说明 | 必填 |
|------|------|------|
| `site_name` | 站点名称（显示在页面标题） | 否 |
| `announcement` | 站点公告（启动时弹窗显示） | 否 |
| `password` | 登录密码 | 若未设环境变量则必填 |
| `jwt_secret` | JWT 签名密钥 | 若未设环境变量则必填 |
| `api_site` | 视频源配置，key 为自定义标识 | 是 |
| `live_config` | 直播源配置列表 | 否 |

---

## 🛠️ 开发指南

### 项目结构

```
WarHutTV/
├── backend/                  # Go 后端
│   ├── main.go               # 入口 + 路由注册
│   ├── config/               # 配置加载（环境变量 + JSON）
│   ├── handlers/             # HTTP 处理器
│   │   ├── auth.go           #   登录认证
│   │   ├── search.go         #   跨源搜索（SSE）
│   │   ├── detail.go         #   视频详情
│   │   ├── play.go           #   播放地址解析
│   │   ├── live.go           #   直播频道
│   │   ├── proxy.go          #   代理转发
│   │   ├── douban.go         #   豆瓣分类/推荐
│   │   ├── bangumi.go        #   Bangumi 番组日历
│   │   ├── config.go         #   站点配置
│   │   └── version.go        #   版本信息
│   ├── middleware/            # Gin 中间件
│   │   ├── auth.go           #   JWT 认证
│   │   ├── cors.go           #   跨域
│   │   └── ratelimit.go      #   速率限制
│   ├── services/              # 业务逻辑层
│   │   ├── proxy.go          #   代理请求转发
│   │   ├── cache.go          #   文件缓存
│   │   └── live.go           #   直播源处理
│   └── utils/                 # 工具
│       └── jwt.go            #   JWT 令牌
│
├── frontend/                 # React 前端
│   ├── src/
│   │   ├── api/              # API 客户端
│   │   │   ├── client.ts     #   Axios 实例 + 拦截器
│   │   │   ├── auth.ts       #   登录登出
│   │   │   ├── config.ts     #   站点配置
│   │   │   ├── douban.ts     #   豆瓣
│   │   │   └── bangumi.ts    #   Bangumi
│   │   ├── components/        # 可复用组件
│   │   ├── pages/             # 页面组件（10 页）
│   │   ├── store/             # 状态管理
│   │   │   ├── auth.tsx      #   AuthContext
│   │   │   ├── config.tsx    #   ConfigContext
│   │   │   ├── theme.ts      #   6 套主题定义
│   │   │   ├── db.ts         #   Dexie.js 数据库
│   │   │   ├── favorites.ts  #   收藏 CRUD
│   │   │   ├── history.ts    #   历史 CRUD
│   │   │   ├── apiCache.ts   #   API 缓存
│   │   │   └── detailCache.ts#   详情缓存
│   │   ├── hooks/             # 自定义 Hooks
│   │   ├── utils/             # 工具函数
│   │   │   ├── filter.ts     #   搜索结果聚合
│   │   │   ├── speedtest.ts  #   播放源测速
│   │   │   ├── adblock.ts    #   广告过滤规则
│   │   │   └── image.ts      #   图片代理
│   │   └── types/             # TypeScript 类型
│   ├── public/                # PWA 资源（sw.js、图标）
│   └── ...config files
│
├── data/
│   └── config.json            # 运行时配置
├── bin/                        # 编译产物
├── docs/                       # 设计/评审文档
├── .github/workflows/          # CI/CD
├── Dockerfile                  # 开发镜像
├── Dockerfile.release          # 多阶段发布镜像
├── Makefile
├── build.sh / build.ps1
└── version                     # 版本文件
```

### 常用命令

```bash
make dev              # 启动前端开发服务器
make build            # 完整构建（前端 + 后端）
make run              # 运行后端
make clean            # 清理产物
make docker           # 构建 Docker 镜像
```

### 添加新页面 / API

- **新页面**：在 `frontend/src/pages/` 创建组件 → 在 `App.tsx` 注册路由
- **新后端 API**：在 `backend/handlers/` 添加 handler → `main.go` 注册路由 → `frontend/src/api/` 添加客户端
- **新主题**：在 `frontend/src/store/theme.ts` 中添加主题定义
- **新视频源**：在 `data/config.json` 的 `api_site` 中添加

---

## 📦 GitHub Actions CI/CD

| Workflow | 触发条件 | 功能 |
|----------|----------|------|
| **ci.yml** | Push / PR 到 `main` | 构建前端 + 编译后端，上传制品 |
| **release.yml** | 推送 `v*` 标签 | 多平台构建（5 平台）+ UPX 压缩 → GitHub Release + Docker 镜像推送 GHCR |

### 发布新版本

```bash
# 更新版本号
echo "1.1.0" > version

# 打标签推送
git add version && git commit -m "chore: bump version to 1.1.0"
git tag v1.1.0
git push origin v1.1.0
```

自动生成：
- 5 个平台二进制（.tar.gz / .zip）
- Docker 镜像 `ghcr.io/OuOumm/warhutv:latest` + `:v1.1.0`
- Release Notes 自动生成

---

## ❓ 常见问题

### 登录密码是什么？

首次使用需要在 `data/config.json` 中设置 `password` 字段，或者通过环境变量 `PASSWORD` 设置。默认无密码，请务必设置。

### 如何添加视频源？

编辑 `data/config.json` 的 `api_site` 字段，添加资源站的 API 地址。格式要求兼容通用资源站 API（`/api.php/provide/vod` 接口）。

### 支持哪些播放格式？

主要支持 `.m3u8`（HLS）流媒体格式。通过后端代理转发，绕过跨域限制。

### 移动端体验如何？

支持 PWA 添加到桌面，移动端采用底部导航栏布局，适配小屏操作。

### 如何切换主题？

页面左下角主题切换按钮，提供 6 套预置深色主题可选。设置保存在浏览器 localStorage 中。

---

## 📸 截图预览

<details open>
<summary><b>🖥️ 桌面端</b></summary>
<br>
<p align="center">
  <img src="frontend/public/screenshot-desktop.png" width="85%" alt="Desktop Screenshot">
</p>
</details>

<details>
<summary><b>📱 移动端</b></summary>
<br>
<p align="center">
  <img src="frontend/public/screenshot-mobile.png" width="280" alt="Mobile Screenshot">
</p>
</details>

---

## 🙏 致谢

- [LunaTV](https://github.com/MoonTechLab/LunaTV) — 项目灵感来源
- [Artplayer](https://github.com/zhw2590582/ArtPlayer) — 播放器
- [hls.js](https://github.com/video-dev/hls.js) — HLS 流播放
- [Dexie.js](https://github.com/dexie/Dexie.js) — IndexedDB 优雅封装
- [React](https://react.dev) + [Tailwind CSS](https://tailwindcss.com) — 前端框架
- [Gin](https://github.com/gin-gonic/gin) — Go HTTP 框架
- [Vite](https://vitejs.dev) — 构建工具

---

## 📄 License

[CC BY-NC-SA 4.0](LICENSE) — **非商业使用，二改必须开源**

- **NonCommercial** — 不得以商业盈利为目的使用
- **ShareAlike** — 任何修改、衍生作品必须以相同许可证发布
- **Attribution** — 必须保留原作者署名
