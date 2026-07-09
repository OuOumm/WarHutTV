import { useState, useEffect } from 'react';
import VideoCard from '../components/VideoCard';
import PageContainer from '../components/PageContainer';
import VideoGrid from '../components/VideoGrid';
import VirtualVideoGrid, { useResponsiveColumns } from '../components/VirtualVideoGrid';
import { useToast } from '../components/ToastProvider';
import type { VideoItem } from '../types';
import { historyStore } from '../store/history';

const History = () => {
  const [history, setHistory] = useState<VideoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const columns = useResponsiveColumns({ base: 2, sm: 4, lg: 5, xl: 5 });

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
      toast('已清空播放历史', 'success');
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
        <VirtualVideoGrid
          items={history}
          columnCount={columns}
          innerGridClassName="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-x-2 sm:gap-x-6"
          rowClassName="pb-12 sm:pb-16"
          estimateRowHeight={360}
          className="content-fade-in"
          renderItem={(item) => (
            <VideoCard key={item.vod_id} video={item} showActions animate={false} />
          )}
        />
      )}
    </PageContainer>
  );
};

export default History;
