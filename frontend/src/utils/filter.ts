const yellowWords = [
  '伦理片', '福利', '里番动漫', '门事件', '萝莉少女', '制服诱惑',
  '国产传媒', 'cosplay', '黑丝诱惑', '无码', '日本无码', '有码',
  '日本有码', 'SWAG', '网红主播', '色情片', '同性片', '福利视频',
  '福利片', '写真热舞', '倫理片', '理论片', '韩国伦理', '港台三级',
  '伦理', '日本伦理', '解说', '里番'
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

// 标准化字符串：去除特殊字符和空格
export function normalizeString(str: string): string {
  return str.replace(/[\s\-_\[\]【】（）()《》<>·.、，,。：:；;！!？?"']/g, '').toLowerCase();
}

// 检查是否精确匹配
export function isExactMatch(name: string, keyword: string): boolean {
  const normalizedName = normalizeString(name);
  const normalizedKeyword = normalizeString(keyword);
  
  if (!normalizedName || !normalizedKeyword) return false;
  
  // 完全相等
  if (normalizedName === normalizedKeyword) return true;
  
  // 名字以关键词开头，且后面只有数字（如年份、季数）
  if (normalizedName.startsWith(normalizedKeyword)) {
    const suffix = normalizedName.slice(normalizedKeyword.length);
    // 如果后缀为空或者是纯数字（年份、季数等），认为匹配
    if (!/^\d*$/.test(suffix)) return false;
  } else {
    return false;
  }
  
  return true;
}

// 精确匹配筛选
export function filterExactMatch<T extends { vod_name?: string; title?: string }>(
  items: T[],
  keyword: string
): T[] {
  if (!keyword) return items;
  return items.filter((item) => {
    const name = item.vod_name || item.title || '';
    return isExactMatch(name, keyword);
  });
}
