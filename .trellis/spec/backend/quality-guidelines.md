# Backend Quality Guidelines

> Code standards, testing, and review criteria for the backend.

---

## Code Conventions

### Go Version
- Go 1.26 with module path `warhutv`
- Use `go mod tidy` to manage dependencies

### Imports
- Standard library imports first, then third-party, then internal
- Grouped with blank line between groups:

```go
import (
    "encoding/json"
    "net/http"

    "github.com/gin-gonic/gin"

    "warhutv/config"
    "warhutv/services"
)
```

### Naming
- Package names: lowercase, single word (`config`, `handlers`, `middleware`, `services`, `utils`)
- Receiver names: single letter or short (`c` for Config, `m` for middleware)
- Handler functions: PascalCase (`SearchStream`, `ProxyM3U8`)
- Service functions: PascalCase with Proxy prefix (`ProxySearch`, `ProxyDetail`)
- Global variables: PascalCase (`AppCache`)

### Thread Safety
- Use `sync.RWMutex` for protecting shared data reads/writes
- Use `sync.Once` for singleton initialization
- Use `sync.WaitGroup` for concurrent goroutine coordination
- Use `context.WithTimeout` for upstream request deadlines

### Struct Conventions
- JSON tags on all exported struct fields
- Example:
```go
type VideoItem struct {
    VodID      interface{} `json:"vod_id"`
    VodName    string      `json:"vod_name"`
    VodPic     string      `json:"vod_pic"`
    SourceName string      `json:"source_name,omitempty"`
}
```
- `omitempty` for optional fields
- `interface{}` for fields with dynamic types (vod_id can be string or number)

### Handler Patterns
- Signature: `func HandlerName(c *gin.Context)`
- Validate inputs first, return 400 if invalid
- Use `c.Query()` for query params, `c.ShouldBindJSON()` for POST body
- Call services for business logic
- Return JSON via `c.JSON()`
- For SSE: set headers, implement `sendSSE()` helper with mutex guard, check client disconnection

### Middleware Patterns
- Factory function returning `gin.HandlerFunc`
- Call `c.Next()` after successful auth
- Call `c.Abort()` on failure
- Standalone validation function for SSE endpoints (`ValidateToken(token string) bool`)

---

## Testing

- No test files exist in the current codebase
- If adding tests: use Go's standard `testing` package
- Focus on handler integration tests and service function tests
- Use `httptest.NewRecorder()` for HTTP handler tests

---

## Forbidden Patterns

- ❌ `panic()` in handlers or services — always return errors
- ❌ Global mutable state without synchronization
- ❌ Ignored errors (`_ = doSomething()`) — always check errors
- ❌ Hardcoded credentials in source code
- ❌ `fmt.Println` / `log.Println` for debugging (remove before committing)
- ❌ Exported functions without doc comments

---

## HTTP Response Conventions

| Scenario | Status Code | Body |
|----------|-------------|------|
| Success | 200 | JSON data |
| Bad request | 400 | `{"error": "中文错误信息"}` |
| Unauthorized | 401 | `{"error": "中文错误信息"}` |
| Too many requests | 429 | `{"error": "中文错误信息"}` |
| Upstream failure | 502 | `{"error": "请求失败"}` |
| Internal error | 500 | `{"error": "错误原因"}` |
