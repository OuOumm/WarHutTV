import { useState, useEffect } from 'react';
import VideoCard from '../components/VideoCard';
import type { VideoItem } from '../types';
import { historyStore } from '../store/history';

const History = () => {
  const [history, setHistory] = useState<VideoItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    const items = await historyStore.getAll();
    setHistory(items);
    setLoading(false);
  };

  const handleClear = async () => {
    if (confirm('确定要清空播放历史吗？')) {
      await historyStore.clear();
      await loadHistory();
    }
  };

  if (loading) {
    return <div className="text-center text-gray-400 py-8">加载中...</div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">播放历史</h1>
        {history.length > 0 && (
          <button
            onClick={handleClear}
            className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
          >
            清空历史
          </button>
        )}
      </div>

      {history.length === 0 ? (
        <div className="text-center text-gray-400 py-8">
          暂无播放历史
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {history.map((item) => (
            <VideoCard key={item.vod_id} video={item} />
          ))}
        </div>
      )}
    </div>
  );
};

export default History;
