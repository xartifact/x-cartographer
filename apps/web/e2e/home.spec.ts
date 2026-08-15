import { test, expect } from '@playwright/test';

/**
 * 首页渲染：标题 + 导航卡片
 */
test.describe('首页', () => {
  test('渲染标题与导航卡片', async ({ page }) => {
    await page.goto('/');

    // 标题
    const heading = page.getByRole('heading', { name: 'X-Cartographer' });
    await expect(heading).toBeVisible();

    // 副标题
    await expect(
      page.getByText('AI Native 用户故事地图可视化应用'),
    ).toBeVisible();

    // 导航卡片 → 项目管理
    const card = page.getByRole('link', { name: /项目管理/ });
    await expect(card).toBeVisible();
    await expect(
      page.getByText('创建、导入、管理你的项目'),
    ).toBeVisible();

    // 点击卡片跳转到项目列表
    await card.click();
    await page.waitForURL('/projects');
    await expect(
      page.getByRole('heading', { name: '项目管理' }),
    ).toBeVisible();
  });
});
