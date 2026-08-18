import { test, expect } from '@playwright/test';

/**
 * 设置页：API Token 生成 / 撤销流程
 *
 * - 前置清理：确保未配置 Token（幂等）
 * - 生成 Token 后 UI 显示 token 值 + 「撤销 Token」按钮
 * - 撤销后回到未配置态
 */

test.describe('API Token 设置', () => {
  test('生成 Token 后显示并可撤销', async ({ page }) => {
    // 前置清理:确保未配置
    const delRes = await page.request.delete('/api/settings/token');
    expect(delRes.ok()).toBeTruthy();
    const statusRes = await page.request.get('/api/settings/token');
    const status0 = await statusRes.json();
    expect(status0.configured).toBeFalsy();

    await page.goto('/settings');

    // 未配置态
    await expect(
      page.getByText('未配置 API Token（写操作当前无需认证）'),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: '生成 Token' }),
    ).toBeVisible();

    // 生成 Token
    await page.getByRole('button', { name: '生成 Token' }).click();

    // Token 显示(输入框有值)
    const tokenInput = page.locator('input[readonly][class*="font-mono"]');
    await expect(tokenInput).toBeVisible();
    await expect(tokenInput).not.toHaveValue('');

    // 撤销
    page.once('dialog', (d) => d.accept());
    await page.getByRole('button', { name: '撤销 Token' }).click();

    // 回到未配置态
    await expect(
      page.getByText('未配置 API Token（写操作当前无需认证）'),
    ).toBeVisible();

    // 服务端确认已撤销
    const afterRes = await page.request.get('/api/settings/token');
    const after = await afterRes.json();
    expect(after.configured).toBeFalsy();
  });
});