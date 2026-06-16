import { useState, useEffect } from 'react';
import Player from '../components/Player';
import apiClient from '../api/client';
import type { LiveChannel } from '../types';

const Live = () => {
  const [channels, setChannels] = useState<LiveChannel[]>([]);
  const [currentChannel, setCurrentChannel] = useState<LiveChannel | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadChannels();
  }, []);

  const loadChannels = async () => {
    try {
      const response = await apiClient.get('/live/channels');
      setChannels(response.data.channels || []);
      if (response.data.channels?.length > 0) {
        setCurrentChannel(response.data.channels[0]);
      }
    } catch (err) {
      console.error('加载直播频道失败:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="text-center text-gray-400 py-8">加载中...</div>;
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-6">直播</h1>

      <div className="flex gap-6">
        <div className="w-full lg:w-64 bg-gray-800 rounded-lg p-4 max-h-[600px] overflow-y-auto">
          <h2 className="text-lg font-bold text-white mb-3">频道列表</h2>
          <div className="space-y-2">
            {channels.map((channel, index) => (
              <button
                key={index}
                onClick={() => setCurrentChannel(channel)}
                className={`w-full text-left px-3 py-2 rounded ${
                  currentChannel?.url === channel.url
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-300 hover:bg-gray-700'
                }`}
              >
                <div className="font-medium">{channel.name}</div>
                {channel.group && (
                  <div className="text-xs text-gray-400">{channel.group}</div>
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1">
          {currentChannel ? (
            <>
              <Player url={currentChannel.url} title={currentChannel.name} />
              <div className="mt-4 text-gray-400">
                当前播放: {currentChannel.name}
              </div>
            </>
          ) : (
            <div className="text-center text-gray-400 py-8">
              请选择频道
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Live;
