import { useEffect, useRef } from 'react';
import Artplayer from 'artplayer';
import Hls from 'hls.js';

interface PlayerProps {
  url: string;
  title?: string;
}

const Player = ({ url, title }: PlayerProps) => {
  const artRef = useRef<HTMLDivElement>(null);
  const artInstance = useRef<Artplayer | null>(null);

  useEffect(() => {
    if (!artRef.current || !url) return;

    // 销毁旧实例
    if (artInstance.current) {
      try {
        if (artInstance.current.video && (artInstance.current.video as any).hls) {
          (artInstance.current.video as any).hls.destroy();
        }
        artInstance.current.destroy();
      } catch {}
      artInstance.current = null;
    }

    // ArtPlayer 全局配置
    Artplayer.PLAYBACK_RATE = [0.5, 0.75, 1, 1.25, 1.5, 2, 3];
    Artplayer.USE_RAF = false;
    Artplayer.FULLSCREEN_WEB_IN_BODY = true;

    const art = new Artplayer({
      container: artRef.current,
      url: url,
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
      theme: '#22c55e',
      lang: navigator.language.toLowerCase() === 'zh-cn' ? 'zh-cn' : 'en',
      hotkey: false,
      fastForward: true,
      autoOrientation: true,
      lock: true,
      moreVideoAttr: {
        crossOrigin: 'anonymous',
      },
      // HLS 支持
      customType: {
        m3u8: function (video: HTMLVideoElement, videoUrl: string) {
          if (!Hls) {
            console.error('HLS.js 未加载');
            return;
          }

          if ((video as any).hls) {
            (video as any).hls.destroy();
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
          (video as any).hls = hls;

          hls.on(Hls.Events.ERROR, function (_event: any, data: any) {
            console.error('HLS Error:', data);
            if (data.fatal) {
              switch (data.type) {
                case Hls.ErrorTypes.NETWORK_ERROR:
                  console.log('网络错误，尝试恢复...');
                  hls.startLoad();
                  break;
                case Hls.ErrorTypes.MEDIA_ERROR:
                  console.log('媒体错误，尝试恢复...');
                  hls.recoverMediaError();
                  break;
                default:
                  console.log('无法恢复的错误');
                  hls.destroy();
                  break;
              }
            }
          });
        },
      },
      // 自定义加载图标
      icons: {
        loading: '<img src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI1MCIgaGVpZ2h0PSI1MCIgdmlld0JveD0iMCAwIDUwIDUwIj48cGF0aCBkPSJNMjUuMjUxIDYuNDYxYy0xMC4zMTggMC0xOC42ODMgOC4zNjUtMTguNjgzIDE4LjY4M2g0LjA2OGMwLTguMDcgNi41NDUtMTQuNjE1IDE0LjYxNS0xNC42MTVWNi40NjF6IiBmaWxsPSIjMDA5Njg4Ij48YW5pbWF0ZVRyYW5zZm9ybSBhdHRyaWJ1dGVOYW1lPSJ0cmFuc2Zvcm0iIGF0dHJpYnV0ZVR5cGU9IlhNTCIgZHVyPSIxcyIgZnJvbT0iMCAyNSAyNSIgcmVwZWF0Q291bnQ9ImluZGVmaW5pdGUiIHRvPSIzNjAgMjUgMjUiIHR5cGU9InJvdGF0ZSIvPjwvcGF0aD48L3N2Zz4=">',
      },
      // 设置面板
      settings: [
        {
          html: '去广告',
          icon: '<text x="50%" y="50%" font-size="20" font-weight="bold" text-anchor="middle" dominant-baseline="middle" fill="#ffffff">AD</text>',
          tooltip: '已开启',
          onClick() {
            const current = localStorage.getItem('enable_blockad') !== 'false';
            const newVal = !current;
            localStorage.setItem('enable_blockad', String(newVal));
            return newVal ? '当前开启' : '当前关闭';
          },
        },
      ],
    });

    // 播放结束自动下一集
    art.on('video:ended', () => {
      // 可以在这里添加自动下一集逻辑
    });

    artInstance.current = art;

    return () => {
      try {
        if (art.video && (art.video as any).hls) {
          (art.video as any).hls.destroy();
        }
        art.destroy();
      } catch {}
      artInstance.current = null;
    };
  }, [url]);

  // 更新标题
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
