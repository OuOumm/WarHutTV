import { useState, useMemo } from 'react';
import apiClient from '../api/client';
import PageContainer from '../components/PageContainer';

interface PingResult {
  site: string;
  name: string;
  ok: boolean;
  ms: number;
  count: number;
  error?: string;
}

interface SpeedResult extends PingResult {
  status: 'success' | 'error';
}

/* ---------- shared UI fragments ---------- */

const SpinnerIcon = ({ className = 'h-4 w-4' }: { className?: string }) => (
  <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.3" />
    <path d="M12 2a10 10 0 019.95 9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
  </svg>
);

const STATUS_CONFIG: Record<
  string,
  { icon: React.JSX.Element; label: string; className: string }
> = {
  testing: {
    icon: <SpinnerIcon className="h-3.5 w-3.5" />,
    label: '测试中...',
    className: 'text-yellow-400',
  },
  success: {
    icon: (
      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    label: '可用',
    className: 'text-green-400',
  },
  error: {
    icon: (
      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    label: '不可用',
    className: 'text-red-400',
  },
} as const;

/* ---------- sub-components ---------- */

const TestButton = ({
  testing,
  onClick,
}: {
  testing: boolean;
  onClick: () => void;
}) => (
  <button
    onClick={onClick}
    disabled={testing}
    className="px-5 py-2.5 bg-primary hover:bg-primary-dim text-deep rounded-xl transition-all duration-200 font-medium shadow-sm hover:shadow-md hover:shadow-primary/20 active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed"
  >
    {testing ? (
      <span className="flex items-center gap-2">
        <SpinnerIcon />
        测速中...
      </span>
    ) : (
      '开始测速'
    )}
  </button>
);

const EmptyState = () => (
  <div className="text-center text-muted py-20">
    <div className="w-16 h-16 rounded-full bg-surface mx-auto mb-4 flex items-center justify-center">
      <svg className="w-8 h-8 text-primary/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    </div>
    <p className="text-lg text-text/80">尚未测速</p>
    <p className="mt-2 text-sm">点击「开始测速」检测所有播放源的可用性</p>
  </div>
);

const SummaryBar = ({
  successCount,
  errorCount,
  total,
}: {
  successCount: number;
  errorCount: number;
  total: number;
}) => (
  <div className="px-4 py-2.5 border-t border-glass-border/20 flex items-center gap-3 text-xs text-muted">
    <span className="text-green-400">可用: {successCount}</span>
    <span className="text-red-400">不可用: {errorCount}</span>
    <span className="text-muted/70">共 {total} 个源</span>
  </div>
);

/* ---------- main component ---------- */

const SpeedTest = () => {
  const [results, setResults] = useState<SpeedResult[]>([]);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState('');

  const counts = useMemo(
    () =>
      results.reduce(
        (acc, r) => {
          if (r.ok) acc.success++;
          else acc.error++;
          return acc;
        },
        { success: 0, error: 0 }
      ),
    [results]
  );

  const showSummary = !testing && results.length > 0;

  const testAllSites = async () => {
    setTesting(true);
    setResults([]);
    setError('');

    try {
      // The backend probes every configured source in parallel (bounded) and
      // returns measured latency, so the numbers shown are real round-trips
      // instead of the HTML-download time the old /api/search call produced.
      const res = await apiClient.get<{ results: PingResult[] }>('/sites/ping', {
        timeout: 60000,
      });
      const rows = res.data.results ?? [];
      setResults(rows.map((r) => ({ ...r, status: r.ok ? 'success' : 'error' })));
    } catch (err) {
      // 401 is handled globally by the api client; anything else is worth
      // showing instead of silently leaving an empty table.
      const message =
        err instanceof Error ? err.message : '测速请求失败，请稍后重试';
      setError(message);
      console.error('测速失败:', err);
    } finally {
      setTesting(false);
    }
  };

  return (
    <PageContainer className="max-w-3xl mx-auto page-enter">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-text">播放源测速</h1>
          <p className="text-sm text-muted mt-0.5">检测所有配置的视频源响应速度</p>
        </div>
        <TestButton testing={testing} onClick={testAllSites} />
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {testing && (
        <p className="text-sm text-muted mb-3">正在探测所有源…</p>
      )}

      {(results.length > 0 || testing) && (
        <div className="glass-panel rounded-xl overflow-hidden border border-glass-border shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-glass-border/50">
                <th className="px-4 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">源名称</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">状态</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-muted uppercase tracking-wider">响应时间</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r) => (
                <tr key={r.site} className="border-b border-glass-border/20 hover:bg-white/[0.02] transition-colors">
                  <td className="px-4 py-3.5 text-text font-medium">
                    {r.name || r.site}
                    {!r.ok && r.error && (
                      <span className="block text-xs font-normal text-muted truncate max-w-xs" title={r.error}>
                        {r.error}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3.5">
                    <span className={`inline-flex items-center gap-1.5 ${STATUS_CONFIG[r.status].className}`}>
                      {STATUS_CONFIG[r.status].icon}
                      {STATUS_CONFIG[r.status].label}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-right tabular-nums">
                    {r.ok ? (
                      <span className="text-text">
                        {r.ms}ms
                        <span className="block text-xs text-muted">{r.count} 条</span>
                      </span>
                    ) : (
                      <span className="text-muted">{r.ms}ms</span>
                    )}
                  </td>
                </tr>
              ))}
              {testing && results.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-10 text-center text-muted">
                    <span className="inline-flex items-center gap-2">
                      <SpinnerIcon />
                      正在探测所有源…
                    </span>
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {showSummary && (
            <SummaryBar
              successCount={counts.success}
              errorCount={counts.error}
              total={results.length}
            />
          )}
        </div>
      )}

      {results.length === 0 && !testing && !error && <EmptyState />}
    </PageContainer>
  );
};

export default SpeedTest;
