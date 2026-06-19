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
  // 背景氛围光晕颜色
  glow1: string;
  glow2: string;
  glow3: string;
}

export interface ThemeVisual {
  // 纹理类型
  texture: 'grain' | 'noise' | 'fabric' | 'crystal' | 'silk' | 'bark';
  textureOpacity: number;
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

// 主题定义 - 每个主题都有独特的视觉个性
export const themes: Theme[] = [
  {
    id: 'crimson-cinema',
    name: '绯红影院',
    nameEn: 'Crimson Cinema',
    description: '剧院帷幕风格，暗红底色配绯红主调',
    colors: {
      deep: '#10080c',
      card: '#1a0f14',
      surface: '#231520',
      primary: '#e11d48',
      primaryDim: '#be123c',
      primaryGlow: 'rgba(225, 29, 72, 0.15)',
      text: '#f5f0f2',
      muted: '#8a7580',
      glass: 'rgba(26, 15, 20, 0.65)',
      glassBorder: 'rgba(225, 29, 72, 0.15)',
      glow1: 'rgba(225, 29, 72, 0.06)',
      glow2: 'rgba(244, 114, 182, 0.04)',
      glow3: 'rgba(251, 191, 36, 0.02)',
    },
    visual: {
      texture: 'fabric',
      textureOpacity: 0.04,
      glowAnimation: 'pulse',
      cardStyle: 'elevated',
      accentEffect: 'curtain',
    },
  },
  {
    id: 'cinema-gold',
    name: '影院金',
    nameEn: 'Cinema Gold',
    description: '经典影院风格，墨蓝底色配胶片金',
    colors: {
      deep: '#0b111e',
      card: '#111827',
      surface: '#0f172a',
      primary: '#e6b91e',
      primaryDim: '#b8941a',
      primaryGlow: 'rgba(230, 185, 30, 0.15)',
      text: '#f0f0f0',
      muted: '#8b95a5',
      glass: 'rgba(17, 24, 39, 0.65)',
      glassBorder: 'rgba(230, 185, 30, 0.15)',
      glow1: 'rgba(230, 185, 30, 0.05)',
      glow2: 'rgba(59, 130, 246, 0.03)',
      glow3: 'rgba(139, 92, 246, 0.02)',
    },
    visual: {
      texture: 'grain',
      textureOpacity: 0.035,
      glowAnimation: 'drift',
      cardStyle: 'sharp',
      accentEffect: 'filmstrip',
    },
  },
  {
    id: 'nebula-purple',
    name: '星云紫',
    nameEn: 'Nebula Purple',
    description: '深邃宇宙风格，暗紫底色配霓虹青',
    colors: {
      deep: '#0d0a1a',
      card: '#13102a',
      surface: '#1a1535',
      primary: '#00d4ff',
      primaryDim: '#00a8cc',
      primaryGlow: 'rgba(0, 212, 255, 0.15)',
      text: '#e8e6f0',
      muted: '#7a7590',
      glass: 'rgba(19, 16, 42, 0.65)',
      glassBorder: 'rgba(0, 212, 255, 0.15)',
      glow1: 'rgba(0, 212, 255, 0.05)',
      glow2: 'rgba(139, 92, 246, 0.06)',
      glow3: 'rgba(236, 72, 153, 0.03)',
    },
    visual: {
      texture: 'noise',
      textureOpacity: 0.03,
      glowAnimation: 'aurora',
      cardStyle: 'glass',
      accentEffect: 'nebula',
    },
  },
  {
    id: 'emerald-night',
    name: '翡翠夜',
    nameEn: 'Emerald Night',
    description: '自然有机风格，深绿底色配琥珀暖光',
    colors: {
      deep: '#0a1410',
      card: '#0f1f18',
      surface: '#132a1f',
      primary: '#f59e0b',
      primaryDim: '#d97706',
      primaryGlow: 'rgba(245, 158, 11, 0.15)',
      text: '#ecfdf5',
      muted: '#6b8a7a',
      glass: 'rgba(15, 31, 24, 0.65)',
      glassBorder: 'rgba(245, 158, 11, 0.15)',
      glow1: 'rgba(245, 158, 11, 0.05)',
      glow2: 'rgba(16, 185, 129, 0.05)',
      glow3: 'rgba(52, 211, 153, 0.03)',
    },
    visual: {
      texture: 'bark',
      textureOpacity: 0.03,
      glowAnimation: 'breathe',
      cardStyle: 'soft',
      accentEffect: 'ember',
    },
  },
  {
    id: 'arctic-ice',
    name: '极地冰',
    nameEn: 'Arctic Ice',
    description: '极简冷淡风格，冰蓝底色配纯白',
    colors: {
      deep: '#0c1222',
      card: '#111b2e',
      surface: '#162035',
      primary: '#60a5fa',
      primaryDim: '#3b82f6',
      primaryGlow: 'rgba(96, 165, 250, 0.15)',
      text: '#f0f4f8',
      muted: '#7a8ba5',
      glass: 'rgba(17, 27, 46, 0.65)',
      glassBorder: 'rgba(96, 165, 250, 0.15)',
      glow1: 'rgba(96, 165, 250, 0.05)',
      glow2: 'rgba(147, 197, 253, 0.04)',
      glow3: 'rgba(196, 181, 253, 0.02)',
    },
    visual: {
      texture: 'crystal',
      textureOpacity: 0.025,
      glowAnimation: 'shimmer',
      cardStyle: 'glass',
      accentEffect: 'frost',
    },
  },
  {
    id: 'rose-velvet',
    name: '玫瑰绒',
    nameEn: 'Rose Velvet',
    description: '优雅柔和风格，深粉底色配玫瑰金',
    colors: {
      deep: '#1a0a14',
      card: '#251020',
      surface: '#2d1528',
      primary: '#f9a8d4',
      primaryDim: '#ec4899',
      primaryGlow: 'rgba(249, 168, 212, 0.15)',
      text: '#fdf2f8',
      muted: '#a5789a',
      glass: 'rgba(37, 16, 32, 0.65)',
      glassBorder: 'rgba(249, 168, 212, 0.15)',
      glow1: 'rgba(249, 168, 212, 0.05)',
      glow2: 'rgba(244, 114, 182, 0.05)',
      glow3: 'rgba(251, 146, 60, 0.03)',
    },
    visual: {
      texture: 'silk',
      textureOpacity: 0.03,
      glowAnimation: 'breathe',
      cardStyle: 'elevated',
      accentEffect: 'petal',
    },
  },
];

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
  root.style.setProperty('--glow-1', colors.glow1);
  root.style.setProperty('--glow-2', colors.glow2);
  root.style.setProperty('--glow-3', colors.glow3);
  
  // 视觉风格变量
  root.style.setProperty('--texture-opacity', String(visual.textureOpacity));
  root.dataset.theme = theme.id;
  root.dataset.texture = visual.texture;
  root.dataset.glowAnim = visual.glowAnimation;
  root.dataset.cardStyle = visual.cardStyle;
  root.dataset.accentEffect = visual.accentEffect;
}
