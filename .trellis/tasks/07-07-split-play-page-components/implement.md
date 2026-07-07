# Implementation Plan

## Checklist

1. Create `pages/play` module files for types, utilities, and presentational components.
2. Move pure helpers and page-local types out of `Play.tsx`.
3. Extract source/episode panel UI into `SourcePanel`.
4. Extract video metadata/favorite UI into `VideoInfo`.
5. Extract detail loading and source optimization hooks while preserving current data flow.
6. Simplify `Play.tsx` to compose hooks/components.
7. Run `cd frontend && npm run lint` and `cd frontend && npm run build`.

## Validation

```bash
cd frontend && npm run lint
cd frontend && npm run build
```

## Rollback

All changes are scoped to `frontend/src/pages/Play.tsx` and new `frontend/src/pages/play/*` files. Reverting those files restores the previous page implementation.
