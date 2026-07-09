import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { readFileSync } from 'fs'
import { resolve } from 'path'

// 读取根目录 version 文件
let appVersion = '0.0.0'
try {
  appVersion = readFileSync(resolve(__dirname, '../version'), 'utf-8').trim()
} catch {
  // Keep the development fallback version when the root version file is unavailable.
}

// Inject the anti-flash-of-wrong-theme script into index.html from the SAME
// theme data that theme.ts imports (src/store/themes.data.json). This keeps a
// single source of truth for the palettes instead of a hand-duplicated copy
// in the HTML shell.
function themeInlinePlugin(): Plugin {
  return {
    name: 'theme-inline',
    transformIndexHtml(html) {
      let palettes: Array<{
        id: string;
        colors: Record<string, string>;
        visual: { texture: string; glowAnimation: string };
      }> = [];
      try {
        palettes = JSON.parse(
          readFileSync(resolve(__dirname, 'src/store/themes.data.json'), 'utf-8'),
        );
      } catch {
        return html;
      }

      const map: Record<string, Record<string, string>> = {};
      for (const t of palettes) {
        const c = t.colors;
        map[t.id] = {
          deep: c.deep,
          card: c.card,
          surface: c.surface,
          primary: c.primary,
          primaryDim: c.primaryDim,
          primaryGlow: c.primaryGlow,
          text: c.text,
          muted: c.muted,
          glass: c.glass,
          glassBorder: c.glassBorder,
          texture: t.visual.texture,
          glowAnim: t.visual.glowAnimation,
        };
      }

      const script =
        `<script>(function(){var themes=${JSON.stringify(map)};` +
        `var saved=localStorage.getItem('warhut-theme');` +
        `var t=themes[saved]||themes['crimson-cinema'];` +
        `var r=document.documentElement;` +
        `r.setAttribute('data-theme',saved||'crimson-cinema');` +
        `r.setAttribute('data-texture',t.texture);` +
        `r.setAttribute('data-glow-anim',t.glowAnim);` +
        `r.style.setProperty('--color-deep',t.deep);` +
        `r.style.setProperty('--color-card',t.card);` +
        `r.style.setProperty('--color-surface',t.surface);` +
        `r.style.setProperty('--color-primary',t.primary);` +
        `r.style.setProperty('--color-primary-dim',t.primaryDim);` +
        `r.style.setProperty('--color-primary-glow',t.primaryGlow);` +
        `r.style.setProperty('--color-text',t.text);` +
        `r.style.setProperty('--color-muted',t.muted);` +
        `r.style.setProperty('--color-glass',t.glass);` +
        `r.style.setProperty('--color-glass-border',t.glassBorder);` +
        `})();</script>`;

      return html.replace('<!--theme-inline-->', script);
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), themeInlinePlugin()],
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      }
    }
  },
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/react')) {
            return 'react-vendor'
          }
          if (id.includes('node_modules/artplayer') || id.includes('node_modules/hls.js')) {
            return 'player'
          }
          if (id.includes('node_modules/dexie')) {
            return 'storage'
          }
          if (id.includes('node_modules/')) {
            return 'vendor'
          }
        }
      }
    }
  }
})
