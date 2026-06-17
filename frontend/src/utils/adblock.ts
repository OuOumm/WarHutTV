// 过滤广告 + 解析相对路径
function filterAdsFromM3U8(content: string, baseUrl: string): string {
  if (!content) return '';
  
  // 获取域名和基础路径
  const urlObj = new URL(baseUrl);
  const origin = urlObj.origin; // https://svip.ryiplay18.com
  let basePath = baseUrl;
  const lastSlash = baseUrl.lastIndexOf('/');
  if (lastSlash >= 0) {
    basePath = baseUrl.substring(0, lastSlash + 1);
  }
  
  // 解析相对路径
  const resolveUrl = (url: string): string => {
    if (!url) return url;
    // 已经是绝对路径
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    // 以 / 开头的路径（相对于域名根）
    if (url.startsWith('/')) return origin + url;
    // 相对路径
    try { return new URL(url, basePath).href; } catch { return url; }
  };
  
  return content.split('\n').map(line => {
    const trimmed = line.trim();
    
    // 移除 DISCONTINUITY
    if (trimmed.includes('#EXT-X-DISCONTINUITY')) return null;
    
    // 处理标签中的 URI
    if (trimmed.startsWith('#') && trimmed.includes('URI="')) {
      return trimmed.replace(/URI="([^"]+)"/, (_match, uri) => {
        return `URI="${resolveUrl(uri)}"`;
      });
    }
    
    // 跳过其他标签和空行
    if (!trimmed || trimmed.startsWith('#')) return line;
    
    // 处理 ts 等资源路径
    return resolveUrl(trimmed);
  }).filter(line => line !== null).join('\n');
}

// 检测是否为主播放列表
function isMasterPlaylist(content: string): boolean {
  return content.includes('#EXT-X-STREAM-INF');
}

// 从主播放列表获取第一个流地址
function getFirstStreamUrl(content: string, baseUrl: string): string | null {
  const lines = content.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    if (trimmed.endsWith('.m3u8')) {
      if (trimmed.startsWith('http')) return trimmed;
      try { return new URL(trimmed, baseUrl).href; } catch { return null; }
    }
  }
  return null;
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
    
    // 主播放列表 - 获取嵌套的流
    if (isMasterPlaylist(content)) {
      const streamUrl = getFirstStreamUrl(content, url);
      if (!streamUrl) return url;
      
      const streamRes = await fetch(streamUrl);
      if (!streamRes.ok) return streamUrl;
      
      const streamContent = await streamRes.text();
      const blob = new Blob([filterAdsFromM3U8(streamContent, streamUrl)], { type: 'application/vnd.apple.mpegurl' });
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
