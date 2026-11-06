# WarHutTV 前端架构与优化分析报告（四维度）

> 分析对象：`frontend/`（Vite 8 + React 19 + TypeScript 严格模式 + Tailwind v4 + react-router-dom 7 + Dexie）
> 代码规模：63 个源文件 / ~7,100 行 TS/TSX（不含 node_modules）；最大文件 `src/pages/play/usePlayController.ts`（545 行）
> 评估维度：**① 性能优化 · ② 代码精简 · ③ 用户体验 · ④ 调用链路简化**
> 说明：本报告所有定位均经**当前代码核实**（行号以 2026-07-09 代码为准）。仓库内已有的 `ANALYSIS_REPORT.md`（2026-07-08，聚焦 UX/动效/视觉/可访问性）中的两条建议**已被实现**，本报告不再重复：路由级 `lazy()`+Suspense（`App.tsx:20-25`、`77`）、标签页隐藏时 `anim-paused` 暂停背景动画（`main.tsx:9-11`）。

---

## 0. 架构总览与整体健康度

**技术栈定位正确**：重播放器（artplayer/hls.js，649KB）已独立 chunk 且仅在 `/play`、`/speed` 按需加载；`Favorites/History/Search` 已接入 `@tanstack/react-virtual` 虚拟化；`VideoCard/CardBase/ScrollableRow` 已 `memo`；缓存优先、骨架屏、Blob URL 回收等工程质量中上。

**但四个维度仍存在明确短板**，按影响排序：

| 维度 | 总评 | 高 | 中 | 低 |
|------|------|----|----|----|
| ① 性能 | 首屏/重渲染有浪费 | 0 | 4 | 2 |
| ② 代码精简 | 含 1 个真实功能 bug | 2 | 3 | 2 |
| ③ 用户体验 | 首屏/缓存链路被废 | 2 | 5 | 1 |
| ④ 调用链路 | 巨型 Hook + Context 未 memo | 1 | 2 | 4 |

---

## 1. 性能优化

### 1.1【中】`Home` 向 `VideoCard` 传内联 `onDelete` 闭包，击穿 `memo`
- **位置**：`src/pages/Home.tsx:228`、`src/pages/Home.tsx:314`（`onDelete={() => handleRemoveFromHistory(...)}`）
- **问题**：`VideoCard` 已 `memo`（`VideoCard.tsx:137`），但每次 `Home` 重渲染都会新建函数引用，`onDelete` 变化使 memo 失效 → 整行"继续观看"/收藏卡片**整树重渲染**（数十张）。
- **影响**：`activeTab`/config/数据刷新时产生无意义重渲染，列表越大越卡。
- **方案**：用 `useCallback` 提供稳定引用，或把 `onDelete` 接收 `(name)=>void` 并在内部按 id 适配后直接传稳定函数。

### 1.2【中】`Douban` 长列表全量渲染，未虚拟化
- **位置**：`src/pages/Douban.tsx:368` 使用 `LazyGrid`（实际非懒加载，见 2.3）
- **问题**：豆瓣分类/榜单可上百项，全部挂载真实 DOM + 图片，无窗口虚拟化。
- **影响**：Douban 路由首屏卡顿、滚动掉帧、内存高。
- **方案**：改用 `VirtualVideoGrid`（参考 `Search.tsx` 接法）；`LazyGrid` 直接删除（见 2.3）。

### 1.3【中】Context value 未 `useMemo`（auth/config）
- **位置**：`src/store/auth.tsx:48`、`src/store/config.tsx:54-61`
- **问题**：Provider value 每次渲染重建对象，`login/logout/fetchConfig` 为内联函数每次新引用。当前 Provider 重渲染频率低（auth 仅登录态变化、config 仅拉取完成），**当前影响 Low**；但 `auth` 的消费者 `AppContent`（`App.tsx:49`）重渲染会让 `Layout` 的 `memo`（`Layout.tsx:32`）被新 `children` 引用击穿 → 侧栏/移动导航/主题切换/整页子树重渲染（与 4.1 联动）。
- **方案**：
```tsx
const login = useCallback(async (p: string) => { /* … */ }, []);
const logout = useCallback(() => { /* … */ }, []);
const value = useMemo(() => ({ isAuthenticated, isLoading, login, logout }), [isAuthenticated, isLoading, login, logout]);
```
config 同理（`refresh` 用 `useCallback` 稳定化）。

