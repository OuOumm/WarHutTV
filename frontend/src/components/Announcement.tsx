import { useState, useEffect } from 'react';
import { getCurrentTheme } from '../store/theme';

interface AnnouncementProps {
  content: string;
  siteName: string;
  onDismiss: () => void;
}

const Announcement = ({ content, siteName, onDismiss }: AnnouncementProps) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const theme = getCurrentTheme();

  useEffect(() => {
    // 延迟显示，让页面加载完成
    const timer = setTimeout(() => setIsVisible(true), 300);
    return () => clearTimeout(timer);
  }, []);

  const handleDismiss = () => {
    setIsExiting(true);
    setTimeout(onDismiss, 400);
  };

  // 根据主题获取特色装饰
  const getThemeDecoration = () => {
    const { accentEffect } = theme.visual;

    const decorations: Record<string, { icon: string; gradient: string }> = {
      curtain: {
        icon: '🎭',
        gradient: 'linear-gradient(135deg, rgba(225, 29, 72, 0.08), rgba(244, 114, 182, 0.04))',
      },
      filmstrip: {
        icon: '🎬',
        gradient: 'linear-gradient(135deg, rgba(230, 185, 30, 0.08), rgba(251, 191, 36, 0.04))',
      },
      nebula: {
        icon: '✨',
        gradient: 'linear-gradient(135deg, rgba(0, 212, 255, 0.08), rgba(139, 92, 246, 0.04))',
      },
      ember: {
        icon: '🌿',
        gradient: 'linear-gradient(135deg, rgba(245, 158, 11, 0.08), rgba(16, 185, 129, 0.04))',
      },
      frost: {
        icon: '❄️',
        gradient: 'linear-gradient(135deg, rgba(96, 165, 250, 0.08), rgba(147, 197, 253, 0.04))',
      },
      petal: {
        icon: '🌸',
        gradient: 'linear-gradient(135deg, rgba(249, 168, 212, 0.08), rgba(244, 114, 182, 0.04))',
      },
    };

    return decorations[accentEffect] || decorations.curtain;
  };

  const decoration = getThemeDecoration();

  return (
    <div
      className={`fixed inset-0 z-[100] flex items-center justify-center p-4 transition-all duration-400 ${
        isVisible && !isExiting ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}
      style={{ backdropFilter: 'blur(12px)', background: 'rgba(0, 0, 0, 0.6)' }}
    >
      <div
        className={`relative w-full max-w-md transform transition-all duration-500 ${
          isVisible && !isExiting ? 'scale-100 translate-y-0' : 'scale-95 translate-y-8'
        }`}
        style={{
          animation: isVisible ? 'announcementSlideUp 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards' : 'none',
        }}
      >
        {/* 背景光晕 */}
        <div
          className="absolute -inset-8 rounded-3xl blur-3xl opacity-30 pointer-events-none"
          style={{ background: decoration.gradient }}
        />

        {/* 主卡片 */}
        <div
          className="relative overflow-hidden rounded-2xl border"
          style={{
            background: `linear-gradient(180deg, var(--color-card), var(--color-surface))`,
            borderColor: 'var(--color-glass-border)',
            boxShadow: `
              0 0 0 1px var(--color-glass-border),
              0 20px 60px rgba(0, 0, 0, 0.5),
              0 0 40px var(--color-primary-glow)
            `,
          }}
        >
          {/* 顶部装饰条 */}
          <div
            className="absolute top-0 left-0 right-0 h-1"
            style={{
              background: `linear-gradient(90deg, transparent, var(--color-primary), transparent)`,
              animation: 'announcementGlow 3s ease-in-out infinite',
            }}
          />

          {/* 主题纹理叠加 */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: decoration.gradient,
              opacity: 0.5,
            }}
          />

          {/* 内容区域 */}
          <div className="relative p-6 sm:p-8">
            {/* 头部 */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{decoration.icon}</span>
                <div>
                  <h2
                    className="text-xl font-bold tracking-tight"
                    style={{ color: 'var(--color-text)' }}
                  >
                    {siteName}
                  </h2>
                  <p
                    className="text-xs tracking-wider uppercase mt-0.5"
                    style={{ color: 'var(--color-muted)' }}
                  >
                    站点公告
                  </p>
                </div>
              </div>
            </div>

            {/* 公告内容 */}
            <div
              className="rounded-xl p-4 mb-6"
              style={{
                background: 'var(--color-glass)',
                border: '1px solid var(--color-glass-border)',
              }}
            >
              <p
                className="text-sm leading-relaxed whitespace-pre-wrap"
                style={{ color: 'var(--color-text)' }}
              >
                {content}
              </p>
            </div>

            {/* 操作按钮 */}
            <button
              onClick={handleDismiss}
              className="w-full py-3.5 rounded-xl font-semibold text-sm tracking-wider transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
              style={{
                background: `linear-gradient(135deg, var(--color-primary), var(--color-primary-dim))`,
                color: 'var(--color-deep)',
                boxShadow: `
                  0 4px 16px var(--color-primary-glow),
                  0 0 0 1px var(--color-glass-border)
                `,
              }}
            >
              我已知晓
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes announcementSlideUp {
          from {
            opacity: 0;
            transform: translateY(30px) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        @keyframes announcementGlow {
          0%, 100% {
            opacity: 0.3;
            transform: scaleX(0.8);
          }
          50% {
            opacity: 0.8;
            transform: scaleX(1);
          }
        }
      `}</style>
    </div>
  );
};

export default Announcement;
