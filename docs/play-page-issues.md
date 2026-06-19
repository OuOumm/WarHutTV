# 播放页面问题分析

本文档整理播放页面当前发现的主要问题，覆盖播放失败、进度错乱、历史记录异常、CORS/代理与代码质量风险。

## 结论

播放页当前构建可以通过，但存在多处运行时隐患。优先级最高的是：

1. 去广告后返回 `blob:` URL，Artplayer 可能无法识别为 m3u8。
2. `startOptimize()` 依赖未同步的 React state，导致自动播放/历史更新不稳定。
3. 播放进度没有按视频源和集数隔离，容易串进度。
4. VOD m3u8 未统一走后端代理，容易被 CORS 或防盗链拦截。

## 验证结果

- `cd frontend && npm run build`：通过。
- `cd frontend && npm run lint`：失败。
  - `frontend/src/pages/Play.tsx` 与 `frontend/src/components/Player.tsx` 合计 36 个问题。
  - 相关规则包括：`react-hooks/refs`、`react-hooks/exhaustive-deps`、`react-hooks/set-state-in-effect`、`@typescript-eslint/no-explicit-any`、`no-empty`。

## 高优先级问题

### 1. 去广告后返回 `blob:`，播放器可能识别不到 m3u8

**位置**：

- `frontend/src/utils/adblock.ts`
- `frontend/src/components/Player.tsx`

**现象**：

`fetchAndFilterM3U8()` 会把过滤后的 m3u8 内容封装为 Blob URL：

```ts
const blob = new Blob([filterAdsFromM3U8(content, url)], {
  type: 'application/vnd.apple.mpegurl',
});
return URL.createObjectURL(blob);
```

Artplayer 默认根据 URL 后缀判断播放类型；`blob:` 没有 `.m3u8` 后缀，可能不会触发 `customType.m3u8`，最终表现为黑屏、加载失败或无法播放。

**建议**：

- 给 Artplayer 显式传入 `type: 'm3u8'`。
- 或让 `getPlayableUrl()` 返回结构化结果，例如 `{ url, type }`，由 `Player` 明确使用播放类型。

---

### 2. `startOptimize()` 读取到旧的 `episodes` / `historyVodId`

**位置**：`frontend/src/pages/Play.tsx`

**现象**：

在 `loadDetail()` 中，代码先调用：

```ts
setEpisodes(epList);
setHistoryVodId(id!);
await startOptimize(videoDetail.vod_name);
```

但 React state 更新不是同步生效的。`startOptimize()` 内部再读取 `episodes`、`historyVodId` 时，可能仍然是旧值或空值。

**影响**：

- 搜不到其他源时 fallback 使用旧 `episodes`，可能无法自动播放第一集。
- `historyStore.updateSource(historyVodId, ...)` 可能拿到空值或上一个视频的 id，导致历史记录更新失败或污染旧记录。

**建议**：

将本次加载得到的数据作为参数显式传入：

```ts
await startOptimize({
  title: videoDetail.vod_name,
  initialEpisodes: epList,
  baseVodId: id!,
});
```

避免在关键流程中依赖尚未同步的 state。

---

### 3. 播放进度没有按“视频/源/集数”隔离

**位置**：

- `frontend/src/pages/Play.tsx`
- `frontend/src/store/history.ts`

**现象**：

当前历史进度主要通过 `vod_id` 查询和更新：

```ts
historyStore.getByVodId(vodId)
historyStore.updateProgress(historyVodId, t, 0)
```

但同一影片可能存在多个源、多个集数；只用 `vod_id` 无法区分具体播放上下文。

**影响**：

- 切换集数后可能沿用上一集进度。
- 切换源后可能读取不到历史，或读取到其他源的历史。
- 新视频没有历史进度时，`currentTime` 可能保留上一个视频的进度。

**建议**：

- 历史进度 key 改为 `site_key + vod_id + episode`。
- 切换视频、源、集数时先重置：

```ts
setCurrentTime(0);
```

- 再根据当前上下文恢复对应进度。

---

### 4. VOD 播放未统一走后端 m3u8 代理

**位置**：`frontend/src/pages/Play.tsx`

**现象**：

直播页已使用后端代理：

```tsx
<Player url={`/api/proxy/m3u8?url=${encodeURIComponent(currentChannel.url)}&moontv-source=${currentSource?.key || ''}`} />
```

