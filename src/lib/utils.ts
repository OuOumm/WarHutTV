import clsx, { ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Merge classes with tailwind-merge with clsx full feature */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * 随机获取一个图片反代基础URL前缀
 * @returns 随机选择的反代图片URL前缀字符串
 */
export function getRandomImageBaseUrl(): string {
  const IMAGE_PROXY_BASE_URLS = [
    'https://image.baidu.com/search/down?url=',
    'https://img.sogoucdn.com/v2/thumb/dl?appid=10150005&url=',
    'https://img.sogoucdn.com/v2/thumb/dl/1.jpg?appid=10150005&url=',
  ];
  return IMAGE_PROXY_BASE_URLS[Math.floor(Math.random() * IMAGE_PROXY_BASE_URLS.length)];
}