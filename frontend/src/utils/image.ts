/**
 * 处理豆瓣图片URL，根据设置使用CDN代理
 */
export function processImageUrl(originalUrl: string): string {
  if (!originalUrl) return originalUrl;

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
