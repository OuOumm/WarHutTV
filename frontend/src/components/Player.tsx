import { useEffect, useRef, useState } from 'react';
import Artplayer from 'artplayer';
import Hls from 'hls.js';
import { getCurrentTheme } from '../store/theme';

interface PlayerProps {
  url: string;
  title?: string;
  currentTime?: number;
  onTimeUpdate?: (time: number) => void;
  isLive?: boolean;
}

const Player = ({ url, title, currentTime, onTimeUpdate, isLive = false }: PlayerProps) => {
  const artRef = useRef<HTMLDivElement>(null);
  const artInstance = useRef<Artplayer | null>(null);
  const [themeId, setThemeId] = useState(getCurrentTheme().id);

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
        if (artInstance.current.video && (artInstance.current.video as any).hls) {
          (artInstance.current.video as any).hls.destroy();
        }
        artInstance.current.destroy();
      } catch {}
      artInstance.current = null;
    }

    Artplayer.PLAYBACK_RATE = [0.5, 0.75, 1, 1.25, 1.5, 2, 3];
    Artplayer.USE_RAF = false;
    Artplayer.FULLSCREEN_WEB_IN_BODY = true;

    const theme = getCurrentTheme();

    const art = new Artplayer({
      container: artRef.current,
      url: url,
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
      hotkey: false,
      fastForward: true,
      autoOrientation: true,
      lock: true,
      moreVideoAttr: {
        crossOrigin: 'anonymous',
      },
      customType: {
        m3u8: function (video: HTMLVideoElement, videoUrl: string) {
          if (!Hls) return;
          if ((video as any).hls) (video as any).hls.destroy();

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
          (video as any).hls = hls;

          hls.on(Hls.Events.ERROR, function (_event: any, data: any) {
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

    // 定时保存播放进度
    const saveInterval = setInterval(() => {
      if (art.video && onTimeUpdate) {
        onTimeUpdate(art.video.currentTime);
      }
    }, 5000);

    // 恢复播放进度
    if (currentTime && currentTime > 0) {
      art.on('video:loadedmetadata', () => {
        art.video.currentTime = currentTime;
      });
    }

    artInstance.current = art;

    return () => {
      clearInterval(saveInterval);
      try {
        if (art.video && (art.video as any).hls) {
          (art.video as any).hls.destroy();
        }
        art.destroy();
      } catch {}
      artInstance.current = null;
    };
  }, [url, themeId]);

  useEffect(() => {
    if (artInstance.current && title) {
      (artInstance.current as any).title = title;
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
