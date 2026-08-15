import { test, expect } from '@playwright/test';
import { uniqueProjectName } from './helpers';
import { DIALOG_BUG_FIXED } from './known-bugs';

/**
 * 故事地图：空态 → 创建旅程 → 旅程出现
 *
 * - 空态验证：新项目通过 gateway REST API 直接创建（绕开 Dialog 定位 bug），
 *   独立验证故事地图页空态。
 * - 创建旅程：依赖 Dialog 交互，当前被应用 bug 阻塞（Tailwind v4 未扫描
 *   packages/ui，Dialog 定位类缺失、渲染在视口外），修复后把
 *   known-bugs.ts 的 DIALOG_BUG_FIXED 置为 true 即可恢复。
 */
test.describe('故事地图', () => {
  test('空态展示', async ({ page }) => {
    // 通过 API 创建项目（不依赖 Dialog UI）
    const projectName = uniqueProjectName('e2e-storymap');
    const createRes = await page.request.post('/api/projects', {
      data: { name: projectName },
    });
    expect(createRes.ok()).toBeTruthy();
    const { id: projectId } = await createRes.json();

    // 进入 story-map 页
    await page.goto(`/projects/${projectId}/story-map`);

    // 空态
    await expect(page.getByText('暂无用户旅程')).toBeVisible();
    await expect(
      page.getByText('创建第一个用户旅程来开始规划产品'),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: '添加旅程' })).toBeVisible();

    // 清理
    await page.request.delete(`/api/projects/${projectId}`);
  });

  test('创建旅程后旅程出现', async ({ page }) => {
    test.skip(!DIALOG_BUG_FIXED, '阻塞于 Dialog 定位 bug（Tailwind 未扫描 packages/ui），见 known-bugs.ts');

    // 通过 API 创建项目
    const projectName = uniqueProjectName('e2e-storymap');
    const createRes = await page.request.post('/api/projects', {
      data: { name: projectName },
    });
    expect(createRes.ok()).toBeTruthy();
    const { id: projectId } = await createRes.json();

    await page.goto(`/projects/${projectId}/story-map`);

    // 打开创建旅程对话框
    await page.getByRole('button', { name: '添加旅程' }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    const journeyName = `注册流程 ${Date.now()}`;
    await dialog.getByLabel('旅程名称 *').fill(journeyName);
    await dialog.getByLabel('目标用户角色').fill('新用户');
    await dialog
      .getByLabel('描述')
      .fill('用户注册并激活账户的完整流程');
    await dialog.getByRole('button', { name: '创建' }).click();

    // 旅程创建后画布出现旅程头（名称可见）
    await expect(page.getByRole('heading', { name: journeyName })).toBeVisible();
    // 空态消失
    await expect(page.getByText('暂无用户旅程')).toHaveCount(0);
    // 统计面板显示 1 个旅程
    await expect(page.getByText('1 个旅程')).toBeVisible();

    // 清理
    await page.request.delete(`/api/projects/${projectId}`);
  });
});
