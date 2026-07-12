import { useEffect, useRef } from 'react';
import Artplayer from 'artplayer';
import Hls from 'hls.js';
import { getCurrentTheme } from '../store/theme';
import { revokeBlobUrl } from '../utils/adblock';

interface PlayerProps {
  url: string;
  title?: string;
  currentTime?: number;
  onTimeUpdate?: (time: number) => void;
  onNext?: () => void;
  onEnded?: () => void;
  hasNext?: boolean;
}

interface HlsVideoElement extends HTMLVideoElement {
  hls?: Hls;
}

function destroyVideo(video?: HTMLVideoElement | null) {
  if (!video) return;
  const hlsVideo = video as HlsVideoElement;
  if (hlsVideo.hls) {
    hlsVideo.hls.destroy();
    delete hlsVideo.hls;
  }
  video.pause();
  video.removeAttribute('src');
  video.load();
}

function destroyPlayer(art: Artplayer | null, container?: HTMLDivElement | null) {
  if (!art) return;
  try {
    // 先销毁 Artplayer（移除所有事件监听器），防止 video 操作触发异步恢复
    const video = art.video;
    art.destroy();
    // 再清理 HLS 等视频资源
    destroyVideo(video);
  } catch (err) {
    console.warn('Player: error during cleanup', err);
  } finally {
    container?.replaceChildren();
  }
}

function isM3u8(url: string): boolean {
  return url.startsWith('blob:') || url.includes('.m3u8');
}

