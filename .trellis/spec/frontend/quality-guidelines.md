# Frontend Quality Guidelines

> Linting, code standards, and review criteria.

---

## Code Conventions

### TypeScript
- Strict mode enabled
- Prefer `interface` over `type` for object shapes
- No `any` (exceptions documented with `eslint-disable`)
- Explicit return types on functions (inferred where obvious)

### React
- Functional components only
- Props interfaces defined above the component with `ComponentNameProps`
- Destructure props inline, not with `React.FC`
- `export default` for components
- Named exports for hooks and utilities

### Imports Order
```
React/hooks → Third-party libs → Project modules (api, store, components)
```
```tsx
import { useState, useEffect } from 'react';
import Artplayer from 'artplayer';
import Hls from 'hls.js';
import { getCurrentTheme } from '../store/theme';
import { revokeBlobUrl } from '../utils/adblock';
```

### Linting
- ESLint with TypeScript plugin
- Key rules:
  - `@typescript-eslint/no-explicit-any` — error (exceptions allowed with eslint-disable)
  - `react-hooks/exhaustive-deps` — error
  - `react-hooks/rules-of-hooks` — error

---

## Accessibility

- Semantic HTML elements where possible
- `aria-label` on icon-only buttons
- Dark mode color contrast is maintained via the theme system
- Focus states handled by browser defaults

---

## Performance

- `React.memo` for pure components that render frequently
- `useCallback` for event handlers passed to child components
- `useRef` for values that should not trigger re-renders
- Blob URL cleanup in Player component (`URL.revokeObjectURL`)
- Image lazy loading via scrolling detection (LazyGrid, ScrollableRow)
- Dexie queries are async and non-blocking
- `StrictMode` enabled in dev

---

## Testing

- No test infrastructure currently set up
- UI is visually driven with Tailwind utility classes

---

## Forbidden Patterns

- ❌ Class components
- ❌ `any` without eslint-disable comment explaining why
- ❌ Inline styles (`style={{}}`)
- ❌ Direct `fetch()` calls — use `api/` modules
- ❌ Component-level CSS files
- ❌ Redux / Zustand / any state management library
- ❌ `localStorage` for anything beyond auth token and dismissed announcement
- ❌ Leftover `console.log` in committed code

---

## Browser Support

- Modern browsers (Chrome, Firefox, Safari, Edge — latest 2 versions)
- PWA requires HTTPS (or localhost)
- HLS playback depends on HLS.js (not natively supported in all browsers)
- Mobile support with bottom navigation and safe-area-inset
