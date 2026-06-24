# Type Safety

> TypeScript conventions and type organization.

---

## Current TypeScript Settings

- TypeScript 5.x with strict mode enabled
- Vite 6 for build tooling
- No `any` — explicit types preferred (one `eslint-disable` for `any` exists in Player.tsx for Hls.js interop)

---

## Type Organization

### Barrel File Pattern
All types are in a single file `src/types/index.ts`:

```tsx
export interface VideoItem {
  vod_id: string | number;
  vod_name: string;
  vod_pic: string;
  vod_year?: string;
  vod_remarks?: string;
  type_id?: string | number;
  type_name?: string;
  site_key?: string;
  source_name?: string;
}

export interface SearchResult {
  code: number;
  msg: string;
  total: number;
  list: VideoItem[];
}
```

### Type Naming
- `interface` for object shapes (preferred over `type`)
- No `I` prefix (`IVideoItem` → ❌)
- PascalCase for type names
- `Record<string, unknown>` for dynamic key-value maps

### API Request/Response Pairs
```tsx
export interface LoginRequest {
  password: string;
}

export interface LoginResponse {
  token: string;
  expiresAt: number;
}
```

---

## Patterns

### Union Types for Dynamic Fields
API sources return `vod_id` and `type_id` as either string or number:
```tsx
vod_id: string | number;
type_id?: string | number;
```

### Optional Fields for API Responses
Fields that may be missing from some sources:
```tsx
vod_year?: string;
vod_remarks?: string;
vod_content?: string;
```

### String Literal Types Not Used
The codebase doesn't use string literal unions or branded types. Strings are used directly.

### Type Inference
- React hooks with `useState` rely on type inference from initial values
- Axios responses are explicitly typed:
  ```tsx
  const response = await apiClient.post<LoginResponse>('/auth/login', data);
  ```

---

## Database Types

Dexie table types extend API types:
```tsx
export interface Favorite extends VideoItem {
  id?: number;
  addedAt: number;
}

export interface WatchHistory extends VideoItem {
  id?: number;
  watchedAt: number;
  progress?: number;
  duration?: number;
  episode?: string;
  playback_key?: string;
}
```

---

## Rules

- Prefer `interface` over `type` for object shapes
- `Record<string, unknown>` for dynamic maps instead of `{[key: string]: any}`
- Use `type` for unions and utility types only
- Export all shared types from `types/index.ts`
- Keep component props interfaces in the component file, not `types/`
- Avoid `as` type assertions — prefer proper type definitions
- Use `eslint-disable` comment with a reason when `any` is unavoidable (e.g., Hls.js interop)
