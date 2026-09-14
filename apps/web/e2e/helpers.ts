import { expect, type Page } from '@playwright/test';

/**
 * E2E 测试共享工具
 */

/**
 * 生成唯一产品名（validator：仅字母数字空格连字符下划线）
 */
export function uniqueProjectName(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}

/**
 * 通过 UI 创建产品并返回产品名（创建成功后自动跳转产品详情页）。
 */
export async function createProjectViaUI(
  page: Page,
  name: string,
  description = 'E2E 测试产品',
): Promise<void> {
  await page.goto('/projects');
  // 产品列表页（空态或已存在产品都提供「新建产品」按钮）
  await page.getByRole('button', { name: '新建产品' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('产品名称 *').fill(name);
  await dialog.getByLabel('产品描述').fill(description);
  await dialog.getByRole('button', { name: '创建' }).click();
  // 创建成功后跳转到产品详情页（概览），等待 URL 变化
  await page.waitForURL(/\/projects\/[^/]+$/);
}

/**
 * 进入产品 story-map 页面（通过产品内导航）。
 */
export async function gotoProjectStoryMap(page: Page): Promise<void> {
  await page.getByRole('link', { name: '故事地图' }).click();
  await page.waitForURL(/\/story-map$/);
}

/**
 * 进入产品 tasks 页面（通过产品内导航）。
 */
export async function gotoProjectTasks(page: Page): Promise<void> {
  await page.getByRole('link', { name: '任务' }).click();
  await page.waitForURL(/\/tasks$/);
}

export { expect };
