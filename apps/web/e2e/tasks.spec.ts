import { test, expect } from '@playwright/test';
import { uniqueProjectName } from './helpers';

/**
 * 任务页：空态 + 统计面板
 *
 * 新项目通过 gateway REST API 直接创建（绕开 Dialog 定位 bug：
 * Tailwind v4 未扫描 packages/ui，Dialog 渲染在视口外），
 * 从而独立验证任务页自身功能。
 */

test.describe('任务管理', () => {
  test('空态与统计面板渲染', async ({ page }) => {
    // 通过 API 创建项目（不依赖 Dialog UI）
    const projectName = uniqueProjectName('e2e-tasks');
    const createRes = await page.request.post('/api/projects', {
      data: { name: projectName },
    });
    expect(createRes.ok()).toBeTruthy();
    const { id: projectId } = await createRes.json();

    // 直接进入任务页
    await page.goto(`/projects/${projectId}/tasks`);

    // 页面标题
    await expect(
      page.getByRole('heading', { name: '任务管理' }),
    ).toBeVisible();

    // 空态提示（新项目无任务）
    await expect(
      page.getByText('暂无任务，请先创建用户故事并拆解任务'),
    ).toBeVisible();

    // 统计面板：总任务数 0、已完成 0、进行中 0、完成率 0%
    const stats = page.locator('div.grid.md\\:grid-cols-5');
    await expect(stats).toBeVisible();

    const totalCard = stats.locator('div').filter({ hasText: '总任务数' });
    await expect(totalCard.getByText('0', { exact: true })).toBeVisible();

    const doneCard = stats.locator('div').filter({ hasText: '已完成' });
    await expect(doneCard.getByText('0', { exact: true })).toBeVisible();

    const inProgressCard = stats
      .locator('div')
      .filter({ hasText: '进行中' });
    await expect(
      inProgressCard.getByText('0', { exact: true }),
    ).toBeVisible();

    const progressCard = stats.locator('div').filter({ hasText: '完成率' });
    await expect(progressCard.getByText('0%', { exact: true })).toBeVisible();

    // 清理：删除测试项目
    await page.request.delete(`/api/projects/${projectId}`);
  });
});
