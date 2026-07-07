import { defineConfig } from 'vite'
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

export default defineConfig({
  plugins: [react(), tailwindcss()],
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
