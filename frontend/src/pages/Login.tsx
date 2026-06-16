import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

const Login = () => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

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

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-primary">WarHutTV</h1>
          <p className="text-muted mt-2 text-sm">影视聚合播放器</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="请输入访问密码"
              className="w-full px-4 py-3 bg-glass backdrop-blur-sm border border-glass-border rounded-xl text-text placeholder-muted focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-transparent transition-all shadow-sm"
              disabled={loading}
              autoFocus
            />
          </div>

          {error && (
            <div className="text-red-500 text-sm text-center">{error}</div>
          )}

          <button
            type="submit"
            disabled={loading || !password}
            className="w-full py-3 bg-primary hover:bg-primary-dim disabled:bg-gray-600 disabled:cursor-not-allowed text-deep font-medium rounded-xl transition-colors shadow-sm"
          >
            {loading ? '登录中...' : '进入'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;
