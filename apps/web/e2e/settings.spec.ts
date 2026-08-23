import { test, expect } from './fixtures';

/**
 * 设置页：API Token 配置流程
 *
 * 内置 AI（LLM 设置）已移除，智能交由外部 Agent 通过 xcart CLI 驱动；
 * 设置页仅保留 API Token 管理（外部 Agent / CI 接入网关认证）。
 */

test.describe('设置页（API Token）', () => {
  test('标题与 Token 生成/撤销按钮渲染', async ({ page }) => {
    await page.goto('/settings');

    await expect(page.getByRole('heading', { name: '设置' })).toBeVisible();
    await expect(
      page.getByText('API Token', { exact: true }),
    ).toBeVisible();
  });

  test('通过 gateway REST API 生成校验并撤销 Token', async ({ page }) => {
    // 生成一个新 Token
    const gen = await page.request.post('/api/settings/token');
    expect(gen.status()).toBe(201);
    const { token } = await gen.json();
    expect(typeof token).toBe('string');
    expect(token.length).toBeGreaterThan(0);

    // 状态查询应报告已配置
    const status = await page.request.get('/api/settings/token');
    expect(status.ok()).toBeTruthy();
    expect(await status.json()).toMatchObject({ configured: true });

    // 撤销
    const del = await page.request.delete('/api/settings/token');
    expect(del.ok()).toBeTruthy();
    const after = await page.request.get('/api/settings/token');
    expect(await after.json()).toMatchObject({ configured: false });
  });
});
