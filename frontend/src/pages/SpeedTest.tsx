import { useState } from 'react';
import apiClient from '../api/client';

interface SpeedResult {
  site: string;
  name: string;
  speed: number;
  status: 'testing' | 'success' | 'error';
  time: number;
}

const SpeedTest = () => {
  const [results, setResults] = useState<SpeedResult[]>([]);
  const [testing, setTesting] = useState(false);

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
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">播放源测速</h1>
        <button
          onClick={testAllSites}
          disabled={testing}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white rounded-lg transition-colors"
        >
          {testing ? '测速中...' : '开始测速'}
        </button>
      </div>

      {results.length > 0 && (
        <div className="bg-gray-800 rounded-lg overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="px-4 py-3 text-left text-gray-300">源名称</th>
                <th className="px-4 py-3 text-left text-gray-300">状态</th>
                <th className="px-4 py-3 text-left text-gray-300">响应时间</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r) => (
                <tr key={r.site} className="border-b border-gray-700/50">
                  <td className="px-4 py-3 text-white">{r.name}</td>
                  <td className="px-4 py-3">
                    {r.status === 'testing' && (
                      <span className="text-yellow-400">测试中...</span>
                    )}
                    {r.status === 'success' && (
                      <span className="text-green-400">可用 ({r.time}ms)</span>
                    )}
                    {r.status === 'error' && (
                      <span className="text-red-400">不可用</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-400">
                    {r.status === 'success' ? `${r.time}ms` : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {results.length === 0 && !testing && (
        <div className="text-center text-gray-400 py-16">
          <p>点击"开始测速"检测所有播放源的可用性</p>
        </div>
      )}
    </div>
  );
};

export default SpeedTest;
