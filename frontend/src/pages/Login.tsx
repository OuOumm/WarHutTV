import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useConfig } from '../store/config';
import Toast from '../components/Toast';

const Login = () => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { login } = useAuth();
  const navigate = useNavigate();
  const { siteName } = useConfig();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(password);
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.error || '登录失败');
    } finally {
      setLoading(false);
    }
  };

  const handleToastClose = useCallback(() => {
    setError('');
  }, []);

  // 登录失败后恢复输入框焦点（disabled→enabled 时浏览器不会自动恢复）
  useEffect(() => {
    if (!loading && error) {
      inputRef.current?.focus();
    }
  }, [loading, error]);

  // 晃动动画（错误时触发）
  const [shake, setShake] = useState(false);
  useEffect(() => {
    if (error) {
      setShake(true);
      const t = setTimeout(() => setShake(false), 500);
      return () => clearTimeout(t);
    }
  }, [error]);

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center px-4 overflow-hidden">
      {/* 装饰性色块 — 左上角主题色晕 */}
      <div className="fixed top-[-200px] left-[-200px] w-[500px] h-[500px] rounded-full opacity-[0.08] pointer-events-none"
        style={{ background: `radial-gradient(circle, var(--color-primary) 0%, transparent 70%)` }} />

      {/* 内容 */}
      <div className={`w-full max-w-sm transition-all duration-700 ${shake ? 'animate-[shake_0.4s_ease-in-out]' : ''}`}
        style={{ animation: 'cardSlideUp 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) backwards' }}>

        {/* Logo + 品牌 */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-glass backdrop-blur-xl border border-glass-border mb-5"
            style={{ animation: 'logoPulse 3s ease-in-out infinite' }}>
            <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none">
              <path d="M3 16l3-2v4l-3-2zM8 14l3-2v6l-3-2zM13 12l3-2v8l-3-2zM18 10l3-2v10l-3-2z" fill="var(--color-primary)"/>
              <path d="M3 8l9-6 9 6" stroke="var(--color-primary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <h1 className="text-4xl font-black tracking-tight">
            {siteName}
          </h1>
          <p className="text-muted mt-2 text-sm tracking-wide">聚合影视信息</p>
        </div>

        {/* 登录卡片 */}
        <div className="glass-panel rounded-2xl p-8 shadow-2xl relative overflow-visible"
          style={{
            boxShadow: '0 8px 40px rgba(0,0,0,0.4), 0 0 0 1px var(--color-glass-border), 0 0 40px var(--color-primary-glow)',
          }}>

          {/* 卡片顶部装饰线 */}
          <div className="absolute top-0 left-8 right-8 h-[2px] rounded-full opacity-60"
            style={{
              background: `linear-gradient(90deg, transparent, var(--color-primary), transparent)`,
              animation: 'borderGlow 2s ease-in-out infinite',
            }} />

          <form onSubmit={handleSubmit} className="space-y-5 relative z-[1]">
            <div className="relative">
              <input
                ref={inputRef}
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error) setError('');
                }}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                placeholder="请输入访问密码"
                disabled={loading}
                autoFocus
                className="w-full px-4 py-3.5 bg-deep/60 backdrop-blur-sm border rounded-xl text-text placeholder-muted/50
                  transition-all duration-300 outline-none"
                style={{
                  borderColor: focused ? 'var(--color-primary)' : error ? 'rgba(239, 68, 68, 0.5)' : 'var(--color-glass-border)',
                  boxShadow: focused
                    ? `0 0 0 2px var(--color-primary-glow), 0 0 16px var(--color-primary-glow)`
                    : error
                      ? `0 0 0 2px rgba(239, 68, 68, 0.15), 0 0 12px rgba(239, 68, 68, 0.1)`
                      : 'none',
                }}
              />
              {/* 聚焦指示器 */}
              <div className="absolute right-3 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full transition-all duration-300"
                style={{
                  background: error ? '#ef4444' : focused ? 'var(--color-primary)' : 'var(--color-muted)',
                  boxShadow: error ? '0 0 6px #ef4444' : focused ? '0 0 6px var(--color-primary)' : 'none',
                  opacity: password || error ? 1 : 0.3,
                }} />

              {/* Toast 气泡提示 */}
              {error && (
                <Toast
                  message={error}
                  type="error"
                  duration={2500}
                  onClose={handleToastClose}
                />
              )}
            </div>

            <button
              type="submit"
              disabled={loading || !password}
              className="relative w-full py-3.5 rounded-xl font-semibold text-sm tracking-wider overflow-hidden
                transition-all duration-300 active:scale-[0.97]"
              style={{
                background: `linear-gradient(135deg, var(--color-primary), var(--color-primary-dim))`,
                color: 'var(--color-deep)',
                boxShadow: `0 4px 16px var(--color-primary-glow), 0 0 0 1px var(--color-glass-border)`,
                opacity: loading || !password ? 0.5 : 1,
              }}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.3"/>
                    <path d="M12 2a10 10 0 019.95 9" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
                  </svg>
                  登录中...
                </span>
              ) : '进入'}
            </button>
          </form>

          {/* 底部装饰 */}
          <div className="mt-6 text-center">
            <p className="text-muted/40 text-[10px] tracking-[0.2em] uppercase">影音无界 · 即刻启幕</p>
          </div>
        </div>

        {/* 底部版本号 */}
        <p className="text-center mt-8 text-muted/30 text-[11px] tracking-wider">v2.0 · {siteName}</p>
      </div>

      <style>{`
        @keyframes cardSlideUp {
          from { opacity: 0; transform: translateY(30px) scale(0.97); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes logoPulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.05); opacity: 0.85; }
        }
        @keyframes borderGlow {
          0%, 100% { opacity: 0.3; transform: scaleX(0.8); }
          50% { opacity: 0.8; transform: scaleX(1); }
        }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          10%, 50%, 90% { transform: translateX(-4px); }
          30%, 70% { transform: translateX(4px); }
        }
      `}</style>
    </div>
  );
};

export default Login;
