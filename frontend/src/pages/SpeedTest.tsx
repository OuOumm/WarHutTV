import { useState, useMemo } from 'react';
import apiClient from '../api/client';

interface SpeedResult {
  site: string;
  name: string;
  speed: number;
  status: 'testing' | 'success' | 'error';
  time: number;
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

const TIME_RENDER = {
  testing: () => <span className="text-muted">-</span>,
  success: (r: SpeedResult) => <span className="text-text">{r.time}ms</span>,
  error: () => <span className="text-muted">超时</span>,
};

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
    <span className="text-muted/50">共 {total} 个源</span>
  </div>
);

/* ---------- main component ---------- */

const SpeedTest = () => {
  const [results, setResults] = useState<SpeedResult[]>([]);
  const [testing, setTesting] = useState(false);

  /* P1: single reduce + useMemo instead of two filter passes */
  const counts = useMemo(() => {
    return results.reduce(
      (acc, r) => {
        if (r.status === 'success') acc.success++;
        else if (r.status === 'error') acc.error++;
        return acc;
      },
      { success: 0, error: 0 }
    );
  }, [results]);

  const showSummary =
    !testing && results.some((r) => r.status === 'success' || r.status === 'error');

  const testAllSites = async () => {
    setTesting(true);
    setResults([]);

    try {
      const configRes = await apiClient.get('/config');
      const sites = configRes.data.api_site || {};

      const siteList = Object.entries(sites).map(([key, site]: [string, any]) => ({
        site: key,
        name: site.name,
      }));

      const testResults: SpeedResult[] = siteList.map((s) => ({
        ...s,
        speed: 0,
        status: 'testing' as const,
        time: 0,
      }));

      setResults(testResults);

      const promises = siteList.map(async (s, index) => {
        const start = Date.now();
        try {
          await apiClient.get('/search', {
            params: { site: s.site, wd: 'test' },
            timeout: 10000,
          });
          const time = Date.now() - start;
          setResults((prev) =>
            prev.map((r, i) =>
              i === index
                ? { ...r, speed: Math.round(10000 / time), status: 'success', time }
                : r
            )
          );
        } catch {
          const time = Date.now() - start;
          setResults((prev) =>
            prev.map((r, i) =>
              i === index ? { ...r, speed: 0, status: 'error', time } : r
            )
          );
        }
      });

      await Promise.allSettled(promises);
    } catch (error) {
      console.error('测速失败:', error);
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="px-2 sm:px-4 py-4 sm:py-6 max-w-3xl mx-auto overflow-visible page-enter">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-text">播放源测速</h1>
          <p className="text-sm text-muted mt-0.5">检测所有配置的视频源响应速度</p>
        </div>
        <TestButton testing={testing} onClick={testAllSites} />
      </div>

      {results.length > 0 && (
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
                  <td className="px-4 py-3.5 text-text font-medium">{r.name}</td>
                  <td className="px-4 py-3.5">
                    <span className={`inline-flex items-center gap-1.5 ${STATUS_CONFIG[r.status].className}`}>
                      {STATUS_CONFIG[r.status].icon}
                      {STATUS_CONFIG[r.status].label}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-right tabular-nums">
                    {TIME_RENDER[r.status](r)}
                  </td>
                </tr>
              ))}
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

      {results.length === 0 && !testing && <EmptyState />}
    </div>
  );
};

export default SpeedTest;
