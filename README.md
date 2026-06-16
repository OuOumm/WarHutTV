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
| JWT_SECRET | JWT密钥 | - |

## License

MIT
