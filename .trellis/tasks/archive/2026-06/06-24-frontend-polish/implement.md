# Frontend UI Polish — Implementation Plan

## Phase 1: PageContainer + VideoGrid（P0）

### Step 1.1: 创建 PageContainer 组件
- [ ] 创建 `frontend/src/components/PageContainer.tsx`
- [ ] 定义统一的间距类：`px-3 sm:px-6 lg:px-8 py-4 sm:py-6`
- [ ] 支持 `compact` prop 用于播放页
- [ ] 使用 `max-w-7xl mx-auto` 限制最大宽度

### Step 1.2: 创建 VideoGrid 组件
- [ ] 创建 `frontend/src/components/VideoGrid.tsx`
- [ ] 定义 `home/search/favorites/compact` 四种变体
- [ ] 封装 grid-cols 和 gap 配置
- [ ] 支持 children 作为内容

### Step 1.3: 迁移页面到 PageContainer
- [ ] Home.tsx：替换 `px-2 sm:px-10 py-4 sm:py-8` 为 `<PageContainer>`
- [ ] Search.tsx：替换 `px-4 sm:px-10 py-4 sm:py-8` 为 `<PageContainer>`
- [ ] Play.tsx：替换 `px-5 lg:px-[3rem] 2xl:px-20` 为 `<PageContainer compact>`
- [ ] Favorites.tsx：检查并统一
- [ ] History.tsx：检查并统一
- [ ] Douban.tsx：检查并统一
- [ ] SpeedTest.tsx：检查并统一

### Step 1.4: 迁移到 VideoGrid
- [ ] Home.tsx：替换 grid 类为 `<VideoGrid variant="home">`
- [ ] Search.tsx：替换 grid 类为 `<VideoGrid variant="search">`
- [ ] Favorites.tsx：替换 grid 类为 `<VideoGrid variant="favorites">`
- [ ] History.tsx：检查并统一

---

## Phase 2: 主题闪烁修复（P0）

### Step 2.1: 分析当前主题应用流程
- [ ] 读取 `index.html` 了解当前 script 加载顺序
- [ ] 确认 `theme.ts` 的 `applyTheme()` 何时执行
- [ ] 识别首屏渲染的关键 CSS 变量

### Step 2.2: 创建内联主题脚本
- [ ] 在 `index.html` 的 `<head>` 中添加内联脚本
- [ ] 同步设置 6 套主题的默认颜色值
- [ ] 从 localStorage 读取用户选择的主题
- [ ] 应用到 `document.documentElement`

### Step 2.3: 清理 CSS 双源定义
- [ ] 移除 `index.css` 中 `@theme` 块的颜色值定义
- [ ] 保留语义化变量名和默认降级值
- [ ] 确保所有组件使用 CSS 变量而非硬编码颜色

### Step 2.4: 验证
- [ ] 测试首次加载无闪烁
- [ ] 测试主题切换无闪烁
- [ ] 测试 6 套主题都正常显示

---

## Phase 3: 微交互优化（P1）

### Step 3.1: 骨架屏→内容过渡
- [ ] 在 Home.tsx 中添加骨架屏淡出逻辑
- [ ] 在 Search.tsx 中添加结果淡入逻辑
- [ ] 确保过渡时间 300ms，使用 `ease-out-expo`

### Step 3.2: Play.tsx 内联 style 迁移
- [ ] 提取 Play.tsx 中的 `<style>` 内容到 `index.css`
- [ ] 移除 Play.tsx 中的 `<style>` 标签
- [ ] 验证动画效果不变

### Step 3.3: 搜索结果切换过渡
- [ ] 在搜索结果容器上添加 `transition-all duration-300`
- [ ] 在聚合/全量模式切换时添加淡入效果
- [ ] 测试切换流畅度

### Step 3.4: CapsuleSwitch 缓动调优
- [ ] 检查当前弹性缓动参数
- [ ] 调整过冲幅度，避免过度弹性
- [ ] 测试移动端和桌面端手感

---

## Phase 4: 移动端交互增强（P1）

### Step 4.1: VideoCard 移动端 Action
- [ ] 添加长按触发 Action 的逻辑（500ms 阈值）
- [ ] 在移动端显示 Action 按钮（收藏/删除）
- [ ] 添加长按反馈动画（轻微缩放）
- [ ] 确保不影响桌面端 hover 交互

### Step 4.2: MobileNav 滑动切换
- [ ] 添加触摸事件监听（touchstart/touchmove/touchend）
- [ ] 计算滑动距离和方向
- [ ] 实现左右滑动切换页面逻辑
- [ ] 添加滑动反馈动画

### Step 4.3: PlayOverlay 移动端点击
- [ ] 修改 PlayOverlay 的 opacity 逻辑
- [ ] 在移动端默认显示 PlayOverlay（通过点击触发）
- [ ] 添加点击事件处理
- [ ] 测试桌面端 hover 和移动端点击都正常

---

## 验证命令

```bash
# 类型检查
cd frontend && npm run type-check

# 构建验证
cd frontend && npm run build

# 开发服务器测试
cd frontend && npm run dev
```

---

## 回滚计划

每个 Phase 完成后如果出现问题：
1. `git stash` 保存当前改动
2. 回退到上一个稳定状态
3. 分析问题原因
4. 重新实现该 Phase

---

## 注意事项

- 每次改动后必须测试 6 套主题
- 移动端交互需要真机测试（浏览器模拟器可能不够准确）
- 保持 `@media (prefers-reduced-motion: reduce)` 支持
- 不引入新的 npm 依赖
