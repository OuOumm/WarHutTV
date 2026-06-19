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

/** 获取今天对应的星期英文缩写（与 bgm.tv calendar 的 weekday.en 一致） */
export const getTodayWeekday = (): string => {
  const weekdayMap = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
  return weekdayMap[new Date().getDay()];
};

const WeekdaySelector = ({ value, onChange, className = '' }: WeekdaySelectorProps) => {
  const activeIndex = weekdays.findIndex((w) => w.value === value);
  const count = weekdays.length;

  return (
    <div className={`relative inline-flex items-center bg-surface rounded-lg p-1 ${className}`}>
      {/* Sliding indicator — CSS-only positioning via percentages */}
      <div
        className="absolute top-1 bottom-1 bg-card rounded-md shadow-sm transition-all duration-200"
        style={{
          width: `calc(${100 / count}% - 2px)`,
          left: `calc(${(activeIndex / count) * 100}% + 1px)`,
          pointerEvents: 'none',
        }}
      />
      {weekdays.map((weekday) => {
        const isActive = value === weekday.value;
        return (
          <button
            key={weekday.value}
            onClick={() => onChange(weekday.value)}
            className={`relative z-10 flex-1 px-3 py-1.5 text-sm whitespace-nowrap transition-colors duration-200 ${
              isActive
                ? 'text-primary font-medium'
                : 'text-muted hover:text-text'
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
