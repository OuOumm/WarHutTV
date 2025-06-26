/* eslint-disable no-console */
'use client';

import { useEffect, useState } from 'react';

import type { PlayRecord } from '@/lib/db.client';
import { getAllPlayRecords } from '@/lib/db.client';

import ScrollableRow from '@/components/ScrollableRow';
import VideoCard from '@/components/VideoCard';

interface ContinueWatchingProps {
  className?: string;
}

export default function ContinueWatching({ className }: ContinueWatchingProps) {
  const [playRecords, setPlayRecords] = useState<
    (PlayRecord & { key: string })[]
  >([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPlayRecords = async () => {
      try {
        setLoading(true);

        // 从 localStorage 获取所有播放记录
        const allRecords = await getAllPlayRecords();

        // 将记录转换为数组并根据 save_time 由近到远排序
        const recordsArray = Object.entries(allRecords).map(
          ([key, record]) => ({
            ...record,
            key,
          })
        );

        // 按 save_time 降序排序（最新的在前面）
        const sortedRecords = recordsArray.sort(
          (a, b) => b.save_time - a.save_time
        );

        setPlayRecords(sortedRecords);
      } catch (error) {
        console.error('获取播放记录失败:', error);
        setPlayRecords([]);
      } finally {
        setLoading(false);
      }
    };

    fetchPlayRecords();
  }, []);

  // 如果没有播放记录，则不渲染组件
  if (!loading && playRecords.length === 0) {
    return null;
  }

  // 计算播放进度百分比
  const getProgress = (record: PlayRecord) => {
    if (record.total_time === 0) return 0;
    return (record.play_time / record.total_time) * 100;
  };

  // 从 key 中解析 source 和 id
  const parseKey = (key: string) => {
    const [source, id] = key.split('+');
    return { source, id };
  };

  return (
    <section className={`mb-8 ${className || ''}`}>
      <h2 className='mb-4 text-xl font-bold text-gray-800 text-left'>
        继续观看
      </h2>
      <ScrollableRow>
        {loading
          ? // 加载状态显示灰色占位数据
            Array.from({ length: 6 }).map((_, index) => (
              <div
                key={index}
                className='min-w-[96px] w-24 sm:min-w-[180px] sm:w-44'
              >
                <div className='relative aspect-[2/3] w-full overflow-hidden rounded-lg bg-gray-200 animate-pulse'>
                  <div className='absolute inset-0 bg-gray-300'></div>
                </div>
                <div className='mt-2 h-4 bg-gray-200 rounded animate-pulse'></div>
                <div className='mt-1 h-3 bg-gray-200 rounded animate-pulse'></div>
              </div>
            ))
          : // 显示真实数据
            playRecords.map((record) => {
              const { source, id } = parseKey(record.key);
              return (
                <div
                  key={record.key}
                  className='min-w-[96px] w-24 sm:min-w-[180px] sm:w-44'
                >
                  <VideoCard
                    id={id}
                    title={record.title}
                    poster={record.cover}
                    source={source}
                    source_name={record.source_name}
                    progress={getProgress(record)}
                    episodes={record.total_episodes}
                    currentEpisode={record.index}
                    onDelete={() =>
                      setPlayRecords((prev) =>
                        prev.filter((r) => r.key !== record.key)
                      )
                    }
                  />
                </div>
              );
            })}
      </ScrollableRow>
    </section>
  );
}
