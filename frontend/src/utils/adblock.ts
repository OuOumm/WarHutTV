// 过滤广告 + 解析相对路径
function filterAdsFromM3U8(content: string, baseUrl: string): string {
  if (!content) return '';

  const urlObj = new URL(baseUrl);
  const origin = urlObj.origin;
  let basePath = baseUrl;
  const lastSlash = baseUrl.lastIndexOf('/');
  if (lastSlash >= 0) {
    basePath = baseUrl.substring(0, lastSlash + 1);
  }

  const resolveUrl = (url: string): string => {
    if (!url) return url;
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    if (url.startsWith('/')) return origin + url;
    try { return new URL(url, basePath).href; } catch { return url; }
  };

  return content.split('\n').map(line => {
    const trimmed = line.trim();

    // 移除 DISCONTINUITY
    if (trimmed.includes('#EXT-X-DISCONTINUITY')) return null;

    // 处理标签中的 URI
    if (trimmed.startsWith('#') && trimmed.includes('URI="')) {
      return trimmed.replace(/URI="([^"]+)"/g, (_match, uri) => {
        return `URI="${resolveUrl(uri)}"`;
      });
    }

    // 跳过其他标签和空行
    if (!trimmed || trimmed.startsWith('#')) return line;

    // 处理 ts 等资源路径
    return resolveUrl(trimmed);
  }).filter(line => line !== null).join('\n');
}

interface Variant {
  url: string;
  bandwidth: number;
}

// 解析主播放列表的全部码率变体。
// 旧实现只取第一条流：主播放列表通常按码率从低到高排列，于是播放器总是拿到
// 最低清晰度，菜单里的"高清/超清"也全部失效。
function parseVariants(content: string, baseUrl: string): Variant[] {
  const lines = content.split('\n');
  const variants: Variant[] = [];

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (!trimmed.startsWith('#EXT-X-STREAM-INF')) continue;

    const bandwidthMatch = /BANDWIDTH=(\d+)/i.exec(trimmed);
    const bandwidth = bandwidthMatch ? Number(bandwidthMatch[1]) : 0;

    // 变体 URL 是紧跟在该标签之后的第一个非注释行。
    for (let j = i + 1; j < lines.length; j++) {
      const candidate = lines[j].trim();
      if (!candidate || candidate.startsWith('#')) continue;
      let resolved = candidate;
      if (!candidate.startsWith('http')) {
        try { resolved = new URL(candidate, baseUrl).href; } catch { resolved = candidate; }
      }
      variants.push({ url: resolved, bandwidth });
      i = j;
      break;
    }
  }

  return variants;
}

// 选择码率最高的变体：低码率变体通常只是同一内容的劣化版本，
// 让播放器自己再自适应意义不大（我们只代理这一个清单）。
export function pickBestVariant(variants: Variant[]): Variant | null {
  if (variants.length === 0) return null;
  return variants.reduce((best, v) => (v.bandwidth > best.bandwidth ? v : best));
}

export function isMasterPlaylist(content: string): boolean {
  return content.includes('#EXT-X-STREAM-INF');
}

// 获取并过滤 m3u8
export async function fetchAndFilterM3U8(url: string): Promise<string> {
  try {
    // 检查是否启用去广告
    const adEnabled = localStorage.getItem('enable_blockad') !== 'false';
    if (!adEnabled) return url;

    const response = await fetch(url);
    if (!response.ok) return url;

    const content = await response.text();
    if (!content.includes('#EXTM3U')) return url;

    // 主播放列表 - 选最高码率变体后再过滤
    if (isMasterPlaylist(content)) {
      const variant = pickBestVariant(parseVariants(content, url));
      if (!variant) return url;

      const streamRes = await fetch(variant.url);
      if (!streamRes.ok) return variant.url;

      const streamContent = await streamRes.text();
      const blob = new Blob([filterAdsFromM3U8(streamContent, variant.url)], { type: 'application/vnd.apple.mpegurl' });
      return URL.createObjectURL(blob);
    }

    // 普通播放列表 - 直接过滤
    const blob = new Blob([filterAdsFromM3U8(content, url)], { type: 'application/vnd.apple.mpegurl' });
    return URL.createObjectURL(blob);
  } catch {
    return url;
  }
}

// 清理 Blob URL
export function revokeBlobUrl(url: string) {
  if (url?.startsWith('blob:')) URL.revokeObjectURL(url);
}
