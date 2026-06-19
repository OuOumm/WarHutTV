/**
 * 处理豆瓣图片URL，根据设置使用CDN代理
 */
export function processImageUrl(originalUrl: string): string {
  if (!originalUrl) return originalUrl;

  // Bangumi 图片走 CDN 代理
  if (originalUrl.includes('bgm.tv') || originalUrl.includes('bangumi.tv')) {
    return `https://cdn.404888.xyz/proxy/${originalUrl}`;
  }

  // 仅处理豆瓣图片
  if (!originalUrl.includes('doubanio.com')) {
    return originalUrl;
  }

  const proxy = localStorage.getItem('doubanProxy') || 'tencent';
  switch (proxy) {
    case 'ali':
      return originalUrl.replace(/img\d+\.doubanio\.com/g, 'img.doubanio.cmliussss.com');
    case 'direct':
      return originalUrl;
    case 'tencent':
    default:
      return originalUrl.replace(/img\d+\.doubanio\.com/g, 'img.doubanio.cmliussss.net');
  }
}
