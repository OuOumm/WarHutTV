# Split Play page components

## Goal

Refactor `frontend/src/pages/Play.tsx` into smaller page-local modules while preserving the current playback behavior.

## Requirements

- Keep public routes, UI behavior, playback flow, source optimization, history progress, and favorites behavior unchanged.
- Move page-local types into `frontend/src/pages/play/types.ts`.
- Move pure helpers into `frontend/src/pages/play/playUtils.ts`.
- Extract presentational UI into page-local components, including source/episode panel and video info area.
- Extract detail loading and source optimization logic into page-local hooks where it reduces `Play.tsx` complexity without changing behavior.
- Do not introduce new dependencies or broad styling changes.
- Keep Chinese UI text unchanged.

## Acceptance Criteria

- [x] `frontend/src/pages/Play.tsx` is reduced to page orchestration and is substantially shorter than the current ~888 lines.
- [x] Extracted modules use explicit TypeScript interfaces and no `any`.
- [x] Existing playback, source switch, episode switch, progress restore, and favorite interactions remain wired.
- [x] `cd frontend && npm run lint` passes with 0 errors.
- [x] `cd frontend && npm run build` passes.

## Out of Scope

- Redesigning the Play page UI.
- Changing playback algorithms, source selection semantics, API contracts, or persistence formats.
- Touching backend code.
