import type { SpeedTestResult } from '../utils/speedtest';

interface SourceItem {
  key: string;
  name: string;
  poster?: string;
  episodeCount?: number;
  speed?: SpeedTestResult | null;
  status: 'pending' | 'testing' | 'done' | 'error';
}

// 优选动画组件
export const OptimizingOverlay = ({ sources }: {
  sources: SourceItem[];
}) => {
  const tested = sources.filter(s => s.status === 'done' || s.status === 'error').length;
  const total = sources.length;
  const currentTesting = sources.find(s => s.status === 'testing');

  return (
    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/90 backdrop-blur-sm">
      {/* 动态扫描线 */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-primary to-transparent animate-scan-line" />
        <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-primary to-transparent animate-scan-line-reverse" />
        <div className="absolute top-0 bottom-0 left-0 w-[2px] bg-gradient-to-b from-transparent via-primary to-transparent animate-scan-vertical" />
        <div className="absolute top-0 bottom-0 right-0 w-[2px] bg-gradient-to-b from-transparent via-primary to-transparent animate-scan-vertical-reverse" />
      </div>

      {/* 中心内容 */}
      <div className="relative flex flex-col items-center gap-6">
        {/* 旋转雷达 */}
        <div className="relative w-24 h-24">
          <div className="absolute inset-0 rounded-full border-2 border-primary/20" />
          <div className="absolute inset-2 rounded-full border border-primary/30" />
          <div className="absolute inset-4 rounded-full border border-primary/40" />
          <div className="absolute inset-0 origin-center animate-radar-sweep">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-0.5 h-12 bg-gradient-to-b from-primary to-transparent" />
          </div>
          {/* 信号点 — O(n²) 修复：只 filter 一次 */}
          {(() => {
            const doneSources = sources.filter(s => s.status === 'done' && s.speed);
            return doneSources.map((_, i) => {
              const angle = (i / doneSources.length) * 360;
              const rad = (angle * Math.PI) / 180;
              const x = 48 + Math.cos(rad) * 30;
              const y = 48 + Math.sin(rad) * 30;
              return (
                <div
                  key={i}
                  className="absolute w-2 h-2 bg-green-400 rounded-full animate-ping"
                  style={{ left: x, top: y, animationDelay: `${i * 0.2}s` }}
                />
              );
            });
          })()}
        </div>

        {/* 文字信息 */}
        <div className="text-center space-y-2">
          <h3 className="text-lg font-semibold text-text">正在优选最佳播放地址</h3>
          <p className="text-sm text-muted">
            {currentTesting ? (
              <span>正在测试: <span className="text-primary">{currentTesting.name}</span></span>
            ) : (
              <span>已完成 {tested}/{total} 个源</span>
            )}
          </p>
        </div>

        {/* 进度条 */}
        <div className="w-48 space-y-1.5">
          <div className="w-full h-1.5 bg-card rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-primary-dim to-primary rounded-full transition-all duration-300 ease-out"
              style={{ width: `${total > 0 ? (tested / total) * 100 : 0}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-muted">
            <span>{tested} 已测试</span>
            <span>{total - tested} 剩余</span>
          </div>
        </div>

        {/* 源列表预览 */}
        <div className="flex flex-wrap justify-center gap-1.5 max-w-[280px]">
          {sources.map((source) => (
            <div
              key={source.key}
              className={`px-2 py-0.5 rounded text-[10px] transition-all duration-200 ${
                source.status === 'testing' 
                  ? 'bg-primary/20 text-primary animate-pulse' 
                  : source.status === 'done' && source.speed
                    ? 'bg-green-900/30 text-green-400'
                    : source.status === 'error'
                      ? 'bg-red-900/30 text-red-400'
                      : 'bg-surface text-muted'
              }`}
            >
              {source.name}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
