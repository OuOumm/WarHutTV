import { useEffect, useRef } from 'react';
import Artplayer from 'artplayer';
import Hls from 'hls.js';
import { getCurrentTheme } from '../store/theme';
import { revokeBlobUrl } from '../utils/adblock';

interface PlayerProps {
  url: string;
  title?: string;
  currentTime?: number;
  /** Player feeds the latest (time, duration) — the progress writer throttles. */
  onTimeUpdate?: (time: number, duration?: number) => void;
  /** Optional explicit flush hook (pause/ended) so progress is never lost. */
  onFlush?: () => void;
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

/**
 * Resolve the seek target used when switching playback sources in-place.
 *
 * Prefer the deterministic in-state live position (`seekTime`), which is fed
 * from the `currentTime` prop. `applyResumeProgress` sets it to the real
 * resume point right before the switch, and `tick` keeps it fresh every 500ms.
 * Only fall back to the raw video element's currentTime when the state value is
 * still 0 (e.g. the very first play before any tick).
 *
 * Reading `art.video.currentTime` directly during the switch effect races with
 * React's commit timing and can read 0, which previously made the player start
 * from 0:00 after a mid-play source switch even though the "继续播放" toast
 * showed the correct timestamp. Using the state value eliminates that race.
 */
export function resolveSwitchSeekTarget(seekTime: number, videoCurrentTime: number): number {
  if (seekTime > 0) return seekTime;
  if (videoCurrentTime > 0) return videoCurrentTime;
  return 0;
}

const Player = ({ url, title, currentTime, onTimeUpdate, onFlush, onNext, onEnded, hasNext }: PlayerProps) => {
  const artRef = useRef<HTMLDivElement>(null);
  const artInstance = useRef<Artplayer | null>(null);
  const prevBlobUrl = useRef<string | null>(null);
  const seekDoneRef = useRef(false);
  const seekTimeRef = useRef(0);
  const onTimeUpdateRef = useRef(onTimeUpdate);
  // 持有最新 onFlush，避免为 flush 重建事件监听
  const onFlushRef = useRef(onFlush);
  // 跳过 switch effect 的首帧（创建时已加载首个 url，无需再 switch）
  const skipFirstSwitch = useRef(true);
  // 下一集回调 / 结束回调 / 是否有下一集（用 ref 持有最新值，避免重建播放器）
  const onNextRef = useRef(onNext);
  const onEndedRef = useRef(onEnded);
  const hasNextRef = useRef(hasNext);
  const nextControlRef = useRef<HTMLElement | null>(null);
  // 换源进行中标记：换源到新视频 seek 完成之前为 true，期间暂停进度回写，
  // 避免新视频起始的 0 写入历史，导致续播点被清零。
  const seekingRef = useRef(false);
  // 换源「时间守卫」监听句柄：seek 未真正落地前在 timeupdate 上反复重试，
  // 换源/卸载时据此移除监听，避免泄漏。
  const seekNetRef = useRef<(() => void) | null>(null);

  // Keep callback ref in sync without triggering effect re-runs
  useEffect(() => { onTimeUpdateRef.current = onTimeUpdate; });
  useEffect(() => { onFlushRef.current = onFlush; });
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

    // 只在「成功出帧」后才记录进度（video:playing 而非 play）——卡顿/失败的源
    // 在真正播放前就可能触发 play，会污染历史；playing 才是有效播放门槛。
    let hasPlayed = false;
    art.on('video:playing', () => { hasPlayed = true; });

    const saveInterval = setInterval(() => {
      // 换源 seek 完成前不回写进度：避免把新视频起始 0 写入 currentTime/历史，
      // 否则会覆盖续播定位（seekTimeRef 被置 0 导致 loadedmetadata 时不 seek）
      if (hasPlayed && !seekingRef.current && art.video && onTimeUpdateRef.current) {
        const dur = art.video.duration;
        onTimeUpdateRef.current(
          art.video.currentTime,
          dur && Number.isFinite(dur) ? dur : undefined,
        );
      }
    }, 500);

    // 暂停时立即把当前进度落库（单写器的 flush），避免关页/切后台丢进度
    art.on('video:pause', () => { onFlushRef.current?.(); });

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
        html: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="22" height="22"><polygon points="5 4 15 12 5 20 5 4"/><line x1="19" y1="5" x2="19" y2="19"/></svg>',
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

    // 自动连播：一集放完自动跳到下一集；同时立即落库最终进度
    art.on('video:ended', () => {
      onFlushRef.current?.();
      onEndedRef.current?.();
    });

    return () => {
      clearInterval(saveInterval);
      nextControlRef.current = null;
      // 移除可能残留的换源时间守卫监听
      if (seekNetRef.current) {
        try { art.off('video:timeupdate', seekNetRef.current); } catch { /* noop */ }
        seekNetRef.current = null;
      }
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

    // 清理上一次换源残留的「时间守卫」监听，避免重复/泄漏
    if (seekNetRef.current) {
      art.off('video:timeupdate', seekNetRef.current);
      seekNetRef.current = null;
    }

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

    // 换源续播位置以「状态里的实时进度」为准：applyResumeProgress 已把真实续播点写入
    // state.currentTime（→ seekTimeRef），tick 每 500ms 刷新。直接读 art.video.currentTime
    // 会在 React effect 提交时机下竞争到 0，导致换源后从 0 开始。
    const target = resolveSwitchSeekTarget(
      seekTimeRef.current,
      art.video ? art.video.currentTime : 0,
    );

    // 重置进度恢复标记。新源加载后恢复到 target；恢复期间 seekingRef 保持 true，
    // 阻止进度回写（避免把新源起始 0 写入历史、续播点被清零）。只有「实际 seek 已
    // 落地」（video.currentTime 真正到达 target）才解除 seekingRef，确保不会从 0 播放。
    seekDoneRef.current = false;
    seekingRef.current = true;

    if (target > 0) {
      // 目标位置可能超过新源时长 → 钳制到时长，避免无意义超界 seek
      const safeTarget = (): number => {
        const dur = art.video?.duration;
        if (dur && Number.isFinite(dur) && target > dur) return dur;
        return target;
      };
      // 发起一次 seek；媒体暂不可 seek（可搜索区间未就绪 / autoplay 抢跑）时静默失败，
      // 由下方 timeupdate 守卫重试，直到真正落地。
      const attemptSeek = () => {
        if (seekDoneRef.current) return;
        try {
          art.seek = safeTarget();
        } catch {
          /* 媒体尚未可 seek，等待下次事件重试 */
        }
      };
      // seek 真正落地（实际位置到达目标）后才解除守卫：避免 canplay 抢跑把 seekingRef
      // 提前清零、进度回写成 0 的经典 bug（即「显示上一源进度却从 0 播放」）。
      const onSeeked = () => {
        const t = safeTarget();
        if (art.video && Math.abs(art.video.currentTime - t) <= 2) {
          seekDoneRef.current = true;
          seekingRef.current = false;
          if (seekNetRef.current) {
            art.off('video:timeupdate', seekNetRef.current);
            seekNetRef.current = null;
          }
        }
      };

      art.once('video:loadedmetadata', attemptSeek);
      art.once('video:canplay', attemptSeek);
      art.once('video:seeked', onSeeked);

      // 时间守卫：无论 loadedmetadata/canplay/seeked 何种时序，只要实际位置仍明显
      // 落后目标，就反复重试 seek，直到视频真正到达目标位置，覆盖首次 seek 未落地的竞态。
      const net = () => {
        if (seekDoneRef.current) return;
        const t = safeTarget();
        if (art.video && art.video.currentTime < t - 2) {
          attemptSeek();
        }
      };
      seekNetRef.current = net;
      art.on('video:timeupdate', net);
    } else {
      // 无续播点，新源从头播放，直接解除守卫让进度正常回写
      seekingRef.current = false;
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
