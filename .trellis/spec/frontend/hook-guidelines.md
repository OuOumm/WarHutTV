# Hook Guidelines

> Custom hook conventions and patterns.

---

## Current Hooks

| Hook | Purpose | State | Dependencies |
|------|---------|-------|-------------|
| `useAnnouncement` | Controls announcement banner visibility based on dismissed state | `isVisible` | `isAuthenticated`, `config` |
| `useAuth` | Wraps `AuthContext` consumption | `isAuthenticated`, `isLoading` | — |
| `useDocumentTitle` | Dynamically updates document title and `<meta>` tags | — (side effect) | `siteName` |
| `useDynamicManifest` | Generates and applies PWA manifest blob URL | — (side effect) | `siteName` |
| `useVersionCheck` | Checks backend version against frontend | TBD | — |

---

## Hook Naming

- Always prefix with `use` (camelCase)
- Name reflects the value or concept, not the implementation:
  - ✅ `useAnnouncement`, `useDocumentTitle`
  - ❌ `useLocalStorage`, `useGetRequest`

## Hook Patterns

### Simple State Hook
```tsx
export const useAnnouncement = (isAuthenticated: boolean) => {
  const { config, refresh } = useConfig();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (!isAuthenticated || !config) return;
    // ... check dismissed state
  }, [isAuthenticated, config]);

  const dismiss = () => { /* ... */ };

  return { config, isVisible, dismiss, refresh };
};
```

### Side-Effect-Only Hook (no return value)
```tsx
export function useDocumentTitle() {
  const { siteName } = useConfig();

  useEffect(() => {
    if (!siteName) return;
    document.title = siteName;
    // ... update meta tags
  }, [siteName]);
}
```

### Context Consumer Hook
```tsx
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
```

---

## Rules

- Hooks call hooks at the top level (no conditional hook calls)
- Hooks that consume Context throw a descriptive error when used outside the Provider
- Side-effect hooks return nothing (the effect is the purpose)
- State hooks return the state + setters/actions as an object
- Use `useRef` for storing mutable values that should not trigger re-renders (callbacks, timestamps)
- Use `useCallback` for functions passed as dependencies to child components or effects

---

## Forbidden Patterns

- ❌ Hooks that return JSX (those should be components)
- ❌ Hooks that mix data fetching with UI logic
- ❌ Hooks defined inside components (lift them to `hooks/` or co-locate in the component file if trivial)
- ❌ Hooks with ambiguous names (`useData`, `useStuff`)
