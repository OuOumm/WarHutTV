/**
 * 安全清理视频简介文本：
 * 1. 先移除 script/style 标签，防止 XSS
 * 2. 解码 HTML 实体（如 &nbsp;）
 * 3. 去除剩余 HTML 标签
 * 4. 去掉首尾空白
 */
export function cleanVodContent(text: string | undefined | null): string {
  if (!text) return '';

  // 1. 先剥离可能触发脚本/样式的危险标签
  const safe = text
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '');

  // 2. 用 DOMParser 解码 HTML 实体并取纯文本
  const parser = new DOMParser();
  const doc = parser.parseFromString(safe, 'text/html');
  const decoded = doc.body?.textContent || doc.documentElement?.textContent || '';

  // 3. 再兜底去掉任何残留标签
  let cleaned = decoded.replace(/<[^>]*>/g, '');

  // 4. 所有连续 Unicode 空白（含 &nbsp; 解码后的 U+00A0、全角空格 U+3000、\t、\n 等）
  //    统一压成单个普通空格，简介中长串空格/制表/换行形成的"空行"一并消除
  cleaned = cleaned.replace(/\p{White_Space}+/gu, ' ').trim();

  return cleaned;
}

/**
 * 解码常见 HTML 实体（用于不依赖 DOMParser 的场景）
 */
export function decodeHtmlEntities(text: string): string {
  if (!text) return '';

  const map: Record<string, string> = {
    '&nbsp;': ' ',
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
    '&#x27;': "'",
    '&#x2F;': '/',
    '&#47;': '/',
  };

  return text.replace(/&[a-zA-Z0-9#]+;/g, (entity) => map[entity] || entity);
}
