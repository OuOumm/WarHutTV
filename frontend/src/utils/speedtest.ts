import Hls from 'hls.js';

export interface SpeedTestResult {
  quality: string;
  loadSpeed: string;
  pingTime: number;
}

function hasArrayBufferPayload(data: unknown): data is { payload: ArrayBuffer } {
  return typeof data === 'object' && data !== null && 'payload' in data && data.payload instanceof ArrayBuffer;
}

function isFatalHlsError(data: unknown): data is { fatal: true } {
  return typeof data === 'object' && data !== null && 'fatal' in data && data.fatal === true;
}

export async function testVideoSpeed(m3u8Url: string): Promise<SpeedTestResult> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const video = document.createElement('video');
    video.muted = true;
    video.preload = 'metadata';

    const pingStart = performance.now();
    let pingTime = 0;

    fetch(m3u8Url, { method: 'HEAD', mode: 'no-cors' })
      .then(() => { pingTime = performance.now() - pingStart; })
      .catch(() => { pingTime = performance.now() - pingStart; });

    const hls = new Hls();

    const cleanup = () => {
      clearTimeout(timeout);
      hls.destroy();
      video.remove();
    };

    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error('Timeout'));
    }, 5000);

    video.onerror = () => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error('Failed to load'));
    };

    let loadSpeed = '未知';
    let speedCalculated = false;
    let metadataLoaded = false;
    let fragmentStartTime = 0;

    const checkResolve = () => {
      if (settled) return;
      if (metadataLoaded && (speedCalculated || loadSpeed !== '未知')) {
        settled = true;
        const width = video.videoWidth;
        cleanup();

        const quality = width >= 3840 ? '4K'
          : width >= 2560 ? '2K'
          : width >= 1920 ? '1080p'
          : width >= 1280 ? '720p'
          : width >= 854 ? '480p' : 'SD';

        resolve({ quality, loadSpeed, pingTime: Math.round(pingTime) });
      }
    };

    hls.on(Hls.Events.FRAG_LOADING, () => {
      fragmentStartTime = performance.now();
    });

    hls.on(Hls.Events.FRAG_LOADED, (_event: unknown, data: unknown) => {
      if (settled || speedCalculated) return;
      if (fragmentStartTime > 0 && hasArrayBufferPayload(data)) {
        const loadTime = performance.now() - fragmentStartTime;
        const size = data.payload.byteLength || 0;
        if (loadTime > 0 && size > 0) {
          const speedKBps = size / 1024 / (loadTime / 1000);
          loadSpeed = speedKBps >= 1024
            ? `${(speedKBps / 1024).toFixed(1)} MB/s`
            : `${speedKBps.toFixed(1)} KB/s`;
          speedCalculated = true;
          checkResolve();
        }
      }
    });

    hls.loadSource(m3u8Url);
    hls.attachMedia(video);

    hls.on(Hls.Events.ERROR, (_event: unknown, data: unknown) => {
      if (isFatalHlsError(data)) {
        if (settled) return;
        settled = true;
        cleanup();
        reject(new Error('HLS error'));
      }
    });

    video.onloadedmetadata = () => {
      metadataLoaded = true;
      checkResolve();
    };
  });
}
