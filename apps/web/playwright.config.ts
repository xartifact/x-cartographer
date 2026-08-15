import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E 配置（x-cartographer web）
 *
 * - webServer 自动管理两个服务：
 *   1. gateway（apps/server，bun run src/index.ts，端口 8787）
 *   2. vite dev server（apps/web，bunx vite，端口 3001，/api 代理到 gateway）
 * - 若端口已被占用且服务健康（例如本地已手动启动），reuseExistingServer 会复用，
 *   不会重复拉起进程。本环境 CI=true 属正常开发环境标记，通过 PW_REUSE=1 显式开启复用。
 * - 使用完整版 Chromium（channel: 'chromium'，即 Chrome for Testing 的 new headless 模式），
 *   避免依赖 chromium-headless-shell 下载。
 */

const GATEWAY_PORT = 8787;
const WEB_PORT = 3001;

// CI 环境下默认不复用（由 CI 编排器管理服务生命周期），本地开发默认复用；
// 显式设置 PW_REUSE=1 可在任意环境强制复用已运行的健康服务。
const reuseExisting = !process.env.CI || !!process.env.PW_REUSE;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: [['list']],
  timeout: 60_000,
  expect: {
    timeout: 15_000,
  },

  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    channel: 'chromium',
    ...devices['Desktop Chrome'],
  },

  webServer: [
    {
      command: 'bun run src/index.ts',
      cwd: '../../apps/server',
      url: `http://localhost:${GATEWAY_PORT}/health`,
      reuseExistingServer: reuseExisting,
      timeout: 60_000,
      stdout: 'pipe',
      stderr: 'pipe',
    },
    {
      command: 'bunx vite',
      cwd: '.',
      url: `http://localhost:${WEB_PORT}/`,
      reuseExistingServer: reuseExisting,
      timeout: 60_000,
      stdout: 'pipe',
      stderr: 'pipe',
    },
  ],
});
