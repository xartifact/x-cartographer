import { test, expect } from '@playwright/test';
import { uniqueProjectName } from './helpers';

/**
 * 项目概览页：标题、描述、统计卡片、导出入口
 *
 * 通过 gateway REST API 创建项目 + 旅程 + 故事 + 任务，
 * 验证概览页统计正确渲染、导出按钮可用。
 */

test.describe('项目概览', () => {
  test('概览页渲染项目信息与统计', async ({ page }) => {
    const projectName = uniqueProjectName('e2e-overview');
    const createRes = await page.request.post('/api/projects', {
      data: { name: projectName, description: '概览页 e2e 描述' },
    });
    expect(createRes.ok()).toBeTruthy();
    const { id: projectId } = await createRes.json();

    // 通过 API 创建:1 旅程 + 2 故事 + 其中 1 故事 2 任务(1 done)
    const journeyRes = await page.request.post('/api/journeys', {
      data: { projectId, name: 'E2E 旅程', description: '', persona: 'PM' },
    });
    const { id: journeyId } = await journeyRes.json();
    const s1 = await (
      await page.request.post('/api/stories', {
        data: { journeyId, title: '故事甲', priority: 'high' },
      })
    ).json();
    await page.request.post('/api/stories', {
      data: { journeyId, title: '故事乙', priority: 'medium' },
    });
    for (let i = 0; i < 2; i++) {
      await page.request.post('/api/tasks', {
        data: {
          storyId: s1.id,
          title: `任务${i + 1}`,
          description: '',
          type: 'user_story',
          priority: 'P2',
          estimation: 4,
        },
      });
    }

    await page.goto(`/projects/${projectId}`);

    // 标题与描述
    await expect(
      page.getByRole('heading', { level: 1, name: projectName }).last(),
    ).toBeVisible();
    await expect(page.getByText('概览页 e2e 描述')).toBeVisible();

    // 统计信息:1 旅程 2 故事 2 任务 0% 完成(新建任务均为 backlog)
    const statCard = page.locator('div.rounded-lg.border', { hasText: '统计信息' });
    await expect(statCard.getByText(/0%/)).toBeVisible();

    // 三个操作按钮
    await expect(
      page.getByRole('button', { name: '导出 TOML' }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: '导出 AI 上下文' }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: '导入 TOML' }),
    ).toBeVisible();

    // 清理
    await page.request.delete(`/api/projects/${projectId}`);
  });

  test('导出 AI 上下文按钮可用（触发下载）', async ({ page }) => {
    const projectName = uniqueProjectName('e2e-overview');
    const createRes = await page.request.post('/api/projects', {
      data: { name: projectName, description: '导出测试' },
    });
    expect(createRes.ok()).toBeTruthy();
    const { id: projectId } = await createRes.json();

    await page.goto(`/projects/${projectId}`);

    // 点击导出 AI 上下文,触发下载
    const downloadPromise = page.waitForEvent('download', { timeout: 10_000 });
    await page.getByRole('button', { name: '导出 AI 上下文' }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toContain('-context.md');
    const path = await download.path();
    expect(path).toBeTruthy();

    // 清理
    await page.request.delete(`/api/projects/${projectId}`);
  });
});