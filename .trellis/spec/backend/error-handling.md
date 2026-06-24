# Error Handling

> How errors are handled in this project.

---

## Error Handling Patterns

### 1. Handler-Level Error Responses

All errors are caught in handler functions and returned as JSON with Chinese error messages:

```go
// Bad request — missing or invalid parameters
c.JSON(http.StatusBadRequest, gin.H{"error": "搜索关键词不能为空"})

// Unauthorized — auth failure
c.JSON(http.StatusUnauthorized, gin.H{"error": "无效的令牌"})

// Bad gateway — upstream request failure
c.JSON(http.StatusBadGateway, gin.H{"error": "请求失败: " + err.Error()})

// Internal error — unexpected server error
c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})

// Too many requests — rate limited
c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{
    "error": "登录尝试过多，请30分钟后再试",
})
```

### 2. Service-Level Error Propagation

Service functions (in `services/`) return errors from upstream API calls, not custom error types:

```go
func ProxySearch(siteKey, keyword string, pg int) (*SearchResult, error) {
    // ...
    return nil, fmt.Errorf("site not found: %s", siteKey)
}

func ProxyPlay(siteKey, vodID string) (string, error) {
    // ...
    return "", fmt.Errorf("no play URL found")
}
```

- No custom error types / error wrapping
- No structured error fields
- Simple string errors with `fmt.Errorf` are sufficient

### 3. Middleware Error Handling

- **Auth middleware**: Returns `401` with Chinese error text, calls `c.Abort()`
- **Rate limit middleware**: Returns `429` with Chinese error text, uses `c.AbortWithStatusJSON()`
- **CORS middleware**: Sets headers, does not produce errors

### 4. Graceful Degradation

External API failures never crash the server:

```go
func BangumiCalendar(c *gin.Context) {
    resp, err := bangumiClient.Do(req)
    if err != nil {
        c.JSON(http.StatusOK, []interface{}{})  // Return empty array instead of error
        return
    }
}
```

Used in:
- Bangumi calendar API: returns empty array on failure
- Search results: missing sites are skipped, others still shown

### 5. SSE Handler Error Handling

SSE endpoints handle client disconnection via context cancellation:

```go
clientGone := c.Request.Context().Done()

sendSSE := func(event string, data interface{}) bool {
    select {
    case <-clientGone:
        return false  // Client disconnected, stop sending
    default:
    }
    // ... send event
}
```

---

## Patterns to Follow

- User-facing error messages in **Chinese**
- Code comments and logs in **English**
- Return `400` for missing/invalid parameters
- Return `401` for auth failures
- Return `502` for upstream proxy failures
- Return `500` only for unexpected internal errors
- Never panic in handlers — return an error response instead
- For SSE, always check for client disconnection
- For external dependency failures, prefer graceful degradation over hard errors
