# State Management

> How state is organized in the frontend.

---

## State Layers

The project uses three distinct state layers:

| Layer | Technology | Purpose | Examples |
|-------|-----------|---------|----------|
| **Global (Context)** | React Context + Provider | App-wide config and auth | Auth state, site config, theme |
| **Local (Component)** | `useState`, `useRef` | UI-only state | Active tab, loading flags, modal visibility |
| **Persistent (IndexedDB)** | Dexie.js | Client-side data storage | Favorites, watch history, detail cache |

---

## Global State (React Context)

### Auth Context (`store/auth.tsx`)
```tsx
interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (password: string) => Promise<void>;
  logout: () => void;
}
```
- Checks token on mount via `authApi.verify()`
- Stores token in `localStorage`
- Exposes `login()` and `logout()` actions
- On 401 from API interceptor: auto-logout + redirect to `/login`

### Config Context (`store/config.tsx`)
```tsx
interface ConfigContextType {
  config: SiteConfig | null;
  siteName: string;
  isLoading: boolean;
  refresh: () => void;
}
```
- Fetches config once on mount
- Module-level `configCache` variable prevents redundant fetches
- `refreshConfig()` clears cache so next fetch gets fresh data

### Provider Nesting Order (in App.tsx)
```tsx
<ConfigProvider>
  <AuthProvider>
    <AppContent />
  </AuthProvider>
</ConfigProvider>
```
- Config is outer because Auth may need config during initialization
- Auth is consumed by the announcement hook which also uses Config

---

## Persistent State (IndexedDB via Dexie)

### Database Schema (`store/db.ts`)
Three tables with versioned schema:

| Table | Key Path | Indexed Fields |
|-------|----------|----------------|
| `favorites` | `++id` | `vod_id`, `vod_name`, `addedAt` |
| `watchHistory` | `++id` | `vod_id`, `vod_name`, `watchedAt`, `playback_key` |
| `detailCache` | `++id` | `cacheKey`, `cachedAt` |

### Store Pattern
Each table has a corresponding store module with CRUD operations:

```tsx
// store/favorites.ts
export const favoritesStore = {
  async add(video: VideoItem): Promise<void> { /* ... */ },
  async remove(vodId): Promise<void> { /* ... */ },
  async toggle(video): Promise<boolean> { /* ... */ },
  async getAll(): Promise<Favorite[]> { /* ... */ },
};
```

- Stores are plain objects with async methods, not React state
- Components call store methods directly in event handlers or effects
- No reactive subscription — components re-fetch when needed

### Detail Cache (`store/detailCache.ts`)
- TTL: 2 hours
- Auto-cleanup on app start: `detailCacheStore.cleanExpired()`
- Stores raw API response data for video detail lookups

### API Cache (`store/apiCache.ts`)
- Module-level in-memory cache (not persisted)
- Used for recently fetched API data to avoid duplicate requests

---

## Component-Local State

- Page-level state stays in the page component (`useState`, `useRef`)
- Example: `Search.tsx` manages its own search results, `Player.tsx` manages playback state
- Ref pattern for values that should not trigger re-render:
  ```tsx
  const seekTimeRef = useRef(0);
  const onTimeUpdateRef = useRef(onTimeUpdate);
  useEffect(() => { onTimeUpdateRef.current = onTimeUpdate; });
  ```

---

## Rules

- Do not put IndexedDB data into React Context — it would cause unnecessary re-renders
- Do not use a state management library (Redux, Zustand, Jotai, etc.)
- Component-local state for UI concerns (tabs, modals, search input)
- Store modules for persistent data
- Context for global app state (auth, config, theme)
- Axios interceptor handles 401 redirect globally
