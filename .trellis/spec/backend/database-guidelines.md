# Database Guidelines

> Data persistence patterns in the backend.

---

## No Database

This project does **not** use a relational database, ORM, or any external database system.

---

## Data Storage Patterns

### 1. File-based Configuration (`data/config.json`)

Application configuration (API sites, password, JWT secret) is stored as a local JSON file:

```go
// config/config.go
type Config struct {
    SiteName     string                `json:"site_name"`
    Announcement string                `json:"announcement"`
    Password     string                `json:"password"`
    JWTSecret    string                `json:"jwt_secret"`
    APISite      map[string]SiteConfig `json:"api_site"`
    mu sync.RWMutex
}

func Load(path string) { /* os.ReadFile → json.Unmarshal */ }
func (c *Config) Save(path string) error { /* json.MarshalIndent → os.WriteFile */ }
```

- Config is loaded once at startup via `config.Load("data/config.json")`
- Runtime updates use `config.Get()` singleton with `sync.Once`
- `Save()` is called on config update via authenticated API endpoint
- File permissions: `0644`

### 2. In-Memory + Disk Cache (`services/cache.go`)

A dual-layer cache with MD5-keyed disk fallback:

```go
type Cache struct {
    items map[string]*CacheItem  // in-memory map
    mu    sync.RWMutex
}

type CacheItem struct {
    Data      interface{}
    ExpiresAt time.Time
}
```

- **Memory first**: `Get()` checks in-memory map, returns if not expired
- **Disk fallback**: On memory miss, reads from `data/cache/<md5hash>.json`
- **Write-through**: `Set()` writes to both memory and disk simultaneously
- `Clear()` removes all in-memory entries and deletes the entire `data/cache/` directory
- TTL is set per-item (e.g., `2 * time.Hour` for search results, `12 * time.Hour` for Bangumi calendar)
- Global singleton: `services.AppCache`

### 3. Frontend Local Storage (IndexedDB via Dexie)

Client-side persistence is handled in the **frontend** layer:
- Favorites
- Watch history
- Detail cache

See frontend state-management.md for details.

---

## Patterns to Follow

- Never introduce an external database without discussing the project scope first
- For new persistent data, prefer memory cache + disk JSON unless requirements justify a DB
- Always use `sync.RWMutex` for concurrent access to shared state
- Cache TTLs should be sensible (hours for search, days for static data)