### 1.4【中】`ScrollableRow` 的 `MutationObserver` 监听 hover 触发重渲染
- **位置**：`src/components/ScrollableRow.tsx:39-42`（`{childList:true, subtree:true, attributes:true}` + `setTimeout(checkScroll,100)`）；`:35` 的 `useEffect([children])`
- **问题**：`attributes:true` 会捕获卡片 hover 时 `className` 变化（`CardBase` 的 `lifted` 态），每次 hover → 100ms 后 `checkScroll` → `setShowLeft/Right` 整行重渲染；`[children]` 依赖随父级每次新建数组而重复建 `ResizeObserver`。
- **方案**：observer 改为仅 `{childList:true, subtree:true}`（宽度变化已由 `ResizeObserver` 覆盖）；`checkScroll` 用 `useCallback`，effect 依赖改为稳定引用。

### 1.5【低】Dexie（`storage` chunk 95KB）进入首屏包
- **位置**：`src/pages/Home.tsx:10-11` 顶层 `import { historyStore } / { favoritesStore }`
- **影响**：首屏多 ~95KB JS（gzip ~25KB）。Home 先用 localStorage 缓存、再异步读 Dexie，首屏无需 Dexie 同步可用。
- **方案**：将 `continueWatching`/`favoriteItems` 的 Dexie 读取改为动态 `import()`；或接受现状（影响有限）。

### 1.6【低】海报图片无 `srcset`/`sizes`
- **位置**：`src/components/VideoCard.tsx:88-94`（`loading="lazy"` 已有，但无响应式尺寸）
- **影响**：窄屏/弱网仍可能请求大图，首屏偏慢。
- **方案**：`processImageUrl` 追加尺寸参数或 `<img srcSet sizes>`。

---

## 2. 代码精简

### 2.1【高·真实 Bug】`detailCache` 与 `apiCache` 同表存储，`cleanExpired` 串扰驱逐
- **位置**：`src/store/db.ts:28`（两 store 共用 `detailCache` 表）、`src/store/detailCache.ts:32-35`、`src/store/apiCache.ts:4-9`（TTL 24h/7d）、`src/App.tsx:32-33`（两者 `cleanExpired` 均被调用）
- **问题**：`detailCacheStore.cleanExpired()` 用统一 `CACHE_TTL=2h` 删除 `db.detailCache` 中**所有** `cachedAt` 超 2h 的行——但 `api_cache:` 前缀行本应存活 24h–7d（`apiCache.ts:4-9`），会被 2h 阈值**提前清掉**。
- **影响**：长效 API 缓存（bangumi 24h、logo 7d）被静默驱逐，缓存命中率骤降；两份近乎相同的缓存样板需同步维护。
- **方案**：`detailCache.cleanExpired` 必须**按作用域隔离**，只清无 `api_cache:` 前缀的行：
```ts
async cleanExpired() {
  const threshold = Date.now() - CACHE_TTL;
  const rows = await db.detailCache.toArray();
  const expired = rows
    .filter(r => !r.cacheKey.startsWith('api_cache:') && r.cachedAt < threshold)
    .map(r => r.id!);
  if (expired.length) await db.detailCache.bulkDelete(expired);
}
```
并进一步在 `db.ts` 抽 `createCacheStore({ ttl, prefix? })`，`apiCache/detailCache` 退化为配置项，消除重复 `get/set` 样板。

### 2.2【高】双 HTTP 栈：axios 与原生 `fetch` 并存且行为分歧
- **位置**：`src/api/client.ts:1-31`（axios + 拦截器注入 token、401 跳登录）vs `src/api/searchStream.ts:53-57`、`src/api/douban.ts:83-98`（原生 `fetch`）
- **问题**：`searchStream.ts` 手动 `localStorage.getItem('token')` 拼 `Authorization`，**缺失 401 跳登录**——流路径拿到 401 不会回登录页（与 axios 路径行为不一致）；`douban.ts` 又自带 `fetchWithTimeout`。Token 注入逻辑两处维护。
- **影响**：鉴权行为分歧（安全隐患 + 维护成本）；`useVersionCheck.ts:22`、`utils/adblock.ts` 同样裸 `fetch` 绕过拦截器。
- **方案**：在 `client.ts` 抽 `getAuthHeaders(): Record<string,string>` 共用；SSE 因需流式读 body 保留 `fetch` 但 Header 来自同一 helper；`useVersionCheck/adblock` 改走 `apiClient` 或集中管理"免鉴权端点"。

