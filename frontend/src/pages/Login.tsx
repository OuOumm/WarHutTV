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
    } catch (err: unknown) {
      const message = err && typeof err === 'object' && 'response' in err
        ? (err as { response?: { data?: { error?: string } } }).response?.data?.error
        : undefined;
      setError(message || '登录失败');
    } finally {
      setLoading(false);
    }
  };

  const handleToastClose = useCallback(() => {
    setError('');
  }, []);

  // 登录失败后恢复输入框焦点
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

      {/* ======== 背景光晕层（3 颗主题色浮动光晕） ======== */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        {/* 主光晕 — 左上 */}
        <div
          className="absolute rounded-full animate-loginOrbA"
          style={{
            width: 'clamp(320px, 50vw, 520px)',
            height: 'clamp(320px, 50vw, 520px)',
            top: '-15%',
            left: '-10%',
            background: 'radial-gradient(circle, var(--color-primary) 0%, transparent 70%)',
            opacity: 0.10,
          }}
        />
        {/* 副光晕 — 右下 */}
        <div
          className="absolute rounded-full animate-loginOrbB"
          style={{
            width: 'clamp(240px, 35vw, 380px)',
            height: 'clamp(240px, 35vw, 380px)',
            bottom: '-10%',
            right: '-8%',
            background: 'radial-gradient(circle, var(--color-primary-dim) 0%, transparent 70%)',
            opacity: 0.07,
          }}
        />
        {/* 第三光晕 — 中上偏移 */}
        <div
          className="absolute rounded-full animate-loginOrbC"
          style={{
            width: 'clamp(160px, 20vw, 260px)',
            height: 'clamp(160px, 20vw, 260px)',
            top: '35%',
            left: '55%',
            background: 'radial-gradient(circle, var(--color-primary) 0%, transparent 70%)',
            opacity: 0.05,
          }}
        />
      </div>

      {/* ======== 主内容 ======== */}
      <div className={`w-full max-w-sm transition-all duration-700 ${shake ? 'animate-[shake_0.4s_ease-in-out]' : ''}`}>

        {/* ---- Logo + 品牌 ---- */}
        <div
          className="text-center mb-10"
          style={{ animation: 'cardSlideUp 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) backwards' }}
        >
          {/* Logo 聚光灯 */}
          <div className="relative inline-flex items-center justify-center mb-5">
            <div
              className="absolute inset-0 rounded-full animate-logoGlow"
              style={{
                width: 96,
                height: 96,
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                background: 'radial-gradient(circle, var(--color-primary) 0%, transparent 70%)',
                opacity: 0.15,
              }}
            />
            <div className="relative flex items-center justify-center w-16 h-16 rounded-2xl bg-glass backdrop-blur-xl border border-glass-border">
              <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none">
                <path
                  d="M3 16l3-2v4l-3-2zM8 14l3-2v6l-3-2zM13 12l3-2v8l-3-2zM18 10l3-2v10l-3-2z"
                  fill="var(--color-primary)"
                />
                <path
                  d="M3 8l9-6 9 6"
                  stroke="var(--color-primary)"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          </div>

          <h1 className="text-4xl font-black tracking-tight">{siteName}</h1>

          <p
            className="text-muted mt-2 text-sm tracking-wide"
            style={{ animation: 'fadeIn 0.6s ease-out 0.15s backwards' }}
          >
            聚合影视信息
          </p>
        </div>

        {/* ---- 登录卡片 ---- */}
        <div
          className="glass-panel rounded-2xl p-8 shadow-2xl relative overflow-hidden"
          style={{
            boxShadow: '0 8px 40px rgba(0,0,0,0.4), 0 0 0 1px var(--color-glass-border), 0 0 40px var(--color-primary-glow)',
            animation: 'cardSlideUp 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) 0.2s backwards',
          }}
        >
          {/* 卡片底部氛围反射光 */}
          <div
            className="absolute bottom-0 left-0 right-0 h-1/2 pointer-events-none rounded-b-2xl"
            style={{
              background: 'linear-gradient(0deg, var(--color-primary-glow) 0%, transparent 100%)',
              opacity: 0.4,
            }}
          />

          {/* 卡片顶部双层装饰线 */}
          <div className="absolute top-0 left-6 right-6 h-[2px] rounded-full opacity-40"
            style={{
              background: `linear-gradient(90deg, transparent, var(--color-primary), transparent)`,
              animation: 'borderGlow 3s ease-in-out infinite',
            }} />
          <div className="absolute top-[3px] left-16 right-16 h-[1px] rounded-full opacity-20"
            style={{
              background: `linear-gradient(90deg, transparent, var(--color-primary), transparent)`,
              animation: 'borderGlow 3s ease-in-out 1.5s infinite',
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
                    ? `0 0 0 2px var(--color-primary-glow), 0 0 20px var(--color-primary-glow)`
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
                transition-all duration-300 active:scale-[0.97] group"
              style={{
                background: `linear-gradient(135deg, var(--color-primary), var(--color-primary-dim))`,
                color: 'var(--color-deep)',
                boxShadow: `0 4px 16px var(--color-primary-glow), 0 0 0 1px var(--color-glass-border)`,
                opacity: loading || !password ? 0.5 : 1,
              }}
            >
              {/* hover 光晕 */}
              <span
                className="absolute inset-0 transition-opacity duration-300 opacity-0 group-hover:opacity-100"
                style={{
                  background: `linear-gradient(135deg, var(--color-primary), var(--color-primary-dim))`,
                  filter: 'brightness(1.2) saturate(1.4)',
                }}
              />
              <span className="absolute inset-0 transition-opacity duration-300 opacity-0 group-hover:opacity-40"
                style={{
                  boxShadow: `inset 0 0 30px var(--color-primary-glow)`,
                }} />

              <span className="relative z-[1]">
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.3" />
                      <path d="M12 2a10 10 0 019.95 9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                    </svg>
                    登录中...
                  </span>
                ) : '进入'}
              </span>
            </button>
          </form>

          {/* 底部标语 */}
          <p className="mt-6 text-center text-muted/40 text-[10px] tracking-[0.2em] uppercase"
            style={{ animation: 'fadeIn 0.8s ease-out 0.5s backwards' }}>
            影音无界 · 即刻启幕
          </p>
        </div>
      </div>

      <style>{`
        /* ---- 光晕浮动 ---- */
        @keyframes loginOrbA {
          0%   { transform: translate(0, 0) scale(1); }
          30%  { transform: translate(6%, 4%) scale(1.08); }
          60%  { transform: translate(-3%, 6%) scale(0.95); }
          100% { transform: translate(0, 0) scale(1); }
        }
        @keyframes loginOrbB {
          0%   { transform: translate(0, 0) scale(1); }
          40%  { transform: translate(-5%, -3%) scale(1.12); }
          70%  { transform: translate(4%, -6%) scale(0.92); }
          100% { transform: translate(0, 0) scale(1); }
        }
        @keyframes loginOrbC {
          0%   { transform: translate(0, 0) scale(1); opacity: 0.05; }
          25%  { transform: translate(8%, -4%) scale(1.15); opacity: 0.08; }
          50%  { transform: translate(-2%, 5%) scale(0.9); opacity: 0.04; }
          75%  { transform: translate(5%, 2%) scale(1.1); opacity: 0.07; }
          100% { transform: translate(0, 0) scale(1); opacity: 0.05; }
        }
        .animate-loginOrbA { animation: loginOrbA 10s ease-in-out infinite; }
        .animate-loginOrbB { animation: loginOrbB 13s ease-in-out infinite; }
        .animate-loginOrbC { animation: loginOrbC 16s ease-in-out infinite; }

        /* ---- Logo 聚光呼吸 ---- */
        @keyframes logoGlow {
          0%, 100% { transform: translate(-50%, -50%) scale(1); opacity: 0.12; }
          50%      { transform: translate(-50%, -50%) scale(1.3); opacity: 0.22; }
        }
        .animate-logoGlow { animation: logoGlow 3.5s ease-in-out infinite; }

        /* ---- 卡片入场 ---- */
        @keyframes cardSlideUp {
          from { opacity: 0; transform: translateY(24px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }

        /* ---- 淡入 ---- */
        @keyframes fadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }

        /* ---- 顶部装饰线呼吸 ---- */
        @keyframes borderGlow {
          0%, 100% { opacity: 0.3; transform: scaleX(0.8); }
          50%      { opacity: 0.7; transform: scaleX(1); }
        }

        /* ---- 晃动（错误时） ---- */
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          10%, 50%, 90% { transform: translateX(-5px); }
          30%, 70% { transform: translateX(5px); }
        }
      `}</style>
    </div>
  );
};

export default Login;
