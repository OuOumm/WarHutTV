import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';

export type ToastType = 'error' | 'success' | 'info';

interface ToastItemData {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  /** Show a transient toast. `type` controls colour/icon; `duration` overrides the default. */
  toast: (message: string, type?: ToastType, duration?: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const STYLE: Record<ToastType, {
  bg: string;
  border: string;
  text: string;
  glow: string;
  icon: string;
}> = {
  error: {
    bg: 'rgba(239, 68, 68, 0.12)',
    border: 'rgba(239, 68, 68, 0.3)',
    text: '#fca5a5',
    glow: 'rgba(239, 68, 68, 0.15)',
    icon: 'M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  },
  success: {
    bg: 'rgba(34, 197, 94, 0.12)',
    border: 'rgba(34, 197, 94, 0.3)',
    text: '#86efac',
    glow: 'rgba(34, 197, 94, 0.15)',
    icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
  },
  info: {
    bg: 'var(--color-primary-glow)',
    border: 'var(--color-glass-border)',
    text: 'var(--color-primary)',
    glow: 'var(--color-primary-glow)',
    icon: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  },
};

const DEFAULT_DURATION = 3000;
const MAX_VISIBLE = 3;

function ToastItem({
  message,
  type,
  duration,
  onClose,
}: {
  message: string;
  type: ToastType;
  duration: number;
  onClose: () => void;
}) {
  const [show, setShow] = useState(false);
  const [exit, setExit] = useState(false);
  const s = STYLE[type];

  useEffect(() => {
    const raf = requestAnimationFrame(() => setShow(true));
    const hideTimer = setTimeout(() => {
      setExit(true);
      setTimeout(onClose, 300);
    }, duration);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(hideTimer);
    };
  }, [duration, onClose]);

  return (
    <div
      role={type === 'error' ? 'alert' : 'status'}
      aria-live={type === 'error' ? 'assertive' : 'polite'}
      aria-atomic="true"
      className={`pointer-events-auto transition-all duration-300 ease-out ${
        show && !exit
          ? 'opacity-100 translate-y-0 scale-100'
          : 'opacity-0 -translate-y-2 scale-95'
      }`}
    >
      <div
        className="relative flex items-center gap-2 px-3.5 py-2 rounded-lg backdrop-blur-xl whitespace-nowrap"
        style={{
          background: s.bg,
          border: `1px solid ${s.border}`,
          boxShadow: `0 4px 16px rgba(0, 0, 0, 0.2), 0 0 12px ${s.glow}`,
        }}
      >
        <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke={s.text} strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d={s.icon} />
        </svg>
        <span className="text-xs font-medium" style={{ color: s.text }}>
          {message}
        </span>
      </div>
    </div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItemData[]>([]);
  const idRef = useRef(0);

  const remove = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback((message: string, type: ToastType = 'info', duration = DEFAULT_DURATION) => {
    const id = ++idRef.current;
    setToasts((prev) => [...prev, { id, message, type }].slice(-MAX_VISIBLE));
    // Auto-remove after the visible window (matches ToastItem timing).
    setTimeout(() => remove(id), duration + 350);
  }, [remove]);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[1000] flex flex-col items-center gap-2 pointer-events-none">
        {toasts.map((t) => (
          <ToastItem
            key={t.id}
            message={t.message}
            type={t.type}
            duration={DEFAULT_DURATION}
            onClose={() => remove(t.id)}
          />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return ctx;
}
