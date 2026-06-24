# Backend Directory Structure

> Where different file types go in the backend.

---

## Module Root

```
backend/
├── config/          # Application configuration loading & management
│   └── config.go    # Config struct, Load(), Get(), Save()
├── handlers/        # HTTP request handlers (Gin controller layer)
│   ├── auth.go      # Login, Verify endpoints
│   ├── bangumi.go   # Bangumi calendar proxy
│   ├── config.go    # Get/Update config endpoints
│   ├── detail.go    # Video detail endpoint
│   ├── play.go      # Play URL endpoint
│   ├── proxy.go     # M3U8/segment/key proxy handlers
│   ├── search.go    # SSE streaming search handler
│   └── version.go   # Version endpoint
├── middleware/       # Gin middleware
│   ├── auth.go      # JWT auth middleware + standalone ValidateToken
│   ├── cors.go      # CORS middleware
│   └── ratelimit.go # Login rate limiter
├── services/        # Business logic / external API clients
│   ├── cache.go     # In-memory + disk cache (AppCache singleton)
│   └── proxy.go     # Video source API request helpers (Search, Detail, Play)
├── utils/           # Utility functions
│   └── jwt.go       # JWT token generation & validation
├── main.go          # Entry point, route registration, embedded frontend serving
├── go.mod
└── go.sum
```

---

## File Responsibilities

### `config/` — Application Configuration
- `config.go` defines `Config` struct with JSON tags, `SiteConfig` for API sites
- `Load()` reads from `data/config.json`, falls back to defaults if file missing
- Global singleton accessible via `config.Get()` with `sync.Once` lazy init
- `Update()` and `Save()` methods with `sync.RWMutex` for thread safety
- No environment variable overrides (except `PORT` for server listen address)

### `handlers/` — HTTP Handlers
- One file per logical endpoint group (auth, search, proxy, etc.)
- Each handler is a package-level function with signature `func(c *gin.Context)`
- No handler structs — use closures or package functions
- Handlers call `services.*` for business logic, never call external APIs directly
- SSE handlers use goroutines + `sync.WaitGroup` for concurrent site queries
- Response messages use **Chinese** for user-facing error text

### `middleware/` — Gin Middleware
- One file per middleware concern (auth, cors, ratelimit)
- Each exports a `gin.HandlerFunc` factory function
- `auth.go` also exports `ValidateToken(token string) bool` for SSE endpoints that cannot set Authorization header

### `services/` — Business Logic
- `proxy.go` defines shared data types: `VideoItem`, `SearchResult`, `DetailResult`, `PlayResult`
- Generic helper `doRequest[T any]()` for type-safe API responses
- Functions: `ProxySearch`, `ProxyDetail`, `ProxyPlay`
- `cache.go` provides `Cache` struct with in-memory + disk persistence using MD5 hashed keys
- Global `AppCache = NewCache()` singleton

### `utils/` — Utilities
- JWT-only currently. Type `Claims` wraps `jwt.RegisteredClaims`
- `GenerateToken` / `ValidateToken` pair

### `main.go` — Entry Point
- Loads config, creates Gin engine, registers middleware, mounts routes
- Two route groups: public `/api` (login, proxy, search, config GET, version) and auth-protected `/api`
- Embeds `frontend/dist/` via `//go:embed` for production SPA serving
- SPA fallback: all unknown routes serve `index.html`