### 2.3【中】`LazyGrid` 名不副实且冗余
- **位置**：`src/components/LazyGrid.tsx:9-14` vs `src/components/VideoGrid.tsx:14`（`variant="search"` 的类名与它**完全相同**）
- **问题**：`LazyGrid` 只是普通 CSS Grid，既不懒也不虚拟化；仅 `Douban.tsx:368` 使用，而同文件 `Douban.tsx:359` 已用 `<VideoGrid variant="search">`。
- **方案**：删除 `LazyGrid.tsx`，`Douban.tsx:368` 改用 `<VideoGrid variant="search">`。

### 2.4【中】`usePlayController` 重复块可抽取（~100+ 行）
- **位置**：`src/pages/play/usePlayController.ts`
- **问题**：fallback 块（取 `initialEpisodes[0].url`→`getPlayableUrl`→`setPlayUrl`→`applyHistoryProgress`）重复 **4 次**（约 171-178、203-211、330-334、338-342）；"套用源详情"块重复 **4 次**（约 226-238、289-302、313-326、441-456）。
- **方案**：抽到 `playUtils.ts` 的 `playFallback()` 与 `applyBestSource(detail)`，降低出错面（与 4.4 联动）。

### 2.5【中】主题调色板双源（`index.html` ↔ `theme.ts`）
- **位置**：`index.html:19-26` 内联手写 6 套调色板；`src/store/theme.ts:36-181` 再定义一份
- **问题**：数据重复、漂移风险高；内联脚本还**未设置** `--color-primary-rgb/primary-dim-rgb` 及 `data-card-style/data-accent-effect`（`theme.ts:219-232`），首屏与运行期视觉不一致。
- **方案**：以 `theme.ts` 为唯一真源，构建期由 Vite 注入内联 bootstrap，删除 html 中手写副本。

### 2.6【低】`VideoGrid` `compact` 变体未使用
- **位置**：`src/components/VideoGrid.tsx:16` — 实际仅 `home/favorites/search` 被引用，无 `variant="compact"`。删除死配置。

### 2.7【低】`douban.ts` 第三套缓存实现
- **位置**：`src/api/douban.ts:48-70`（`getCache/setCache` + 2h TTL），与 2.1 的样板同源。可并入 2.1 的统一缓存 helper（虽是跨域 localStorage，仍可共享 TTL 逻辑）。

> 依赖核对：`axios`、`@tanstack/react-virtual`、`dexie` 均被实际使用，**无"声明但未 import"的冗余依赖**。冗余集中在"两套 HTTP 范式 + 多份缓存样板"，而非多余包。

---

## 3. 用户体验优化

### 3.1【高】初始渲染被鉴权校验阻塞，全屏"加载中"闪屏
- **位置**：`src/App.tsx:42-44`（`isLoading` 初值 `true` 时阻断渲染）、`src/store/auth.tsx:19-31`（`verify()` 网络往返结束才 `setIsLoading(false)`）
- **问题**：有 token 的用户每次打开都先看全屏"加载中…"，首屏内容（含 Home 骨架）完全不渲染。感知启动延迟 = 网络 RTT。
- **方案**：`isLoading` 时返回 `<PageSkeleton />`（而非纯文本"加载中…"）；或本地按 `token` 存在即**乐观渲染** Layout/Home，verify 失败再跳登录。

### 3.2【高】`Home` 缓存优先被 `loading` 网关废掉
- **位置**：`src/pages/Home.tsx:92`（`loading` 初值 true）、`:96-97`（同步 `loadCachedData()`）、`:131-152`（`setLoading(false)` 直到 `refreshData()` 全部 await 完成）
- **问题**：`loadCachedData()` 已同步从 localStorage 写入 `hotMovies` 等，但内容渲染被 `loading ? <skeleton>` 门控，而 `setLoading(false)` 直到联网 `refreshData()` 跑完才执行。**缓存的加速作用完全失效**，首屏等价于无缓存。
- **方案**：缓存命中即 `setLoading(false)`；仅在无缓存时才保持 loading：
```ts
const loadCachedData = () => {
  /* …set state… */
  if (cached) setLoading(false);
};
```

### 3.3【中】破坏性"清空"无确认、无撤销
- **位置**：`src/pages/Favorites.tsx:54-60`、`src/pages/Home.tsx:219,297`
- **问题**：一键 `favoritesStore.clear()` / `historyStore.clear()`，无二次确认、无撤销。
- **方案**：两步确认或 `window.confirm`；清空后弹"已清空 · 撤销"Toast（配合 3.6 的 `ToastProvider`）。

