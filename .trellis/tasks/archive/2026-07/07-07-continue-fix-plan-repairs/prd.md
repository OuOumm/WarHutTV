# Continue fix plan repairs

## Goal

Continue repairing the issues listed in `docs/fix-plan.md`, excluding the JWT/default-password item per user instruction.

## Confirmed Facts

- `docs/fix-plan.md` lists 11 issues across backend, frontend, docs, and repository hygiene.
- P0 backend embed split is already implemented with `backend/static_embed.go` and `backend/static_dev.go`.
- The frontend no longer returns `/api/proxy/m3u8` from `getPlayableUrlModule()`, so the missing M3U8 proxy branch is removed for now.
- CORS no longer returns `Access-Control-Allow-Credentials: true` with wildcard origin.
- Git currently only tracks `data/config.example.json` under `data`; build artifacts and local data are not tracked.
- Remaining repair work includes SSE token leakage, config map concurrent access, upstream response validation/limits, Bangumi false-success handling, lint failures, and README version drift.

## Requirements

- Do not change JWT/default-password behavior in this task.
- Replace search SSE URL query token usage with a mechanism that sends the main JWT in the `Authorization` header.
- Ensure backend search and proxy services read API site config through safe snapshots instead of directly reading the global mutable map.
- Add upstream HTTP status checks and bounded response body reads for third-party source requests.
- Make Bangumi upstream failures observable with an appropriate non-200 error response and safe cache handling.
- Fix frontend lint errors that are in scope for current code, without broad UI redesign.
- Align README version requirements with actual project configuration.

## Acceptance Criteria

- [x] `frontend/src/pages/Search.tsx` and `frontend/src/pages/Play.tsx` no longer put the main JWT in `/api/search/stream` URLs.
- [x] Authenticated search streaming still works by using `Authorization: Bearer <token>`.
- [x] Backend code no longer directly iterates or indexes `config.Get().APISite` outside the config package.
- [x] Third-party source requests reject non-2xx responses and cap response reads.
- [x] Bangumi upstream failures return `502` JSON errors instead of `200 []` false success.
- [x] README Go/Node/Vite/React version statements match `go.mod`, Dockerfile, CI, and `package.json`.
- [x] Targeted validation passes: backend tests/build and frontend lint/build where feasible.

## Out of Scope

- JWT secret generation, default password enforcement, password hashing, and auth model changes.
- Implementing a full backend M3U8 proxy, because the frontend proxy branch is already removed.
- Large-scale frontend redesign or nonessential refactoring.
