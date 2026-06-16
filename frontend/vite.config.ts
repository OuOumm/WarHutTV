import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
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
          if (id.includes('node_modules/react-router')) {
            return 'react-vendor'
          }
        }
      }
    }
  }
})
