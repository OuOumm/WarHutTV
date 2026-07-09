import type { BangumiItem } from '../types';

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

/**
 * 豆瓣海报响应式 srcSet。
 * 豆瓣图片路径内含尺寸 token（s/m/l_ratio_poster2），替换 token 即可得到不同
 * 分辨率，再走与 src 相同的代理处理。返回未命中豆瓣时 undefined（由调用方回退 src）。
 */
export function buildDoubanSrcSet(originalUrl: string): string | undefined {
  if (!originalUrl || !originalUrl.includes('doubanio.com')) return undefined;

  const variants: { token: string; w: number }[] = [
    { token: 's_ratio_poster2', w: 72 },
    { token: 'm_ratio_poster2', w: 135 },
    { token: 'l_ratio_poster2', w: 360 },
  ];

  const sets = variants.map(({ token, w }) => {
    const variant = originalUrl.replace(/(s|m|l|xl)_ratio_poster2/, token);
    return `${processImageUrl(variant)} ${w}w`;
  });

  return sets.join(', ');
}

/**
 * Bangumi 封面响应式 srcSet（按字段自带的多档尺寸）。
 * 宽度为近似值，足以让浏览器挑选最合适的档位；不足两档时返回 undefined。
 */
export function buildBangumiSrcSet(
  images: BangumiItem['images']
): string | undefined {
  if (!images) return undefined;

  const candidates: { url: string; w: number }[] = [
    { url: images.small, w: 80 },
    { url: images.medium, w: 140 },
    { url: images.common, w: 220 },
    { url: images.large, w: 400 },
  ];

  const sets = candidates
    .filter((c) => c.url)
    .map((c) => `${processImageUrl(c.url)} ${c.w}w`);

  return sets.length > 1 ? sets.join(', ') : undefined;
}

/** 卡片网格的通用 sizes 提示，配合 srcSet 让浏览器挑选合适档位 */
export const CARD_IMAGE_SIZES =
  '(min-width: 1280px) 220px, (min-width: 768px) 170px, 45vw';
