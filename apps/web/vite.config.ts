import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcssPostcss from '@tailwindcss/postcss';
import { fileURLToPath } from 'node:url';

// defineConfig 回调模式: 用 loadEnv 显式加载 .env(local)，使 VITE_PROXY_TARGET 真正生效
export default defineConfig(({ mode }) => {
  // 从 apps/web 目录加载 .env / .env.local，读入 process.env 供 server.proxy 使用
  const env = loadEnv(mode, process.cwd(), '');
  const proxyTarget = env.VITE_PROXY_TARGET ?? process.env.VITE_PROXY_TARGET ?? 'http://localhost:8787';

  return {
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
        // 开发时把 /api 代理到 gateway（VITE_PROXY_TARGET 覆盖，e2e 用 8791 测试网关）
        '/api': {
          target: proxyTarget,
          changeOrigin: true,
        },
        '/health': {
          target: proxyTarget,
          changeOrigin: true,
        },
      },
    },
  };
});
