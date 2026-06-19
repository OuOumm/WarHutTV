import { useEffect, useRef, useState } from 'react';
import Artplayer from 'artplayer';
import Hls from 'hls.js';
import { getCurrentTheme } from '../store/theme';
import { revokeBlobUrl } from '../utils/adblock';

interface PlayerProps {
  url: string;
  title?: string;
  currentTime?: number;
  onTimeUpdate?: (time: number) => void;
  isLive?: boolean;
}

interface HlsVideoElement extends HTMLVideoElement {
  hls?: Hls;
}

const Player = ({ url, title, currentTime, onTimeUpdate, isLive = false }: PlayerProps) => {
  const artRef = useRef<HTMLDivElement>(null);
  const artInstance = useRef<Artplayer | null>(null);
  const prevBlobUrl = useRef<string | null>(null);
  const seekDoneRef = useRef(false);
  const seekTimeRef = useRef(0);
  const onTimeUpdateRef = useRef(onTimeUpdate);
  const [themeId, setThemeId] = useState(getCurrentTheme().id);

  // Keep callback ref in sync without triggering effect re-runs
  useEffect(() => { onTimeUpdateRef.current = onTimeUpdate; });

  // Move ref write from render to effect (fixes react-hooks/refs violation)
  useEffect(() => {
    if (currentTime !== undefined) {
      seekTimeRef.current = currentTime;
    }
  }, [currentTime]);

  useEffect(() => {
    const handleThemeChange = (e: CustomEvent) => {
      if (e.detail?.id) {
        setThemeId(e.detail.id);
      }
    };
    window.addEventListener('theme-change', handleThemeChange as EventListener);
    return () => window.removeEventListener('theme-change', handleThemeChange as EventListener);
  }, []);

  useEffect(() => {
    if (!artRef.current || !url) return;

    if (artInstance.current) {
      try {
        const video = artInstance.current.video as HlsVideoElement;
        if (video && video.hls) {
          video.hls.destroy();
          delete video.hls;
        }
        artInstance.current.destroy();
      } catch (err) {
        console.warn('Player: error destroying previous instance', err);
      }
      artInstance.current = null;
    }

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
      type: url.startsWith('blob:') || url.includes('.m3u8') ? 'm3u8' : undefined,
      volume: 0.7,
      isLive: isLive,
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
          if (hlsVideo.hls) {
            hlsVideo.hls.destroy();
            delete hlsVideo.hls;
          }

          const hls = new Hls({
            debug: false,
            enableWorker: true,
            lowLatencyMode: true,
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

    return () => {
      clearInterval(saveInterval);
      try {
        const video = art.video as HlsVideoElement;
        if (video && video.hls) {
          video.hls.destroy();
          delete video.hls;
        }
        art.destroy();
      } catch (err) {
        console.warn('Player: error during cleanup', err);
      }
      artInstance.current = null;
      // 卸载时清理 Blob URL
      if (prevBlobUrl.current) {
        revokeBlobUrl(prevBlobUrl.current);
        prevBlobUrl.current = null;
      }
    };
  }, [url, themeId, isLive]);

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
