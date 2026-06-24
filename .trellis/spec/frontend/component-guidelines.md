# Component Guidelines

> How components are built in this project.

---

## Component Patterns

### Functional Components with Explicit Types

All components are function components with explicit prop types:

```tsx
interface PlayerProps {
  url: string;
  title?: string;
  currentTime?: number;
  onTimeUpdate?: (time: number) => void;
}

const Player = ({ url, title, currentTime, onTimeUpdate }: PlayerProps) => {
  // ...
};
```

### Props Interface Convention
- Define `ComponentNameProps` interface above the component
- Use `interface` (not `type`) for props
- Optional props marked with `?`
- No `React.FC` / `FunctionComponent` — inline prop destructuring instead

### Context Provider Pattern

Global state providers follow the Context + Provider pattern:

```tsx
const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState(initial);
  return (
    <AuthContext.Provider value={{ ...state }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
```

### Memoization

- Use `React.memo` for pure presentational components (`Layout`, `SearchIcon`)
- Use `useCallback` for event handlers passed as props
- Use `useRef` for mutable values that shouldn't trigger re-renders (callbacks, previous blob URLs, seek flags)

### Layout Component Pattern

The `Layout` component is a shared shell wrapped around page content:

```tsx
// App.tsx
<Route path="/" element={<Layout><Home /></Layout>} />
```

Layout handles:
- Desktop sidebar + mobile bottom navigation
- Theme switcher and user menu
- Ambient visual effects (orb layer)
- Responsive padding between desktop and mobile

---

## Data Flow

1. **API calls** → `api/*.ts` functions return typed promises
2. **Store operations** → `store/*.ts` functions abstract IndexedDB CRUD
3. **State** → React Context for global config/auth, component-local `useState` for UI state
4. **Effects** → `useEffect` for side effects (auth check, config fetch, cache cleanup)

---

## Styling

- **Tailwind CSS** for all styling
- CSS custom properties for dynamic theming (set via `theme.ts` `applyTheme()`)
- Dark mode forced: `document.documentElement.classList.add('dark')`
- Chinese font stack via Tailwind config

Common utility class patterns:
- `bg-deep` — deepest background layer
- `bg-card` — card background
- `bg-surface` — elevated surface
- `text-primary` — primary/emphasis text
- `text-muted` — secondary/subtle text
- `glass-panel` — glassmorphism effect

---

## Forbidden Patterns

- ❌ Class components
- ❌ CSS modules / styled-components / CSS-in-JS libraries
- ❌ `React.FC` type annotation
- ❌ Inline styles (use Tailwind classes)
- ❌ Direct DOM manipulation (use refs)
- ❌ Component-level CSS files
