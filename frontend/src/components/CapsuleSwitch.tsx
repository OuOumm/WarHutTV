import { useRef, useState, useEffect } from 'react';

interface CapsuleSwitchProps {
  options: { label: string; value: string }[];
  active: string;
  onChange: (value: string) => void;
}

const CapsuleSwitch = ({ options, active, onChange }: CapsuleSwitchProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [indicator, setIndicator] = useState({ left: 0, width: 0 });

  const activeIndex = options.findIndex((opt) => opt.value === active);

  useEffect(() => {
    const update = () => {
      if (activeIndex >= 0 && buttonRefs.current[activeIndex] && containerRef.current) {
        const btn = buttonRefs.current[activeIndex]!;
        setIndicator({
          left: btn.offsetLeft,
          width: btn.offsetWidth,
        });
      }
    };
    const t = setTimeout(update, 0);
    return () => clearTimeout(t);
  }, [activeIndex]);

  return (
    <div ref={containerRef} className="relative inline-flex bg-surface rounded-full p-1">
      {indicator.width > 0 && (
        <div
          className="absolute top-1 bottom-1 bg-card rounded-full shadow-md transition-all duration-300 ease-out"
          style={{ 
            left: `${indicator.left}px`, 
            width: `${indicator.width}px`,
            boxShadow: '0 0 12px var(--color-primary-glow), 0 2px 8px rgba(0,0,0,0.2)',
          }}
        />
      )}
      {options.map((opt, index) => (
        <button
          key={opt.value}
          ref={(el) => { buttonRefs.current[index] = el; }}
          onClick={() => onChange(opt.value)}
          className={`relative z-10 px-5 py-1.5 text-sm rounded-full font-medium transition-all duration-200 ${
            active === opt.value
              ? 'text-text'
              : 'text-muted hover:text-text'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
};

export default CapsuleSwitch;
