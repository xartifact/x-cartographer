import { test, expect } from '@playwright/test';
import { uniqueProjectName } from './helpers';

/**
 * 排期规划（Roadmap）：版本创建、故事排期、AI 建议入口
 *
 * - 版本创建依赖 Dialog（DIALOG_BUG_FIXED=true 已启用）
 * - 项目/版本数据通过 gateway REST API 直接创建，聚焦 Roadmap 页自身行为
 */

test.describe('排期规划', () => {
  test('Roadmap 页渲染:版本体系入口与待规划池', async ({ page }) => {
    const projectName = uniqueProjectName('e2e-roadmap');
    const createRes = await page.request.post('/api/projects', {
      data: { name: projectName },
    });
    expect(createRes.ok()).toBeTruthy();
    const { id: projectId } = await createRes.json();

    await page.goto(`/projects/${projectId}/roadmap`);

    // 页面标题与副标题
    await expect(
      page.getByRole('heading', { name: '排期规划' }),
    ).toBeVisible();
    await expect(
      page.getByText('按版本组织交付计划，未排期故事进入待规划池'),
    ).toBeVisible();

    // 核心按钮:AI 排期建议 + 新建版本
    await expect(
      page.getByRole('button', { name: 'AI 排期建议' }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: '新建版本' }),
    ).toBeVisible();

    // 待规划池(空态)
    await expect(page.getByText('待规划池', { exact: true })).toBeVisible();

    // 清理
    await page.request.delete(`/api/projects/${projectId}`);
  });

  test('创建版本后泳道出现', async ({ page }) => {
    const projectName = uniqueProjectName('e2e-roadmap');
    const createRes = await page.request.post('/api/projects', {
      data: { name: projectName },
    });
    expect(createRes.ok()).toBeTruthy();
    const { id: projectId } = await createRes.json();

    await page.goto(`/projects/${projectId}/roadmap`);

    // 打开新建版本对话框
    await page.getByRole('button', { name: '新建版本' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    const versionName = `版本 ${Date.now()}`;
    await dialog.getByLabel('版本名称').fill(versionName);
    await dialog.getByLabel('版本目标').fill('E2E 测试版本目标');
    await dialog.getByRole('button', { name: '保存' }).click();

    // 泳道中出现版本(版本名在泳道卡片内)
    await expect(page.getByText(versionName)).toBeVisible();

    // 清理
    await page.request.delete(`/api/projects/${projectId}`);
  });

  test('未排期故事进入待规划池且可排入版本', async ({ page }) => {
    const projectName = uniqueProjectName('e2e-roadmap');
    const createRes = await page.request.post('/api/projects', {
      data: { name: projectName },
    });
    expect(createRes.ok()).toBeTruthy();
    const { id: projectId } = await createRes.json();

    // 通过 API 创建:旅程 + 故事 + 版本
    const journeyRes = await page.request.post('/api/journeys', {
      data: { projectId, name: 'E2E 旅程', description: '', persona: 'PM' },
    });
    const { id: journeyId } = await journeyRes.json();
    await page.request.post('/api/stories', {
      data: {
        journeyId,
        title: 'E2E 待排期故事',
        description: '',
        priority: 'high',
      },
    });
    const milestoneRes = await page.request.post('/api/milestones', {
      data: { project_id: projectId, name: 'v2.0', goal: 'e2e' },
    });
    const { id: milestoneId } = await milestoneRes.json();

    await page.goto(`/projects/${projectId}/roadmap`);

    // 待规划池显示未排期故事
    await expect(page.getByText('E2E 待排期故事')).toBeVisible();

    // 通过 API 把故事排入版本
    const projectRes = await page.request.get(`/api/projects/${projectId}`);
    const project = await projectRes.json();
    const storyId = project.user_journeys[0].stories[0].id;
    const patchRes = await page.request.patch(`/api/stories/${storyId}`, {
      data: { milestoneId },
    });
    expect(patchRes.ok()).toBeTruthy();

    // 刷新页面后故事进入 v2.0 泳道
    await page.reload();
    await expect(page.getByText('v2.0')).toBeVisible();
    await expect(page.getByText('E2E 待排期故事')).toBeVisible();

    // 清理
    await page.request.delete(`/api/projects/${projectId}`);
  });
});