但 VOD 播放页仍直接 fetch/播放第三方 m3u8。

**影响**：

浏览器直接请求第三方 m3u8、ts、key 时，容易遇到：

- CORS 拦截。
- 防盗链失败。
- User-Agent 不匹配。
- 部分资源相对路径无法正确解析。

**建议**：

VOD m3u8 也统一转换为：

```ts
/api/proxy/m3u8?url=<encodedUrl>&moontv-source=<sourceKey>
```

必要时将去广告逻辑迁移到后端代理层，避免前端直接跨域 fetch。

## 中优先级问题

### 5. EventSource 失败时可能一直卡在“正在搜索播放源”

**位置**：`frontend/src/pages/Play.tsx`

**现象**：

`streamSearch()` 中，`onerror` 只有在 `eventSource.readyState === EventSource.CLOSED` 时才 resolve。部分网络错误、401 或服务端异常会触发浏览器自动重连，页面可能一直停留在搜索动画。

**建议**：

- 给 `streamSearch()` 增加前端总超时。
- 首次 error 后主动 `eventSource.close()` 并 resolve 已拿到的结果。
- 对 401/认证失败显示明确提示。

---

### 6. Player 在 render 阶段写 ref

**位置**：`frontend/src/components/Player.tsx`

**现象**：

```ts
if (currentTime !== undefined) {
  seekTimeRef.current = currentTime;
}
```

这会在 render 阶段修改 ref，`react-hooks/refs` 已明确报错。

**建议**：

改为在 effect 中同步：

```ts
useEffect(() => {
  if (currentTime !== undefined) {
    seekTimeRef.current = currentTime;
  }
}, [currentTime]);
```

同时处理播放器 metadata 已加载后的补 seek。

---

### 7. 切换集数/源存在异步竞态

**位置**：`frontend/src/pages/Play.tsx`

**现象**：

快速点击多个集数时，多次 `getPlayableUrl()` 异步调用并发执行。较早请求可能晚于较新请求返回，从而覆盖当前选择。

**建议**：

- 使用请求序号，只接受最后一次请求结果。
- 或使用 `AbortController` 取消旧请求。

示例思路：

```ts
const playRequestId = useRef(0);

const requestId = ++playRequestId.current;
const url = await getPlayableUrl(ep.url);
if (requestId !== playRequestId.current) return;
setPlayUrl(url);
```

## 低优先级/代码质量问题

### 8. 空 catch 隐藏异常

**位置**：

- `frontend/src/pages/Play.tsx`
- `frontend/src/components/Player.tsx`

**现象**：

多处存在空 `catch {}`，会隐藏实际错误，增加排查难度。

**建议**：

- 对可忽略错误添加注释说明原因。
- 对关键流程至少输出 `console.warn()` 或设置用户可见提示。

---

### 9. `any` 使用过多

**位置**：

- `frontend/src/pages/Play.tsx`
- `frontend/src/components/Player.tsx`
- `frontend/src/store/db.ts`

**现象**：

lint 显示大量 `@typescript-eslint/no-explicit-any`，降低类型保护能力。

**建议**：

- 为搜索结果、详情缓存、HLS 扩展 video 属性定义明确类型。
- 避免在核心播放流程中使用不受约束的 `any`。

## 建议修复顺序

1. 修复 m3u8 类型识别：给 `Player` 显式传 `type: 'm3u8'`。
2. 重构 `startOptimize()` 参数，移除对旧 state 的依赖。
3. 重构历史进度 key：按 `site_key + vod_id + episode` 存取。
4. VOD m3u8 统一走 `/api/proxy/m3u8`。
5. 为 `streamSearch()` 增加超时和错误兜底。
6. 修复 Player render 写 ref 与明显 hook lint 问题。
7. 为切换源/集数增加异步竞态保护。

## 回归验证建议

修复后至少验证以下场景：

- 首次进入播放页能自动播放第一集。
- 开启去广告后 m3u8 仍可正常播放。
- 搜索不到其他源时能 fallback 到原始源。
- 切换集数不会沿用上一集播放进度。
- 切换源后历史记录仍能正确恢复。
- 快速连续点击集数，最终播放的是最后点击的集数。
- 第三方 m3u8 存在 CORS 限制时，代理播放可用。
- `cd frontend && npm run build` 通过。
