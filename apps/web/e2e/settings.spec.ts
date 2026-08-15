import { test, expect, type Locator } from '@playwright/test';

/**
 * 设置页：LLM 配置渲染 + 保存 key 流程
 *
 * 当前应用已知 bug（迁移遗漏，由 Main 修复）：
 * 1. LLMSettings 的 ProviderCard 定义了 loadStatus 但从未通过 useEffect 调用，
 *    导致「已配置/未配置」badge 永不渲染、已保存值不回显。
 * 因此 UI 断言只覆盖确定性行为（输入 → 保存 → 输入框清空），
 * 持久化通过 gateway REST API 直接验证（不依赖 UI 回显）。
 */

/** 定位指定供应商卡片（卡片容器 class: rounded-xl border bg-card） */
function providerCard(page: import('@playwright/test').Page, name: string): Locator {
  return page
    .locator('div.rounded-xl.border.bg-card')
    .filter({ hasText: name })
    .first();
}

test.describe('设置页', () => {
  test('LLM 配置渲染', async ({ page }) => {
    await page.goto('/settings');

    await expect(page.getByRole('heading', { name: '设置' })).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'LLM 配置' }),
    ).toBeVisible();

    // 两个供应商卡片
    const openai = providerCard(page, 'OpenAI Compatible');
    await expect(openai.getByText('支持 OpenAI API 格式的服务')).toBeVisible();
    await expect(openai.getByPlaceholder('sk-...')).toBeVisible();

    const anthropic = providerCard(page, 'Anthropic Compatible');
    await expect(
      anthropic.getByText('支持 Anthropic API 格式的服务'),
    ).toBeVisible();
    await expect(anthropic.getByPlaceholder('sk-ant-...')).toBeVisible();
  });

  test('保存 API Key 流程', async ({ page }) => {
    // 先清空该 provider 的已存配置，保证测试幂等（真实 PGlite 持久化）
    await page.request.delete('/api/settings/llm/openai');
    await page.goto('/settings');

    const openai = providerCard(page, 'OpenAI Compatible');
    const keyInput = openai.getByPlaceholder('sk-...');
    const modelInput = openai.getByPlaceholder('gpt-4o');

    // 填入 key 与模型并保存
    const testKey = `sk-e2e-${Date.now()}`;
    await keyInput.fill(testKey);
    await modelInput.fill('gpt-4o-mini');
    await openai.getByRole('button', { name: '保存' }).click();

    // 保存成功后输入框清空（不再显示刚填的 key）
    await expect(keyInput).toHaveValue('');

    // 持久化验证：通过 gateway API 确认 key 已保存（绕开 UI 回显 bug）
    const statusRes = await page.request.get('/api/settings/llm/status');
    expect(statusRes.ok()).toBeTruthy();
    const status = await statusRes.json();
    expect(status.openai).toMatchObject({
      configured: true,
      model: 'gpt-4o-mini',
    });

    // 清理：删除保存的配置，避免影响后续运行
    await page.request.delete('/api/settings/llm/openai');
  });
});