### 3.4【中】取消收藏无反馈
- **位置**：`src/pages/Favorites.tsx:27-30`、`src/pages/Home.tsx:182-185`
- **问题**：`handleRemove` 静默 `await loadFavorites()` 重载，无 Toast，用户不确定是否成功、可能重复点击。
- **方案**：移除后 `setToast('已取消收藏')`。

### 3.5【中】`clearInvalidHistory` 触发整页刷新
- **位置**：`src/pages/play/usePlayController.ts:507-510`（`window.location.href = '/'`）
- **问题**：强制整页重载，丢失 SPA 状态、重跑鉴权校验、产生闪屏。
- **方案**：`const navigate = useNavigate(); navigate('/');`

### 3.6【中】Toast 三套实现、不一致
- **位置**：`src/components/Toast.tsx`（Login 用）、`src/pages/History.tsx:55-59`、`src/pages/Play.tsx:23-37`（内联复制）
- **问题**：三种 Toast 样式/定位（顶部 -52px 气泡、top-4、top-20），Home 收藏/历史清空甚至无提示。反馈感知不统一。
- **方案**：引入 `ToastProvider` + `useToast()`，所有异步反馈走单一组件（带 `role="alert"`/`aria-live`，顺带补无障碍）。

### 3.7【中】换源重建播放器导致黑屏/卡顿
- **位置**：`src/components/Player.tsx:215`（effect deps `[url, themeId]`，url 变即 destroy+new Artplayer）、`src/pages/play/usePlayController.ts:416-464`
- **问题**：切换源 `setPlayUrl` 改变 → Player 因 url 变化整体卸载重建，伴随黑屏与重新缓冲；仅右上角小"切换源中"徽标，主区无覆盖提示。
- **方案**：保持 Player 挂载，仅交换 `url`（如 artplayer 支持则走其切换 API）；用 `sourceSwitching` 在 `PlayerViewport` 顶部加半透明遮罩而非依赖角落小标。

### 3.8【低】搜索/优选 overlay 取消能力缺失
- **位置**：`src/components/SearchingOverlay.tsx:62-69`（声明"停止搜索"按钮依赖 `stopSearch`）、`src/pages/play/PlayerViewport.tsx:26`（调用处未传该 prop）
- **问题**：弱网下优选 30s 超时期间用户无法中断；`setIsOptimizing(false)` 用 `setTimeout` 延时，组件卸载后仍会 `setState`（非致命但告警）。
- **方案**：暴露 `stopSearch` 中止 `AbortController`；用 ref 守卫卸载后的 `setState`。

---

## 4. 调用链路简化

### 4.1【中】`AuthContext` value 未 memo → `Layout` memo 失效 → 整子树重渲染
- **位置**：`src/store/auth.tsx:48`（`value={{ isAuthenticated, isLoading, login, logout }}`）、`src/components/Layout.tsx:32`（`memo`）
- **问题**：`login/logout` 内联函数每次新引用，value 对象每次重建；`AppContent`（`auth.tsx` 消费者）重渲染 → 其下 `<Layout>` 的 `children` 每次新引用 → `Layout` 的 `memo` 被击穿 → 侧栏/移动导航/主题切换/UserMenu/整页子树全部重渲染。
- **方案**：见 1.3，用 `useCallback` + `useMemo` 稳定 value。

### 4.2【低】`ConfigContext` value 未 memo
- **位置**：`src/store/config.tsx:53-64`（`refresh: fetchConfig` 每次新引用）
- **问题**：value 每次重建；`Layout` 的 `siteName`（`Layout.tsx:36`）随重建触发消费组件重渲染。频率低。
- **方案**：`useMemo` 包 value + `useCallback` 包 `fetchConfig`。

### 4.3【高】`usePlayController` 巨型 Hook（545 行，22 个 `useState`）
- **位置**：`src/pages/play/usePlayController.ts:24-42`（22 个状态混合播放/选源/优选测速/收藏/历史/UI 模态）
- **问题**：任意 `setState` 都令 `Play` 重渲染 → 整页子树重渲染；内部调用链深且重复（见 2.4）。`VideoInfo` 完全不用 `searchProgress/sourceSwitching/optimizeComplete` 等高频字段，却因父重渲染被迫重渲染。
- **方案**：
  1. 拆 `useSourceSelection`（选源、测速、best-source 决策）与 `usePlayerStatus`（用 `useReducer` 把 `loading/isOptimizing/optimizeComplete/sourceLoading/sourceSwitching/searchProgress` 建模为状态机）；
  2. 4 个重复分支合并为 `applyBestSource(detail)` 纯函数（见 2.4）；
  3. `PlayerViewport/VideoInfo/SourcePanel` 加 `React.memo`，缩窄重渲染范围。

