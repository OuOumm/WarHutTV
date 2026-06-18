import { useEffect } from 'react';
import { useConfig } from '../store/config';
import { getCurrentTheme } from '../store/theme';

/**
 * 动态更新文档标题和 PWA 元数据
 * 跟随 config.json 的 site_name 配置
 */
export function useDocumentTitle() {
  const { siteName } = useConfig();

  useEffect(() => {
    if (!siteName) return;

    // 更新页面标题
    document.title = siteName;

    // 更新 Apple 移动端应用标题
    let appleTitle = document.querySelector('meta[name="apple-mobile-web-app-title"]');
    if (!appleTitle) {
      appleTitle = document.createElement('meta');
      appleTitle.setAttribute('name', 'apple-mobile-web-app-title');
      document.head.appendChild(appleTitle);
    }
    appleTitle.setAttribute('content', siteName);

    // 更新 description
    let description = document.querySelector('meta[name="description"]');
    if (!description) {
      description = document.createElement('meta');
      description.setAttribute('name', 'description');
      document.head.appendChild(description);
    }
    description.setAttribute('content', `${siteName} - 影视聚合播放器`);

  }, [siteName]);
}

/**
 * 动态更新 manifest.json
 * 跟随 config.json 的 site_name 和主题颜色
 */
export function useDynamicManifest() {
  const { siteName } = useConfig();

  useEffect(() => {
    if (!siteName) return;

    const theme = getCurrentTheme();
    const origin = window.location.origin;

    // 构建动态 manifest（使用完整绝对路径）
    const manifest = {
      id: "/",
      name: siteName,
      short_name: siteName,
      description: `${siteName} - 影视聚合播放器`,
      start_url: origin + '/',
      display: 'standalone',
      background_color: theme.colors.deep,
      theme_color: theme.colors.primary,
      orientation: 'any',
      icons: [
        {
          src: origin + '/icon-144.png',
          sizes: '144x144',
          type: 'image/png',
          purpose: 'any'
        },
        {
          src: origin + '/icon-192.png',
          sizes: '192x192',
          type: 'image/png',
          purpose: 'maskable'
        },
        {
          src: origin + '/icon-512.png',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'maskable'
        }
      ],
      screenshots: [
        {
          src: origin + '/screenshot-desktop.png',
          sizes: '1280x720',
          type: 'image/png',
          form_factor: 'wide',
          label: '桌面端界面'
        },
        {
          src: origin + '/screenshot-mobile.png',
          sizes: '375x667',
          type: 'image/png',
          form_factor: 'narrow',
          label: '移动端界面'
        }
      ],
      categories: ['entertainment', 'video'],
      lang: 'zh-CN'
    };

    // 创建 Blob URL
    const blob = new Blob([JSON.stringify(manifest)], { type: 'application/json' });
    const manifestUrl = URL.createObjectURL(blob);

    // 移除旧的 manifest 标签
    const oldManifest = document.querySelector('link[rel="manifest"]');
    if (oldManifest) {
      oldManifest.remove();
    }

    // 创建新的 manifest 标签
    const link = document.createElement('link');
    link.rel = 'manifest';
    link.href = manifestUrl;
    document.head.appendChild(link);

    // 同时更新 theme-color
    let themeColor = document.querySelector('meta[name="theme-color"]');
    if (!themeColor) {
      themeColor = document.createElement('meta');
      themeColor.setAttribute('name', 'theme-color');
      document.head.appendChild(themeColor);
    }
    themeColor.setAttribute('content', theme.colors.primary);

    // 清理函数
    return () => {
      URL.revokeObjectURL(manifestUrl);
    };
  }, [siteName]);
}
