import { useEffect, useRef, useState } from 'react';

interface WeekdaySelectorProps {
  value: string;
  onChange: (weekday: string) => void;
  className?: string;
}

const weekdays = [
  { value: 'Mon', label: '周一' },
  { value: 'Tue', label: '周二' },
  { value: 'Wed', label: '周三' },
  { value: 'Thu', label: '周四' },
  { value: 'Fri', label: '周五' },
  { value: 'Sat', label: '周六' },
  { value: 'Sun', label: '周日' },
];

// 获取今天对应的星期英文缩写（与 bgm.tv calendar 的 weekday.en 一致）
export const getTodayWeekday = (): string => {
  const weekdayMap = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return weekdayMap[new Date().getDay()];
};

const WeekdaySelector = ({ value, onChange, className = '' }: WeekdaySelectorProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [indicator, setIndicator] = useState({ left: 0, width: 0 });

  useEffect(() => {
    const idx = weekdays.findIndex((w) => w.value === value);
    if (idx >= 0 && buttonRefs.current[idx]) {
      const btn = buttonRefs.current[idx]!;
      setIndicator({ left: btn.offsetLeft, width: btn.offsetWidth });
    }
  }, [value]);

  return (
    <div
      ref={containerRef}
      className={`relative inline-flex items-center bg-gray-100/80 dark:bg-gray-800/60 rounded-lg p-1 ${className}`}
    >
      <div
        className="absolute top-1 bottom-1 bg-white dark:bg-gray-700 rounded-md shadow-sm transition-all duration-200"
        style={{ left: indicator.left, width: indicator.width }}
      />
      {weekdays.map((weekday, i) => {
        const isActive = value === weekday.value;
        return (
          <button
            key={weekday.value}
            ref={(el) => { buttonRefs.current[i] = el; }}
            onClick={() => onChange(weekday.value)}
            className={`relative z-10 px-3 py-1.5 text-sm rounded-md transition-colors whitespace-nowrap ${
              isActive
                ? 'text-green-600 dark:text-green-400 font-medium'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            {weekday.label}
          </button>
        );
      })}
    </div>
  );
};

export default WeekdaySelector;
