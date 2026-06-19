import { useRef, useState, useEffect } from 'react';

interface CapsuleSwitchProps {
  options: { label: string; value: string }[];
  active: string;
  onChange: (value: string) => void;
  className?: string;
}

export function CapsuleSwitch({ options, active, onChange, className }: CapsuleSwitchProps) {
  const activeRef = useRef<HTMLButtonElement>(null);
  const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0 });

  useEffect(() => {
    if (activeRef.current) {
      const parent = activeRef.current.parentElement;
      if (parent) {
        const parentRect = parent.getBoundingClientRect();
        const activeRect = activeRef.current.getBoundingClientRect();
        setIndicatorStyle({
          left: activeRect.left - parentRect.left,
          width: activeRect.width,
        });
      }
    }
  }, [active]);

  return (
    <div className={`rounded-full glass-panel shadow-sm ${className || ''}`}>
      <div className="relative flex p-1">
        <div
          className="absolute rounded-full transition-all duration-300 ease-out"
          style={{
            width: `${indicatorStyle.width}px`,
            height: 'calc(100% - 8px)',
            top: '4px',
            left: `${indicatorStyle.left}px`,
            background: 'linear-gradient(135deg, rgba(var(--color-primary-rgb), 0.9), rgba(var(--color-primary-dim-rgb), 0.9))',
            pointerEvents: 'none',
          }}
        />
        {options.map((option) => (
          <button
            key={option.value}
            ref={option.value === active ? activeRef : null}
            onClick={() => onChange(option.value)}
            className={`relative z-10 px-4 py-2.5 rounded-full text-xs font-medium transition-colors duration-200 select-none ${
              option.value === active
                ? 'text-white'
                : 'text-muted hover:text-text'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
