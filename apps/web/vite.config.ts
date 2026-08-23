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
      // 开发时把 /api 代理到 gateway（可通过 VITE_PROXY_TARGET 覆盖，e2e 用 8791 测试网关）
      '/api': {
        target: process.env.VITE_PROXY_TARGET ?? 'http://localhost:8787',
        changeOrigin: true,
      },
      '/health': {
        target: process.env.VITE_PROXY_TARGET ?? 'http://localhost:8787',
        changeOrigin: true,
      },
    },
  },
});
