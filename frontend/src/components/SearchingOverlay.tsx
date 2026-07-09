// 搜索播放源动画组件
export const SearchingOverlay = ({ searchProgress, stopSearch }: {
  searchData?: unknown[];
  searchProgress?: { completed: number; total: number; currentSite: string } | null;
  searchDone?: boolean;
  stopSearch?: () => void;
  isSearching?: boolean;
}) => {
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
        {/* 搜索动画 */}
        <div className="relative w-24 h-24">
          <div className="absolute inset-0 rounded-full border-2 border-primary/20 animate-pulse" />
          <div className="absolute inset-3 rounded-full border border-primary/30" />
          <div className="absolute inset-6 rounded-full border border-primary/40" />
          {/* 搜索图标 */}
          <div className="absolute inset-0 flex items-center justify-center">
            <svg className="w-10 h-10 text-primary animate-bounce" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>

        {/* 文字信息 */}
        <div className="text-center space-y-2" role="status" aria-live="polite">
          <h3 className="text-lg font-semibold text-text">正在搜索播放源</h3>
          <p className="text-sm text-muted">
            {searchProgress ? (
              <span>已搜索 {searchProgress.completed}/{searchProgress.total} 个源</span>
            ) : (
              <span>正在连接...</span>
            )}
          </p>
          {searchProgress?.currentSite && (
            <p className="text-xs text-primary">当前: {searchProgress.currentSite}</p>
          )}
        </div>

        {/* 进度条 */}
        {searchProgress && (
          <div className="w-48 space-y-1.5">
            <div className="w-full h-1.5 bg-card rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-primary-dim to-primary rounded-full transition-all duration-300 ease-out"
                style={{ width: `${searchProgress.total > 0 ? (searchProgress.completed / searchProgress.total) * 100 : 0}%` }}
              />
            </div>
          </div>
        )}

        {/* 停止搜索按钮 */}
        {stopSearch && (
          <button
            onClick={stopSearch}
            className="px-4 py-1.5 text-xs rounded-lg border border-primary/30 text-primary hover:bg-primary/10 transition-colors"
          >
            停止搜索
          </button>
        )}
      </div>
    </div>
  );
};
