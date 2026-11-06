// 主题配置
export interface ThemeColors {
  deep: string;
  card: string;
  surface: string;
  primary: string;
  primaryDim: string;
  primaryGlow: string;
  text: string;
  muted: string;
  glass: string;
  glassBorder: string;
  watched: string;
}

export interface ThemeVisual {
  // 纹理类型
  texture: 'grain' | 'noise' | 'fabric' | 'crystal' | 'silk' | 'bark';
  // 光晕动画
  glowAnimation: 'pulse' | 'drift' | 'shimmer' | 'breathe' | 'aurora' | 'none';
  // 卡片风格
  cardStyle: 'sharp' | 'soft' | 'glass' | 'elevated';
  // 强调色特效
  accentEffect: 'curtain' | 'filmstrip' | 'nebula' | 'ember' | 'frost' | 'petal';
}

export interface Theme {
  id: string;
  name: string;
  nameEn: string;
  description: string;
  colors: ThemeColors;
  visual: ThemeVisual;
}

// 单一数据源：所有主题调色板只在这里维护一次。
// index.html 的防闪烁内联脚本由 vite.config.ts 的 themeInlinePlugin
// 从该 JSON 自动生成，theme.ts 也从此处导入 —— 不再有两份手维护的副本。
import themesData from './themes.data.json';

export const themes = themesData as Theme[];

// localStorage key
const THEME_KEY = 'warhut-theme';

// 获取当前主题
export function getCurrentTheme(): Theme {
  const saved = localStorage.getItem(THEME_KEY);
  if (saved) {
    const found = themes.find(t => t.id === saved);
    if (found) return found;
  }
  return themes.find(t => t.id === 'crimson-cinema') || themes[0];
}

// 保存主题
export function saveTheme(themeId: string): void {
  localStorage.setItem(THEME_KEY, themeId);
}

// 应用主题到 CSS 变量
// 将十六进制颜色转为 RGB 分量字符串（如 #e11d48 → "225, 29, 72"）
function hexToRgb(hex: string): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return '0, 0, 0';
  return `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`;
}

export function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  const { colors, visual } = theme;
  
  // 颜色变量
  root.style.setProperty('--color-deep', colors.deep);
  root.style.setProperty('--color-card', colors.card);
  root.style.setProperty('--color-surface', colors.surface);
  root.style.setProperty('--color-primary', colors.primary);
  root.style.setProperty('--color-primary-rgb', hexToRgb(colors.primary));
  root.style.setProperty('--color-primary-dim', colors.primaryDim);
  root.style.setProperty('--color-primary-dim-rgb', hexToRgb(colors.primaryDim));
  root.style.setProperty('--color-primary-glow', colors.primaryGlow);
  root.style.setProperty('--color-text', colors.text);
  root.style.setProperty('--color-muted', colors.muted);
  root.style.setProperty('--color-glass', colors.glass);
  root.style.setProperty('--color-glass-border', colors.glassBorder);
  root.style.setProperty('--color-watched', colors.watched);
  
  // 视觉风格变量
  root.dataset.theme = theme.id;
  root.dataset.texture = visual.texture;
  root.dataset.glowAnim = visual.glowAnimation;
  root.dataset.cardStyle = visual.cardStyle;
  root.dataset.accentEffect = visual.accentEffect;

  // theme-color 决定移动端浏览器地址栏 / 任务切换器的配色。它原本只在
  // useDynamicManifest 里随 site_name 更新一次，切换主题后不会跟着变，
  // 导致浏览器 UI 与页面主体配色不一致。这里在应用主题时同步更新。
  let meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.setAttribute('name', 'theme-color');
    document.head.appendChild(meta);
  }
  meta.setAttribute('content', colors.deep);
}
