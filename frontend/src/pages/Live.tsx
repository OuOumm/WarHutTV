import { useState, useEffect, useRef, useMemo, lazy, Suspense } from 'react';
import apiClient from '../api/client';
import { apiCacheStore } from '../store/apiCache';
import type { LiveChannel, LiveSource } from '../types';

// 动态导入 Player 组件 - 与 Play.tsx 保持一致
const Player = lazy(() => import('../components/Player'));

const Live = () => {
  const [loading, setLoading] = useState(true);
  const [liveSources, setLiveSources] = useState<LiveSource[]>([]);
  const [currentSource, setCurrentSource] = useState<LiveSource | null>(null);
  const [channels, setChannels] = useState<LiveChannel[]>([]);
  const [currentChannel, setCurrentChannel] = useState<LiveChannel | null>(null);
  const [groupedChannels, setGroupedChannels] = useState<Record<string, LiveChannel[]>>({});
  const [selectedGroup, setSelectedGroup] = useState('');
  const [filteredChannels, setFilteredChannels] = useState<LiveChannel[]>([]);
  const [activeTab, setActiveTab] = useState<'channels' | 'sources'>('channels');
  const [isSwitchingSource, setIsSwitchingSource] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showGroupDropdown, setShowGroupDropdown] = useState(false);
  const channelListRef = useRef<HTMLDivElement>(null);
  const groupContainerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Filter channels by search query
  const displayChannels = useMemo(() => {
    if (!searchQuery.trim()) return filteredChannels;
    const q = searchQuery.toLowerCase();
    return filteredChannels.filter(c => c.name.toLowerCase().includes(q));
  }, [filteredChannels, searchQuery]);

  // Channel number mapping
  const channelIndexMap = useMemo(() => {
    const map = new Map<string, number>();
    channels.forEach((c, i) => map.set(c.id, i + 1));
    return map;
  }, [channels]);

  useEffect(() => {
    fetchLiveSources();
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT') return;

      // Number keys 1-9 to quick switch channels in current view
      if (e.key >= '1' && e.key <= '9') {
        const idx = parseInt(e.key) - 1;
        if (idx < displayChannels.length) {
          handleChannelChange(displayChannels[idx]);
        }
        return;
      }

      // Arrow up/down to navigate channels
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault();
        const currentIdx = displayChannels.findIndex(c => c.id === currentChannel?.id);
        const nextIdx = e.key === 'ArrowDown'
          ? Math.min(currentIdx + 1, displayChannels.length - 1)
          : Math.max(currentIdx - 1, 0);
        if (nextIdx >= 0 && nextIdx < displayChannels.length) {
          handleChannelChange(displayChannels[nextIdx]);
        }
        return;
      }

      // / to focus search
      if (e.key === '/') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [displayChannels, currentChannel]);

  const fetchLiveSources = async () => {
    try {
      setLoading(true);
      
      // 检查缓存
      let sources: LiveSource[] = await apiCacheStore.get('liveSources', 'list') || [];
      
      if (sources.length === 0) {
        const response = await apiClient.get('/live/sources');
        sources = response.data.data || [];
        if (sources.length > 0) {
          await apiCacheStore.set('liveSources', 'list', sources);
        }
      }
      
      setLiveSources(sources);

      if (sources.length > 0) {
        const firstSource = sources[0];
        setCurrentSource(firstSource);
        await fetchChannels(firstSource);
      }
    } catch (err) {
      console.error('获取直播源失败:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchChannels = async (source: LiveSource) => {
    try {
      // 检查缓存
      let data: LiveChannel[] = await apiCacheStore.get('liveChannels', source.key) || [];
      
      if (data.length === 0) {
        const response = await apiClient.get(`/live/channels?source=${source.key}`);
        data = response.data.data || [];
        if (data.length > 0) {
          await apiCacheStore.set('liveChannels', source.key, data);
        }
      }
      
      setChannels(data);

      const grouped: Record<string, LiveChannel[]> = { '全部': data };
      data.forEach(channel => {
        const group = channel.group || '其他';
        if (!grouped[group]) grouped[group] = [];
        grouped[group].push(channel);
      });

      setGroupedChannels(grouped);
      setSelectedGroup('全部');
      setFilteredChannels(data);
      setSearchQuery('');

      if (data.length > 0) {
        setCurrentChannel(data[0]);
      }
    } catch (err) {
      console.error('获取频道列表失败:', err);
      setChannels([]);
      setGroupedChannels({});
      setFilteredChannels([]);
    }
  };

  const handleSourceChange = async (source: LiveSource) => {
    if (source.key === currentSource?.key) return;
    setIsSwitchingSource(true);
    setCurrentSource(source);
    await fetchChannels(source);
    setActiveTab('channels');
    setIsSwitchingSource(false);
  };

  const handleChannelChange = (channel: LiveChannel) => {
    if (isSwitchingSource) return;
    setCurrentChannel(channel);
    setTimeout(() => scrollToChannel(channel), 100);
  };

  const handleGroupChange = (group: string) => {
    if (isSwitchingSource) return;
    setSelectedGroup(group);
    setShowGroupDropdown(false);
    setSearchQuery('');
    const filtered = group === '全部' ? channels : channels.filter(c => c.group === group);
    setFilteredChannels(filtered);

    if (currentChannel && filtered.some(c => c.id === currentChannel.id)) {
      setTimeout(() => scrollToChannel(currentChannel), 100);
    } else if (channelListRef.current) {
      channelListRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  useEffect(() => {
    const container = groupContainerRef.current;
    if (!container) return;
    const handleWheel = (e: WheelEvent) => {
      if (container.scrollWidth > container.clientWidth) {
        e.preventDefault();
        container.scrollLeft += e.deltaY;
      }
    };
    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, [groupedChannels]);

  const scrollToChannel = (channel: LiveChannel) => {
    if (!channelListRef.current) return;
    const el = channelListRef.current.querySelector(`[data-channel-id="${channel.id}"]`);
    if (el) {
      const container = channelListRef.current;
      const containerRect = container.getBoundingClientRect();
      const elRect = el.getBoundingClientRect();
      const scrollTop = container.scrollTop + (elRect.top - containerRect.top) - containerRect.height / 2 + elRect.height / 2;
      container.scrollTo({ top: Math.max(0, scrollTop), behavior: 'smooth' });
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-[60vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-muted">正在加载直播源...</p>
        </div>
      </div>
    );
  }

  if (liveSources.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <svg className="h-16 w-16 text-muted mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
        <h2 className="text-xl font-semibold text-text mb-2">暂无直播源</h2>
        <p className="text-muted max-w-md">请在配置中添加直播源</p>
      </div>
    );
  }

  const groupKeys = Object.keys(groupedChannels);

  return (
    <div className="flex flex-col gap-4 py-4 px-5 lg:px-[3rem] 2xl:px-20">
      {/* Header */}
      <div className="py-1">
        <h1 className="text-xl font-semibold text-text flex items-center gap-2">
          <svg className="w-5 h-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          <span className="truncate">
            {currentSource?.name}
            {currentSource && currentChannel && (
              <span className="text-muted">{` > ${currentChannel.name}`}</span>
            )}
          </span>
        </h1>
      </div>

      {/* Main Grid */}
      <div className="grid gap-4 lg:h-[500px] xl:h-[650px] grid-cols-1 md:grid-cols-4">
        {/* Player */}
        <div className="md:col-span-3 h-full">
          <div className="relative w-full h-[300px] lg:h-full bg-black rounded-xl overflow-hidden ring-1 ring-white/10 shadow-2xl">
            {currentChannel ? (
              <Suspense fallback={<div className="w-full h-full flex items-center justify-center text-muted">加载播放器...</div>}>
                <Player url={`/api/proxy/m3u8?url=${encodeURIComponent(currentChannel.url)}&moontv-source=${currentSource?.key || ''}`} title={currentChannel.name} isLive />
              </Suspense>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-muted">
                请选择频道
              </div>
            )}
          </div>
        </div>

        {/* Channel Panel */}
        <div className="md:col-span-1 h-[350px] lg:h-full min-h-0">
          <div className="h-full bg-card rounded-xl overflow-hidden flex flex-col min-h-0">
            {/* Tabs */}
            <div className="flex border-b border-glass-border flex-shrink-0">
              <button
                onClick={() => setActiveTab('channels')}
                className={`flex-1 px-3 py-2.5 text-sm font-medium transition-colors ${
                  activeTab === 'channels'
                    ? 'text-primary border-b-2 border-primary bg-deep'
                    : 'text-muted'
                }`}
              >
                频道
              </button>
              <button
                onClick={() => setActiveTab('sources')}
                className={`flex-1 px-3 py-2.5 text-sm font-medium transition-colors ${
                  activeTab === 'sources'
                    ? 'text-primary border-b-2 border-primary bg-deep'
                    : 'text-muted'
                }`}
              >
                直播源
              </button>
            </div>

            <div className="flex-1 overflow-hidden bg-deep min-h-0">
              {activeTab === 'channels' ? (
                <div className="flex flex-col h-full min-h-0">
                  {/* Search + Group Selector */}
                  <div className="flex-shrink-0 border-b border-glass-border">
                    {/* Search Input */}
                    <div className="px-3 pt-2 pb-1">
                      <div className="relative">
                        <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        <input
                          ref={searchInputRef}
                          type="text"
                          value={searchQuery}
                          onChange={e => setSearchQuery(e.target.value)}
                          placeholder="搜索频道..."
                          className="w-full pl-8 pr-8 py-1.5 text-xs bg-surface rounded-lg text-text placeholder-muted focus:outline-none focus:ring-1 focus:ring-primary/50"
                        />
                        {searchQuery && (
                          <button
                            onClick={() => setSearchQuery('')}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-text"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Group Selector */}
                    {groupKeys.length > 8 ? (
                      /* Dropdown for many groups */
                      <div className="px-3 pb-2 relative">
                        <button
                          onClick={() => setShowGroupDropdown(!showGroupDropdown)}
                          className="w-full flex items-center justify-between px-3 py-1.5 text-xs bg-surface rounded-lg text-text hover:bg-card transition-colors"
                        >
                          <span>{selectedGroup}</span>
                          <svg className={`w-3.5 h-3.5 transition-transform ${showGroupDropdown ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                        {showGroupDropdown && (
                          <div className="absolute left-3 right-3 top-full mt-1 bg-card rounded-lg shadow-lg border border-glass-border z-50 max-h-48 overflow-y-auto">
                            {groupKeys.map(group => (
                              <button
                                key={group}
                                onClick={() => handleGroupChange(group)}
                                className={`w-full text-left px-3 py-2 text-xs transition-colors ${
                                  selectedGroup === group
                                    ? 'bg-primary text-deep'
                                    : 'text-text hover:bg-surface'
                                }`}
                              >
                                {group}
                                <span className="ml-1 opacity-60">({groupedChannels[group].length})</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      /* Horizontal pills for few groups */
                      <div ref={groupContainerRef} className="flex gap-1.5 px-3 pb-2 overflow-x-auto scrollbar-hide">
                        {groupKeys.map(group => (
                          <button
                            key={group}
                            onClick={() => handleGroupChange(group)}
                            disabled={isSwitchingSource}
                            className={`px-2.5 py-1 text-[11px] rounded-full whitespace-nowrap transition-colors ${
                              isSwitchingSource
                                ? 'opacity-50 cursor-not-allowed'
                                : selectedGroup === group
                                  ? 'bg-primary text-deep'
                                  : 'bg-surface text-muted hover:bg-card'
                            }`}
                          >
                            {group}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Channel Count */}
                  <div className="px-3 py-1.5 text-[10px] text-muted flex-shrink-0">
                    {searchQuery ? `搜索结果: ${displayChannels.length}` : `${selectedGroup}: ${displayChannels.length} 个频道`}
                  </div>

                  {/* Channel Grid */}
                  <div ref={channelListRef} className="flex-1 overflow-y-auto px-2 pb-2 min-h-0">
                    {displayChannels.length > 0 ? (
                      <div className="grid grid-cols-3 gap-1">
                        {displayChannels.map(channel => {
                          const isActive = channel.id === currentChannel?.id;
                          const channelNum = channelIndexMap.get(channel.id);
                          return (
                            <button
                              key={channel.id}
                              data-channel-id={channel.id}
                              onClick={() => handleChannelChange(channel)}
                              disabled={isSwitchingSource}
                              className={`relative p-2 rounded-lg text-center transition-all ${
                                isSwitchingSource
                                  ? 'opacity-50 cursor-not-allowed'
                                  : isActive
                                    ? 'bg-primary text-deep shadow-sm scale-[1.02]'
                                    : 'bg-surface text-muted hover:bg-card'
                              }`}
                            >
                              {/* Channel Number */}
                              {channelNum && channelNum <= 9 && (
                                <span className={`absolute top-1 left-1.5 text-[9px] font-mono ${
                                  isActive ? 'text-green-200' : 'text-muted'
                                }`}>
                                  {channelNum}
                                </span>
                              )}
                              <div className="text-xs font-medium truncate leading-tight">{channel.name}</div>
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-8 text-center">
                        <p className="text-muted text-sm">
                          {searchQuery ? '未找到匹配频道' : '暂无可用频道'}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                /* Sources Tab */
                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                  {liveSources.map(source => {
                    const isCurrent = source.key === currentSource?.key;
                    return (
                      <div
                        key={source.key}
                        onClick={() => !isCurrent && handleSourceChange(source)}
                        className={`flex items-center gap-3 p-2 rounded-lg transition-colors ${
                          isCurrent
                            ? 'bg-primary-glow ring-1 ring-primary'
                            : 'hover:bg-surface cursor-pointer'
                        }`}
                      >
                        <div className="w-10 h-10 bg-surface rounded-lg flex items-center justify-center flex-shrink-0">
                          <svg className="w-5 h-5 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-text truncate">{source.name}</div>
                          <div className="text-xs text-muted">
                            {source.channelNumber ? `${source.channelNumber} 个频道` : '-'}
                          </div>
                        </div>
                        {isCurrent && (
                          <div className="w-2 h-2 bg-primary rounded-full flex-shrink-0" />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Keyboard Shortcuts Hint */}
      <div className="hidden lg:flex items-center gap-5 text-xs text-muted px-1">
        <span className="font-medium text-text">快捷键:</span>
        <span className="flex items-center gap-1">
          <kbd className="inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 bg-card text-text rounded-md text-[11px] font-mono shadow-sm border border-glass-border">1</kbd>
          <span>-</span>
          <kbd className="inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 bg-card text-text rounded-md text-[11px] font-mono shadow-sm border border-glass-border">9</kbd>
          <span className="ml-1">快速切换</span>
        </span>
        <span className="flex items-center gap-1">
          <kbd className="inline-flex items-center justify-center w-[22px] h-[22px] bg-card text-text rounded-md text-[11px] font-mono shadow-sm border border-glass-border">↑</kbd>
          <kbd className="inline-flex items-center justify-center w-[22px] h-[22px] bg-card text-text rounded-md text-[11px] font-mono shadow-sm border border-glass-border">↓</kbd>
          <span className="ml-1">切换频道</span>
        </span>
        <span className="flex items-center gap-1">
          <kbd className="inline-flex items-center justify-center w-[22px] h-[22px] bg-card text-text rounded-md text-[11px] font-mono shadow-sm border border-glass-border">/</kbd>
          <span className="ml-1">搜索</span>
        </span>
      </div>
    </div>
  );
};

export default Live;
