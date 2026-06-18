import { useState, useEffect } from 'react';
import { getCurrentTheme } from '../store/theme';

interface ToastProps {
  message: string;
  type?: 'error' | 'success' | 'info';
  duration?: number;
  onClose: () => void;
}

const Toast = ({ message, type = 'error', duration = 2500, onClose }: ToastProps) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const theme = getCurrentTheme();

  useEffect(() => {
    requestAnimationFrame(() => setIsVisible(true));

    const timer = setTimeout(() => {
      setIsExiting(true);
      setTimeout(onClose, 300);
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  // 根据类型获取样式配置
  const styleConfig = {
    error: {
      bg: 'rgba(239, 68, 68, 0.12)',
      bgArrow: 'rgba(239, 68, 68, 0.15)',
      border: 'rgba(239, 68, 68, 0.3)',
      icon: 'M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
      text: '#fca5a5',
      glow: 'rgba(239, 68, 68, 0.15)',
    },
    success: {
      bg: 'rgba(34, 197, 94, 0.12)',
      bgArrow: 'rgba(34, 197, 94, 0.15)',
      border: 'rgba(34, 197, 94, 0.3)',
      icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
      text: '#86efac',
      glow: 'rgba(34, 197, 94, 0.15)',
    },
    info: {
      bg: theme.colors.primaryGlow,
      bgArrow: theme.colors.primaryGlow,
      border: theme.colors.glassBorder,
      icon: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
      text: theme.colors.primary,
      glow: theme.colors.primaryGlow,
    },
  };

  const s = styleConfig[type];

  return (
    <div
      className={`absolute left-1/2 -translate-x-1/2 z-50 transition-all duration-300 ease-out ${
        isVisible && !isExiting 
          ? 'opacity-100 translate-y-0 scale-100' 
          : 'opacity-0 translate-y-3 scale-95'
      }`}
      style={{ top: '-52px' }}
    >
      {/* 气泡主体 */}
      <div
        className="relative flex items-center gap-2 px-3.5 py-2 rounded-lg backdrop-blur-xl whitespace-nowrap"
        style={{
          background: s.bg,
          border: `1px solid ${s.border}`,
          boxShadow: `0 4px 16px rgba(0, 0, 0, 0.2), 0 0 12px ${s.glow}`,
        }}
      >
        <svg
          className="w-3.5 h-3.5 shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke={s.text}
          strokeWidth={2.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d={s.icon} />
        </svg>
        
        <span className="text-xs font-medium" style={{ color: s.text }}>
          {message}
        </span>
      </div>

      {/* 小箭头朝下 */}
      <div
        className="absolute -bottom-[5px] left-1/2 -translate-x-1/2 w-[10px] h-[10px] rotate-45"
        style={{
          background: s.bgArrow,
          borderRight: `1px solid ${s.border}`,
          borderBottom: `1px solid ${s.border}`,
        }}
      />
    </div>
  );
};

export default Toast;
