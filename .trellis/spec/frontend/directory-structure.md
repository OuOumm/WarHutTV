# Frontend Directory Structure

> Component/page/hook organization in the frontend.

---

## Module Root

```
frontend/
├── public/              # Static assets (icons, screenshots, manifest template)
├── src/
│   ├── api/             # HTTP API client modules
│   │   ├── auth.ts      # Auth API (login, verify)
│   │   ├── bangumi.ts   # Bangumi calendar API
│   │   ├── client.ts    # Axios instance with interceptors (base URL, auth token, 401 redirect)
│   │   ├── config.ts    # Config API (get, update)
│   │   └── douban.ts    # Douban hot list API
│   ├── assets/          # Static imported assets (images, fonts)
│   ├── components/      # Reusable UI components
│   │   ├── Announcement.tsx
│   │   ├── CapsuleSwitch.tsx
│   │   ├── Layout.tsx        # App shell: sidebar + top bar + content area
│   │   ├── LazyGrid.tsx
│   │   ├── MobileNav.tsx
│   │   ├── OptimizingOverlay.tsx
│   │   ├── Player.tsx        # Artplayer + HLS.js video player wrapper
│   │   ├── ScrollableRow.tsx
│   │   ├── ScrollToTop.tsx
│   │   ├── SearchBar.tsx
│   │   ├── SearchingOverlay.tsx
│   │   ├── SettingsPanel.tsx  # User menu / settings
│   │   ├── Sidebar.tsx        # Desktop navigation sidebar
│   │   ├── ThemeSwitcher.tsx
│   │   ├── Toast.tsx
│   │   ├── VideoCard.tsx
│   │   └── WeekdaySelector.tsx
│   ├── hooks/           # Custom React hooks
│   │   ├── useAnnouncement.ts
│   │   ├── useAuth.ts
│   │   ├── useDocumentTitle.ts
│   │   └── useVersionCheck.ts
│   ├── pages/           # Route-level page components
│   │   ├── Douban.tsx
│   │   ├── Favorites.tsx
│   │   ├── History.tsx
│   │   ├── Home.tsx
│   │   ├── Login.tsx
│   │   ├── Play.tsx
│   │   ├── Search.tsx
│   │   └── SpeedTest.tsx
│   ├── store/           # State management (Contexts + IndexedDB stores)
│   │   ├── apiCache.ts       # In-memory API response cache
│   │   ├── auth.tsx          # Auth context + provider
│   │   ├── config.tsx        # Config context + provider
│   │   ├── db.ts             # Dexie database schema + tables
│   │   ├── detailCache.ts    # IndexedDB-based detail cache
│   │   ├── favorites.ts      # Favorites CRUD (IndexedDB)
│   │   ├── history.ts        # Watch history CRUD (IndexedDB)
│   │   └── theme.ts          # Theme definitions + CSS variable application
│   ├── types/           # TypeScript type definitions
│   │   └── index.ts     # All shared types (VideoItem, User, SiteConfig, etc.)
│   ├── utils/           # Utility functions
│   │   ├── adblock.ts   # Ad/segment URL filtering logic
│   │   ├── filter.ts    # Content filtering utilities
│   │   ├── image.ts     # Image URL processing
│   │   └── speedtest.ts # Network speed test for video source selection
│   ├── App.tsx          # Root component: router + providers
│   ├── index.css        # Tailwind directives + global CSS
│   └── main.tsx         # Application entry point (ReactDOM.createRoot)
```

---

## File Naming Conventions

| Type | Convention | Example |
|------|-----------|---------|
| React component | PascalCase | `VideoCard.tsx`, `ThemeSwitcher.tsx` |
| Hook | camelCase with `use` prefix | `useAnnouncement.ts`, `useDocumentTitle.ts` |
| API module | camelCase | `auth.ts`, `bangumi.ts` |
| Store module | camelCase | `favorites.ts`, `theme.ts` |
| Utility | camelCase | `adblock.ts`, `filter.ts` |
| Page component | PascalCase | `Home.tsx`, `Play.tsx` |
| Type definitions | `index.ts` in `types/` | Single barrel file |

---

## File Organization Rules

- **One component per file** (default export)
- Hooks go in `hooks/`, not co-located with components
- Store files handle all state logic (Context + IndexedDB operations)
- API modules abstract all HTTP calls — components never call `fetch` or `axios` directly
- CSS is global via Tailwind — no CSS modules or styled-components
