import { test as base } from '@playwright/test';

/**
 * 全局 E2E fixture：
 * - 每个测试前预置 onboarding 跳过标志（避免快速入门向导遮挡页面）
 * - 测试环境隔离：绕过向导弹窗，直接进入应用页面
 */

// 在页面加载应用前注入 localStorage 标志
export const test = base.extend({
  page: async ({ page }, use) => {
    await page.addInitScript(() => {
      try {
        localStorage.setItem('xcart-onboarding-done', 'true');
      } catch {
        // 忽略
      }
    });
    await use(page);
  },
});

export { expect } from '@playwright/test';