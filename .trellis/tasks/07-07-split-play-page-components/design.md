# Design

## Approach

This is a behavior-preserving frontend refactor. The Play page will become an orchestration component that composes page-local hooks and presentational components.

## Module Layout

- `frontend/src/pages/play/types.ts`: page-local types such as `Episode`, `SourceItem`, `SearchSiteData`, and hook state interfaces.
- `frontend/src/pages/play/playUtils.ts`: pure helpers such as episode parsing, speed parsing, playable URL filtering, and history progress restoration.
- `frontend/src/pages/play/SourceStatusBadge.tsx`: source speed/status label.
- `frontend/src/pages/play/SourcePanel.tsx`: source switch list and episode grid/tabs.
- `frontend/src/pages/play/VideoInfo.tsx`: poster, title, favorite button, metadata, and invalid-history clear action.
- `frontend/src/pages/play/usePlayData.ts`: detail loading, favorite state, current episode setup, and initial history progress.
- `frontend/src/pages/play/useSourceOptimizer.ts`: search stream, source optimization, source switching, and detail cache lookup.

## Boundaries

- `Play.tsx` owns route params, top-level player state, and rendering composition.
- Hooks may call stores/API clients but must not return JSX.
- Components receive explicit props and do not fetch data.
- Pure helpers do not access React state except where existing behavior depends on browser storage.

## Risk Controls

- Keep function bodies mostly moved, not rewritten.
- Preserve existing strings and timing behavior.
- Use existing `streamSearchResults`, `detailCacheStore`, `historyStore`, and `favoritesStore` contracts.
- Validate with lint and production build.