### 4.4【低】`useAuth.ts` 纯转发，可删除
- **位置**：`src/hooks/useAuth.ts:2`（`export { useAuth, AuthProvider } from '../store/auth'`）
- **方案**：删除该文件，消费方直接 `import { useAuth } from '../store/auth'`（全仓替换）。

### 4.5【低】`useVersionCheck` / `searchStream` / `douban` / `adblock` 绕过 `apiClient`
- **位置**：`src/hooks/useVersionCheck.ts:22`（裸 `fetch('/api/version')`）
- **问题**：绕过 `client.ts` 拦截器（未带 Bearer、401 不统一处理）。
- **方案**：统一改走 `apiClient`，或在 `client.ts` 显式区分"免鉴权端点"集中管理（与 2.2 联动）。

### 4.6【已良好】Provider 嵌套方向正确、无循环依赖
- `App.tsx:93-103`（`ConfigProvider > AuthProvider > AppContent`）：`auth.tsx:4` 仅引入 `config.refreshConfig`（函数），`config` 不反向依赖 auth → **无循环/多余嵌套**，顺序合理，无需对调。Play 页 props 为"宽而浅"的 1 层直传，未达 3+ 层深度，不需改为 context。

---

## 5. 综合优先级路线图

| 优先级 | 项（维度） | 改动量 | 预期收益 |
|--------|-----------|--------|---------|
| **P0** | 2.1 缓存串扰 bug（detailCache 隔离 `api_cache:`） | 极小（~8 行） | 修真实功能 bug，恢复长效缓存命中 |
| **P0** | 3.1 + 3.2 首屏骨架占位 + 缓存优先渲染 | 小 | 感知启动延迟↓、缓存真正生效 |
| **P1** | 2.2 统一 `getAuthHeaders`/`apiClient` | 中 | 鉴权行为一致、消除分歧 |
| **P1** | 4.3 + 2.4 `usePlayController` 拆分 + `useReducer` + 抽 `applyBestSource` | 中 | 播放页重渲染范围↓、可维护性↑ |
| **P1** | 1.3 + 4.1/4.2 Auth/Config context `useMemo` + `useCallback` | 小 | 全局重渲染根因消除，`Layout` memo 生效 |
| **P1** | 3.5/3.3/3.4/3.6 换 `navigate`、清空确认、Toast 统一、收藏反馈 | 中 | 操作安全感与反馈一致性↑ |
| **P2** | 1.1 Home `onDelete` 稳定引用；1.2 Douban 虚拟化；1.4 ScrollableRow observer 收敛 | 小 | 列表交互更跟手 |
| **P2** | 2.3 删 `LazyGrid`；2.5 主题单源；2.6/2.7 死配置/第三套缓存合并 | 小 | 代码量↓、漂移风险↓ |
| **P2** | 3.7 换源不重建播放器 + 遮罩；1.5/1.6 Dexie 动态 import、图片 `srcset` | 中/小 | 换源不黑屏、首屏再瘦身 |

---

## 6. 小结

项目在**视觉体系、主题工程、播放器分包、缓存设计与清理**上扎实，工程质量中上。本轮四个维度的主要短板为：

1. **性能**：首屏与重渲染浪费（Context 未 memo、内联函数击穿 memo、Douban 未虚拟化）；
2. **代码精简**：含 **1 个真实缓存驱逐 bug**（detailCache 误删 api_cache 行）+ 双 HTTP 栈行为分歧 + 多份重复样板；
3. **用户体验**：**首屏与缓存加速链路被废**（阻塞式鉴权 + loading 网关），破坏性操作无确认、反馈不统一；
4. **调用链路**：`usePlayController` 545 行巨型 Hook + Context value 未 memo 是重渲染与维护复杂度的根因。

建议按 **P0（修 bug + 首屏）→ P1（统一 HTTP / 拆分巨型 Hook / memo / 反馈一致）→ P2（细节精简）** 推进，整体改动可控、收益明确。

---
*本报告基于 `frontend/src` 当前代码核实（2026-07-09），所有问题均附文件:行号定位。*
