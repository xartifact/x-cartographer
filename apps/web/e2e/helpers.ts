import { expect, type Page } from '@playwright/test';

/**
 * E2E 测试共享工具
 */

/**
 * 生成唯一项目名（validator：仅字母数字空格连字符下划线）
 */
export function uniqueProjectName(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}

/**
 * 通过 UI 创建项目并返回项目名（创建成功后自动跳转项目详情页）。
 */
export async function createProjectViaUI(
  page: Page,
  name: string,
  description = 'E2E 测试项目',
): Promise<void> {
  await page.goto('/projects');
  // 项目列表页（空态或已存在项目都提供「新建项目」按钮）
  await page.getByRole('button', { name: '新建项目' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('项目名称 *').fill(name);
  await dialog.getByLabel('项目描述').fill(description);
  await dialog.getByRole('button', { name: '创建' }).click();
  // 创建成功后跳转到项目详情页（概览），等待 URL 变化
  await page.waitForURL(/\/projects\/[^/]+$/);
}

/**
 * 进入项目 story-map 页面（通过项目内导航）。
 */
export async function gotoProjectStoryMap(page: Page): Promise<void> {
  await page.getByRole('link', { name: '故事地图' }).click();
  await page.waitForURL(/\/story-map$/);
}

/**
 * 进入项目 tasks 页面（通过项目内导航）。
 */
export async function gotoProjectTasks(page: Page): Promise<void> {
  await page.getByRole('link', { name: '任务' }).click();
  await page.waitForURL(/\/tasks$/);
}

export { expect };
