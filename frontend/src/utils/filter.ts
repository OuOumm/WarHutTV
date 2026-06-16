const yellowWords = [
  '伦理片', '福利', '里番动漫', '门事件', '萝莉少女', '制服诱惑',
  '国产传媒', 'cosplay', '黑丝诱惑', '无码', '日本无码', '有码',
  '日本有码', 'SWAG', '网红主播', '色情片', '同性片', '福利视频',
  '福利片', '写真热舞', '倫理片', '理论片', '韩国伦理', '港台三级',
  '伦理', '日本伦理', '电影解说'
];

export function isYellowContent(text: string): boolean {
  if (!text) return false;
  const lower = text.toLowerCase();
  return yellowWords.some((word) => lower.includes(word));
}

export function filterYellowItems<T extends { vod_name?: string; title?: string }>(
  items: T[]
): T[] {
  return items.filter((item) => {
    const name = item.vod_name || item.title || '';
    return !isYellowContent(name);
  });
}
