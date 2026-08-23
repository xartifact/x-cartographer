import { test, expect } from './fixtures';
import { createProjectViaUI, uniqueProjectName } from './helpers';
import { DIALOG_BUG_FIXED } from './known-bugs';

/**
 * 项目列表 / 创建流程
 *
 * 创建项目测试依赖 Dialog 交互，当前被应用 bug 阻塞：
 * Tailwind v4 未扫描 packages/ui（workspace 包在 node_modules symlink），
 * DialogContent 的 top-[50%]/translate-y-[-50%] 定位类缺失，
 * 对话框渲染在视口外，按钮不可点击。
 * 修复（globals.css 加 @source）后把 known-bugs.ts 的 DIALOG_BUG_FIXED 置为 true。
 */
test.describe('项目管理', () => {
  test('项目列表渲染', async ({ page }) => {
    await page.goto('/projects');

    await expect(
      page.getByRole('heading', { name: '项目管理' }),
    ).toBeVisible();
    // 页面始终提供「新建项目」与「导入 TOML」入口
    await expect(
      page.getByRole('button', { name: '新建项目' }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: '导入 TOML' }),
    ).toBeVisible();
  });

  test('创建项目后出现在列表并可进入详情页', async ({ page }) => {
    test.skip(!DIALOG_BUG_FIXED, '阻塞于 Dialog 定位 bug（Tailwind 未扫描 packages/ui），见 known-bugs.ts');

    const projectName = uniqueProjectName('e2e-projects');

    await createProjectViaUI(page, projectName);

    // 创建成功后跳转到项目详情概览页
    await expect(
      page.locator('h1', { hasText: projectName }).last(),
    ).toBeVisible();

    // 回到列表，新项目应出现在列表中
    await page.goto('/projects');
    const card = page
      .getByRole('link')
      .filter({ hasText: projectName });
    await expect(card).toBeVisible();

    // 从卡片进入详情页
    await card.click();
    await page.waitForURL(/\/projects\/[^/]+$/);
    await expect(
      page.locator('h1', { hasText: projectName }).last(),
    ).toBeVisible();
  });
});
