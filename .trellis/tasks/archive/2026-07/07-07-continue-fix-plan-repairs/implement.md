# Implementation Plan

## Checklist

1. Refactor backend config reads to use snapshots in search and proxy services.
2. Harden video source upstream requests with status checks and response size limits.
3. Harden Bangumi handler errors, cache type checks, and response size handling.
4. Add a shared frontend authenticated SSE fetch/parser helper.
5. Migrate search stream consumers in `Search.tsx` and `Play.tsx` away from URL query tokens.
6. Run frontend lint, fix in-scope lint failures, and avoid unrelated redesign.
7. Update README version statements.
8. Run targeted validation.

## Risk Points

- Search stream parser must preserve existing `result`, `progress`, `done`, and `error` event behavior.
- Abort/cancel paths must not update unmounted components.
- Config snapshot should be taken before launching search goroutines to avoid data races.
- Upstream response limits should be high enough for normal video source JSON while bounding memory use.

## Rollback Points

- Backend config and upstream hardening are limited to `backend/config`, `backend/services`, and selected handlers.
- Frontend SSE migration is isolated to a new helper plus `Search.tsx` / `Play.tsx` consumers.
- README version changes are documentation-only.

## Validation Commands

```bash
cd backend && go test ./...
cd frontend && npm run lint
cd frontend && npm run build
```