const Player = ({ url, title, currentTime, onTimeUpdate, onNext, onEnded, hasNext }: PlayerProps) => {
  const artRef = useRef<HTMLDivElement>(null);
  const artInstance = useRef<Artplayer | null>(null);
  const prevBlobUrl = useRef<string | null>(null);
  const seekDoneRef = useRef(false);
  const seekTimeRef = useRef(0);
  const onTimeUpdateRef = useRef(onTimeUpdate);
  // 跳过 switch effect 的首帧（创建时已加载首个 url，无需再 switch）
  const skipFirstSwitch = useRef(true);
  // 下一集回调 / 结束回调 / 是否有下一集（用 ref 持有最新值，避免重建播放器）
  const onNextRef = useRef(onNext);
  const onEndedRef = useRef(onEnded);
  const hasNextRef = useRef(hasNext);
  const nextControlRef = useRef<HTMLElement | null>(null);

  // Keep callback ref in sync without triggering effect re-runs
  useEffect(() => { onTimeUpdateRef.current = onTimeUpdate; });
  useEffect(() => { onNextRef.current = onNext; });
  useEffect(() => { onEndedRef.current = onEnded; });
  useEffect(() => {
    hasNextRef.current = hasNext;
    if (nextControlRef.current) {
      const disabled = !hasNext;
      nextControlRef.current.style.opacity = disabled ? '0.4' : '1';
      nextControlRef.current.style.pointerEvents = disabled ? 'none' : 'auto';
      nextControlRef.current.style.cursor = disabled ? 'default' : 'pointer';
    }
  }, [hasNext]);

  // Move ref write from render to effect (fixes react-hooks/refs violation)
  useEffect(() => {
    if (currentTime !== undefined) {
      seekTimeRef.current = currentTime;
    }
  }, [currentTime]);

  // 创建播放器实例（仅挂载时一次）。换源/换主题均不重建，避免闪烁与状态丢失。
  useEffect(() => {
    if (!artRef.current || !url) return;

    // 清理上一次的 Blob URL
    if (prevBlobUrl.current) {
      revokeBlobUrl(prevBlobUrl.current);
      prevBlobUrl.current = null;
    }
    // 记录当前 Blob URL，卸载时清理
    if (url.startsWith('blob:')) {
      prevBlobUrl.current = url;
    }

    Artplayer.PLAYBACK_RATE = [0.5, 0.75, 1, 1.25, 1.5, 2, 3];
    Artplayer.USE_RAF = false;
    Artplayer.FULLSCREEN_WEB_IN_BODY = true;

    const theme = getCurrentTheme();

    const art = new Artplayer({
      container: artRef.current,
      url: url,
      // Explicitly set type for blob: URLs that contain m3u8 content
      // (Artplayer auto-detects from URL extension, but blob: has none)
      type: isM3u8(url) ? 'm3u8' : '',
      volume: 0.7,
      isLive: false,
      muted: false,
      autoplay: true,
      pip: true,
      autoSize: false,
      autoMini: false,
      screenshot: false,
      setting: true,
      loop: false,
      flip: false,
      playbackRate: true,
      aspectRatio: false,
      fullscreen: true,
      fullscreenWeb: true,
      subtitleOffset: false,
      miniProgressBar: false,
      mutex: true,
      playsInline: true,
      autoPlayback: false,
      airplay: true,
      theme: theme.colors.primary,
      lang: navigator.language.toLowerCase() === 'zh-cn' ? 'zh-cn' : 'en',
      hotkey: true,
      fastForward: true,
      autoOrientation: true,
      lock: true,
      moreVideoAttr: {
        crossOrigin: 'anonymous',
      },
      customType: {
        m3u8: function (video: HTMLVideoElement, videoUrl: string) {
          if (!Hls) return;
          const hlsVideo = video as HlsVideoElement;
          destroyVideo(hlsVideo);

          const hls = new Hls({
            debug: false,
            enableWorker: true,
            lowLatencyMode: false,
            maxBufferLength: 30,
            backBufferLength: 30,
            maxBufferSize: 60 * 1000 * 1000,
          });

          hls.loadSource(videoUrl);
          hls.attachMedia(video);
          hlsVideo.hls = hls;

          hls.on(Hls.Events.ERROR, (_event, data) => {
            if (data.fatal) {
              switch (data.type) {
                case Hls.ErrorTypes.NETWORK_ERROR: hls.startLoad(); break;
                case Hls.ErrorTypes.MEDIA_ERROR: hls.recoverMediaError(); break;
                default: hls.destroy(); break;
              }
            }
          });
        },
      },
      icons: {
        loading: '<img src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI1MCIgaGVpZ2h0PSI1MCIgdmlld0JveD0iMCAwIDUwIDUwIj48cGF0aCBkPSJNMjUuMjUxIDYuNDYxYy0xMC4zMTggMC0xOC42ODMgOC4zNjUtMTguNjgzIDE4LjY4M2g0LjA2OGMwLTguMDcgNi41NDUtMTQuNjE1IDE0LjYxNS0xNC42MTVWNi40NjF6IiBmaWxsPSIjMDA5Njg4Ij48YW5pbWF0ZVRyYW5zZm9ybSBhdHRyaWJ1dGVOYW1lPSJ0cmFuc2Zvcm0iIGF0dHJpYnV0ZVR5cGU9IlhNTCIgZHVyPSIxcyIgZnJvbT0iMCAyNSAyNSIgcmVwZWF0Q291bnQ9ImluZGVmaW5pdGUiIHRvPSIzNjAgMjUgMjUiIHR5cGU9InJvdGF0ZSIvPjwvcGF0aD48L3N2Zz4=">',
      },
      settings: [
        {
          html: '去广告',
          icon: '<text x="50%" y="50%" font-size="20" font-weight="bold" text-anchor="middle" dominant-baseline="middle" fill="#ffffff">AD</text>',
          tooltip: localStorage.getItem('enable_blockad') !== 'false' ? '已开启' : '已关闭',
          onClick() {
            const current = localStorage.getItem('enable_blockad') !== 'false';
            const newVal = !current;
            localStorage.setItem('enable_blockad', String(newVal));
            return newVal ? '当前开启' : '当前关闭';
          },
        },
      ],
    });

    // 只在播放开始后记录进度，避免加载失败的源将进度记为 0
    let hasPlayed = false;
    art.on('play', () => { hasPlayed = true; });

    const saveInterval = setInterval(() => {
      if (hasPlayed && art.video && onTimeUpdateRef.current) {
        onTimeUpdateRef.current(art.video.currentTime);
      }
    }, 500);

    // 恢复播放进度 - seekTimeRef 确保始终使用最新的 currentTime
    seekDoneRef.current = false;
    if (seekTimeRef.current > 0) {
      art.once('video:loadedmetadata', () => {
        if (!seekDoneRef.current && seekTimeRef.current > 0) {
          art.seek = seekTimeRef.current;
          seekDoneRef.current = true;
        }
      });
    }

    artInstance.current = art;

    // 「下一集」自定义控件：放在控制条右侧
    nextControlRef.current =
      art.controls.add({
        name: 'nextEpisode',
        position: 'right',
        tooltip: '下一集',
        html: '<span style="display:inline-flex;align-items:center;gap:4px;font-size:13px;line-height:1;">下一集 ▶</span>',
        click: () => {
          onNextRef.current?.();
        },
      }) || null;
    // 初始根据是否有下一集设置禁用态
    if (nextControlRef.current) {
      const disabled = !hasNextRef.current;
      nextControlRef.current.style.opacity = disabled ? '0.4' : '1';
      nextControlRef.current.style.pointerEvents = disabled ? 'none' : 'auto';
      nextControlRef.current.style.cursor = disabled ? 'default' : 'pointer';
    }

    // 自动连播：一集放完自动跳到下一集
    art.on('video:ended', () => {
      onEndedRef.current?.();
    });

    return () => {
      clearInterval(saveInterval);
      nextControlRef.current = null;
      destroyPlayer(art, artRef.current);
      if (artInstance.current === art) {
        artInstance.current = null;
      }
      // 卸载时清理 Blob URL
      if (prevBlobUrl.current) {
        revokeBlobUrl(prevBlobUrl.current);
        prevBlobUrl.current = null;
      }
    };
    // 仅在挂载时创建一次；url 变化走下方 switch effect 原地换源
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 换源：原地切换，不重建播放器（保留音量/倍速/设置/主题）
  useEffect(() => {
    if (skipFirstSwitch.current) {
      skipFirstSwitch.current = false;
      return;
    }
    const art = artInstance.current;
    if (!art || !url) return;

    // 清理上一次的 Blob URL（m3u8 customType 分支不会自动 revoke）
    if (prevBlobUrl.current) {
      revokeBlobUrl(prevBlobUrl.current);
      prevBlobUrl.current = null;
    }
    if (url.startsWith('blob:')) {
      prevBlobUrl.current = url;
    }

    // 先更新 type，确保 switch 走正确的 customType（blob 无扩展名需显式 m3u8）
    art.option.type = isM3u8(url) ? 'm3u8' : '';

    // 重置进度恢复标记，新源 loadedmetadata 后再 seek
    seekDoneRef.current = false;
    if (seekTimeRef.current > 0) {
      art.once('video:loadedmetadata', () => {
        if (!seekDoneRef.current && seekTimeRef.current > 0) {
          art.seek = seekTimeRef.current;
          seekDoneRef.current = true;
        }
      });
    }

    // 原地换源（Artplayer 官方 API），保留播放器实例与所有状态
    art.switch = url;
  }, [url]);

  // 换主题：原地更新播放器主题色，无需重建
  useEffect(() => {
    const handleThemeChange = () => {
      const art = artInstance.current;
      if (art) {
        art.theme = getCurrentTheme().colors.primary;
      }
    };
    window.addEventListener('theme-change', handleThemeChange as EventListener);
    return () => window.removeEventListener('theme-change', handleThemeChange as EventListener);
  }, []);

  useEffect(() => {
    if (artInstance.current && title) {
      (artInstance.current as unknown as Record<string, unknown>).title = title;
    }
  }, [title]);

  return (
    <div
      ref={artRef}
      className="w-full h-full bg-black rounded-xl overflow-hidden"
      style={{ minHeight: '300px' }}
    />
  );
};

export default Player;
