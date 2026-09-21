import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'happy-dom',
    // node 22+ 的全局 localStorage 声明会遮蔽 happy-dom 的那份（值为 undefined），
    // 使 zustand persist 相关测试全挂——setup 文件补回内存实现
    setupFiles: ['./vitest.setup.ts'],
    include: [
      'src/**/*.test.ts',
      'src/**/*.test.tsx',
      'src/**/__tests__/**/*.test.ts',
      'src/**/__tests__/**/*.test.tsx',
    ],
    // e2e 归 Playwright（apps/web/e2e/*.spec.ts）：被 vitest 收集会报
    // "Playwright Test did not expect test.describe() to be called here"
    exclude: ['**/node_modules/**', '**/.git/**', 'e2e/**'],
    globals: false,
  },
});
