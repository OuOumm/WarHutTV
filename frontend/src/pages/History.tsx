import { useState, useEffect } from 'react';
import VideoCard from '../components/VideoCard';
import PageContainer from '../components/PageContainer';
import VideoGrid from '../components/VideoGrid';
import type { VideoItem } from '../types';
import { historyStore } from '../store/history';

const History = () => {
  const [history, setHistory] = useState<VideoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    const items = await historyStore.getAll();
    setHistory(items);
    setLoading(false);
  };

  const handleClear = async () => {
    try {
      await historyStore.clear();
      await loadHistory();
      setToast('已清空播放历史');
      setTimeout(() => setToast(''), 2000);
    } catch {
      // Ignore clear failures; the existing history view remains unchanged.
    }
  };

  if (loading) {
    return (
      <PageContainer>
        <div className="h-7 w-28 bg-surface rounded-lg animate-pulse mb-6" />
        <VideoGrid variant="favorites">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i}>
              <div className="aspect-[2/3] bg-surface rounded-xl animate-pulse" />
              <div className="mt-2 h-4 bg-surface rounded animate-pulse w-3/4" />
            </div>
          ))}
        </VideoGrid>
      </PageContainer>
    );
  }

  return (
    <PageContainer className="page-enter">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[999] bg-primary/15 border border-primary/30 backdrop-blur-xl px-4 py-2 rounded-lg shadow-lg animate-in fade-in slide-in-from-top-2 duration-200">
          <span className="text-sm text-primary font-medium">{toast}</span>
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-text">播放历史</h1>
        {history.length > 0 && (
          <button
            onClick={handleClear}
            className="text-sm text-muted hover:text-primary transition-colors"
          >
            清空历史
          </button>
        )}
      </div>

      {history.length === 0 ? (
        <div className="text-center text-muted py-20">
          <div className="w-16 h-16 rounded-full bg-surface mx-auto mb-4 flex items-center justify-center">
            <svg className="w-8 h-8 text-primary/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-lg text-text/80">暂无播放历史</p>
          <p className="mt-2 text-sm">观看影片后自动记录在这里</p>
        </div>
      ) : (
        <VideoGrid variant="favorites" className="content-fade-in">
          {history.map((item) => (
            <VideoCard key={item.vod_id} video={item} showActions />
          ))}
        </VideoGrid>
      )}
    </PageContainer>
  );
};

export default History;
