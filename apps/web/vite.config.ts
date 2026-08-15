import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcssPostcss from '@tailwindcss/postcss';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  plugins: [
    react(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  css: {
    postcss: {
      plugins: [
        // base 指向 monorepo 根：让 Tailwind 扫描到 packages/ui 源码 class
        tailwindcssPostcss({ base: fileURLToPath(new URL('../../', import.meta.url)) }),
      ],
    },
  },
  server: {
    port: 3001,
    proxy: {
      // 开发时把 /api 代理到 gateway
      '/api': {
        target: 'http://localhost:8787',
        changeOrigin: true,
      },
      '/health': {
        target: 'http://localhost:8787',
        changeOrigin: true,
      },
    },
  },
});
