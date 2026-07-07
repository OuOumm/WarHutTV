# Design

## Scope

This task completes the remaining `docs/fix-plan.md` repairs that are safe to do now, while explicitly excluding JWT/default-password behavior changes.

## Backend Design

### Config Access

- Keep `config.Snapshot()` as the read boundary for handlers and services.
- Add small config helpers only if they prevent repeated snapshot/index logic.
- Search handlers should take a snapshot once per request and pass immutable site data into goroutines.
- Proxy services should lookup the site from a snapshot, never from `config.Get().APISite`.

### Upstream Requests

- Keep `services.ProxySearch`, `ProxyDetail`, and `ProxyPlay` API shape unchanged.
- Update the shared generic request helper to:
  - check `resp.StatusCode` is 2xx;
  - read only a bounded body;
  - return errors that include upstream status and a small response excerpt.
- Limit size is a backend constant in `services/proxy.go`.

### Bangumi Calendar

- Preserve successful cache behavior.
- Cache reads must type-check the stored value before serving.
- Request creation/client/read/status failures return `502` with a Chinese JSON error.
- Body reads are bounded.

## Frontend Design

### Authenticated SSE Stream

- Replace `EventSource` with `fetch` + `ReadableStream` for search streaming, because browser `EventSource` cannot set `Authorization` headers.
- Keep backend stream contract unchanged: event names and JSON payloads stay the same.
- Create a shared frontend helper for parsing SSE chunks to avoid duplicating protocol parsing in `Search.tsx` and `Play.tsx`.
- Use `AbortController` for cancellation and component cleanup.

### Lint Repairs

- Fix current lint errors with minimal local changes.
- Prefer proper interfaces and `unknown`/narrowing over `any`.
- Avoid broad ESLint rule changes unless a rule is demonstrably incompatible with the app.

## Documentation

- Update README badges and environment requirements to actual configured versions.
- Avoid changing deployment instructions beyond version accuracy unless directly required.

## Validation

- Backend: `cd backend && go test ./...`.
- Frontend: `cd frontend && npm run lint`; if lint passes, `npm run build`.
