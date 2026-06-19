interface CapsuleSwitchProps {
  options: { label: string; value: string }[];
  active: string;
  onChange: (value: string) => void;
  className?: string;
}

export function CapsuleSwitch({ options, active, onChange, className }: CapsuleSwitchProps) {
  const activeIndex = options.findIndex((o) => o.value === active);
  const count = options.length;

  return (
    <div className={`rounded-full glass-panel shadow-sm ${className || ''}`}>
      <div className="relative flex p-0.5">
        {/* Sliding indicator — CSS-only positioning via percentages.
            No JS measurement, immune to ancestor CSS transforms (e.g. scale-90 on mobile). */}
        <div
          className="absolute top-0.5 rounded-full transition-all motion-reduce:transition-none duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] shadow-sm"
          style={{
            width: `calc(${100 / count}% - 4px)`,
            height: 'calc(100% - 4px)',
            left: `calc(${(activeIndex / count) * 100}% + 2px)`,
            background:
              'linear-gradient(135deg, rgba(var(--color-primary-rgb), 0.9), rgba(var(--color-primary-dim-rgb), 0.9))',
            pointerEvents: 'none',
            willChange: 'left, width',
          }}
        />
        {options.map((option) => {
          const isActive = option.value === active;
          return (
            <button
              key={option.value}
              onClick={() => onChange(option.value)}
              className={`flex-1 relative z-10 px-5 py-2.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors duration-200 select-none ${
                isActive
                  ? 'text-white'
                  : 'text-muted hover:text-text hover:bg-white/[0.06]'
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
