import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Vitest config — isolated from the production `vite.config.ts` so the build
// pipeline is untouched. Uses jsdom + Testing Library for component tests.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    css: false,
  },
});
