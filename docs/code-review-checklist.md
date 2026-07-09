# 代码审查速查清单（Reviewer Checklist）

> 配套 `docs/code-review-guide.md`。审查时逐条过，结论用 P0–P3 标注。
> 🔴 P0 阻塞（必须清零）· 🟠 P1 重要（修复或 waiver）· 🟡 P2 建议（follow-up）· 🔵 P3 优化

## 合并门槛（硬性）
- [ ] CI 全绿（build / vet / lint / test）
- [ ] ≥1 批准（核心/安全模块 ≥2）
- [ ] **所有 P0 已清零**
- [ ] P1 已修复或书面 waiver
- [ ] 破坏性变更已说明 + 配套 PR 协调

## 通用维度
- [ ] **正确性**：需求达成？边界（空/超长/负数/并发）处理？`err` 未被吞？
- [ ] **可维护性**：命名清晰？无死代码/调试残留？可复用逻辑已提取？
- [ ] **性能**：无 N+1？无无限读响应体？无重复计算/不必要重渲染？
- [ ] **测试**：关键路径（auth/proxy/config/聚合）有测试或可单测？

## 后端 Go（重点）
- [ ] 不直读全局 `cfg.APISite`，用 `config.Snapshot()` 深拷贝快照
- [ ] 第三方失败返 `502` 而非 `200 []`（不假成功）
- [ ] 第三方请求检查 `StatusCode` + `io.LimitReader` 限大小
- [ ] 鉴权走 `Authorization: Bearer` 头；**token 不进 URL query**
- [ ] 代理类接口防 SSRF（禁 localhost/内网/元数据）；限大小
- [ ] SSE：检测客户端断开 + 校验 `Flusher` + 总超时 + 写竞争加锁
- [ ] 无默认弱密码 / 固定 `JWTSecret`；启动时拒绝默认值
- [ ] CORS 不共存 `*` 与 `Allow-Credentials: true`
- [ ] handler 内不 `panic`；`context` 正确传递/取消

## 前端 TS / React
- [ ] 无 `any` / `(x as any)`（除非注释原因）；API 响应有接口
- [ ] Hook 规则合规（不 `set-state-in-effect`；不可变更新）
- [ ] `{cond && <C/>}` 中 `cond` 不为数字 `0`；`key` 用稳定 id
- [ ] 大文件（>250 行）/多逻辑块已提取组件或 Hook
- [ ] 无 `dangerouslySetInnerHTML` 拼未转义内容；token 不存 `localStorage` 明文
- [ ] `tsc -b` 通过；未提交 `dist/`

## 安全专项（必过一遍）
- [ ] 无鉴权绕过 / 白名单误配
- [ ] 无注入（命令/模板）、无 SSRF
- [ ] 无默认凭证 / 硬编码密钥
- [ ] 无敏感信息泄露（token 进 URL/日志、错误暴露内部细节）
- [ ] 无 XSS（未转义渲染）

## 注释规范
```
🔴 P0 安全：JWT 出现在 URL query
文件 search.go / 行 50：token 通过 query 参数传递。
为什么：会进日志/历史，泄露窗口长。
建议：改用 Authorization 头（fetch + ReadableStream）或短期 SSE token。
```
发现好写法，明确点出 ✅。
