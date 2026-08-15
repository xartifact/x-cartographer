// Gateway REST API 集成测试（bun:test，用 app.request() 免启动服务）
//
// PGlite 隔离：
//   packages/db 的 client.ts 把 pglite 目录硬编码为 process.cwd()/data/pglite，
//   无环境变量可覆盖。因此 beforeAll 里 process.chdir() 到独立临时目录，
//   确保测试不读写（也不污染）仓库真实 data/pglite。
//   client.ts 在 ensureDb() 时才读取 process.cwd()，chdir 生效后再初始化即可。
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'bun:test';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { sql } from 'drizzle-orm';
import { ensureDb } from '@xpm/db';
import { createApp } from '../app';

// 强制走 PGlite（若环境里存在 DATABASE_URL，测试会误连 PostgreSQL）
process.env.DATABASE_URL = '';

const app = createApp();

let tmpDir: string;
let originalCwd: string;

function jsonRequest(
  method: string,
  url: string,
  body?: unknown
): Promise<Response> {
  const init: RequestInit = { method };
  if (body !== undefined) {
    init.headers = { 'Content-Type': 'application/json' };
    init.body = JSON.stringify(body);
  }
  return app.request(url, init);
}

async function createProject(
  name: string,
  extra: Record<string, unknown> = {}
): Promise<string> {
  const res = await jsonRequest('POST', '/api/projects', {
    name,
    description: `${name} description`,
    ...extra,
  });
  expect(res.status).toBe(201);
  const body = (await res.json()) as { success: boolean; id: string };
  expect(body.success).toBe(true);
  expect(body.id).toBeTruthy();
  return body.id;
}

async function createJourney(projectId: string, name: string): Promise<string> {
  const res = await jsonRequest('POST', '/api/journeys', {
    projectId,
    name,
    description: `${name} description`,
    persona: 'user',
  });
  expect(res.status).toBe(201);
  const body = (await res.json()) as { success: boolean; id: string };
  return body.id;
}

async function createStory(
  journeyId: string,
  title: string
): Promise<string> {
  const res = await jsonRequest('POST', '/api/stories', {
    journeyId,
    title,
    description: `${title} description`,
    priority: 'high',
    estimation: 3,
  });
  expect(res.status).toBe(201);
  const body = (await res.json()) as { success: boolean; id: string };
  return body.id;
}

async function createTask(
  storyId: string,
  title: string,
  dependencies: string[] = []
): Promise<string> {
  const res = await jsonRequest('POST', '/api/tasks', {
    storyId,
    title,
    description: `${title} description`,
    type: 'technical_task',
    priority: 'P2',
    estimation: 2,
    dependencies,
  });
  expect(res.status).toBe(201);
  const body = (await res.json()) as { success: boolean; id: string };
  return body.id;
}

beforeAll(async () => {
  originalCwd = process.cwd();
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'xcart-gateway-test-'));
  process.chdir(tmpDir);
  // 在临时目录里初始化 PGlite（首条 SQL 建表）
  await ensureDb();
});

afterAll(() => {
  process.chdir(originalCwd);
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

beforeEach(async () => {
  const db = await ensureDb();
  // 清空全部业务表（projects 的 FK 级联删除 journeys/stories/tasks）
  await db.execute(
    sql`TRUNCATE TABLE projects, status_changes, app_settings CASCADE`
  );
});

describe('health & metrics', () => {
  it('GET /health returns ok', async () => {
    const res = await app.request('/health');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'ok' });
  });

  it('GET /metrics returns prometheus text', async () => {
    const res = await app.request('/metrics');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/plain');
    // 默认 registry 未注册指标时 body 为空；端点可用即可
    await res.text();
  });
});

describe('projects CRUD', () => {
  it('full lifecycle: create → list → search → detail → update → delete', async () => {
    const id = await createProject('Alpha Project', {
      tech_stack: ['bun', 'hono'],
      workspace_dir: '/tmp/alpha',
    });

    // list
    let res = await app.request('/api/projects');
    expect(res.status).toBe(200);
    let body = (await res.json()) as Array<Record<string, unknown>>;
    expect(body).toHaveLength(1);
    expect(body[0].id).toBe(id);
    expect(body[0].name).toBe('Alpha Project');
    expect(body[0].user_journeys).toEqual([]);
    // create 时写入的 tech_stack 进 metadata
    expect((body[0].metadata as { tech_stack: string[] }).tech_stack).toEqual([
      'bun',
      'hono',
    ]);

    // search（大小写不敏感，name/description 均匹配）
    res = await app.request('/api/projects/search?q=alpha');
    expect(res.status).toBe(200);
    body = (await res.json()) as Array<Record<string, unknown>>;
    expect(body).toHaveLength(1);
    expect(body[0].id).toBe(id);

    res = await app.request(`/api/projects/search?q=description`);
    body = (await res.json()) as Array<Record<string, unknown>>;
    expect(body).toHaveLength(1);

    res = await app.request('/api/projects/search?q=zzz-none');
    body = (await res.json()) as Array<Record<string, unknown>>;
    expect(body).toHaveLength(0);

    // detail
    res = await app.request(`/api/projects/${id}`);
    expect(res.status).toBe(200);
    body = (await res.json()) as Array<Record<string, unknown>>;
    expect(body[0]?.id ?? (body as unknown as Record<string, unknown>).id).toBe(
      id
    );

    // update（部分字段 + settings 合并）
    res = await jsonRequest('PATCH', `/api/projects/${id}`, {
      name: 'Alpha Renamed',
      settings: { auto_save: false },
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });

    res = await app.request(`/api/projects/${id}`);
    body = (await res.json()) as Record<string, unknown>;
    expect(body.name).toBe('Alpha Renamed');
    expect(
      (body.settings as { auto_save: boolean }).auto_save
    ).toBe(false);
    // settings 合并：未传的 llm_provider 保留默认值
    expect(
      (body.settings as { llm_provider: string }).llm_provider
    ).toBe('openai');

    // delete（返回 JSON true）
    res = await app.request(`/api/projects/${id}`, { method: 'DELETE' });
    expect(res.status).toBe(200);
    expect(await res.json()).toBe(true);

    res = await app.request(`/api/projects/${id}`);
    expect(res.status).toBe(200);
    expect(await res.json()).toBeNull();
  });

  it('delete cascades to journeys/stories/tasks', async () => {
    const projectId = await createProject('Cascade');
    const journeyId = await createJourney(projectId, 'J');
    const storyId = await createStory(journeyId, 'S');
    const taskId = await createTask(storyId, 'T');

    const res = await app.request(`/api/projects/${projectId}`, {
      method: 'DELETE',
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toBe(true);

    const journeys = (await (
      await app.request(`/api/journeys?projectId=${projectId}`)
    ).json()) as unknown[];
    expect(journeys).toEqual([]);

    // stories/tasks 详情端点对不存在的行返回空 body（drizzle findFirst → undefined）
    const storyRes = await app.request(`/api/stories/${storyId}`);
    expect(storyRes.status).toBe(200);
    expect(await storyRes.text()).toBe('');

    const taskRes = await app.request(`/api/tasks/${taskId}`);
    expect(taskRes.status).toBe(200);
    expect(await taskRes.text()).toBe('');
  });
});

describe('journeys CRUD', () => {
  it('create → list by project → update → delete', async () => {
    const projectId = await createProject('Journey Project');
    const journeyId = await createJourney(projectId, 'Onboarding');

    let res = await app.request(`/api/journeys?projectId=${projectId}`);
    expect(res.status).toBe(200);
    let body = (await res.json()) as Array<Record<string, unknown>>;
    expect(body).toHaveLength(1);
    expect(body[0].id).toBe(journeyId);
    expect(body[0].projectId).toBe(projectId);
    expect(body[0].stories).toEqual([]);

    // 缺 projectId → 400
    res = await app.request('/api/journeys');
    expect(res.status).toBe(400);

    // update
    res = await jsonRequest('PATCH', `/api/journeys/${journeyId}`, {
      name: 'Onboarding v2',
      order: 5,
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });

    body = (await (
      await app.request(`/api/journeys?projectId=${projectId}`)
    ).json()) as Array<Record<string, unknown>>;
    expect(body[0].name).toBe('Onboarding v2');
    expect(body[0].order).toBe(5);

    // delete
    res = await app.request(`/api/journeys/${journeyId}`, {
      method: 'DELETE',
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });

    body = (await (
      await app.request(`/api/journeys?projectId=${projectId}`)
    ).json()) as Array<Record<string, unknown>>;
    expect(body).toHaveLength(0);
  });
});

describe('stories CRUD + status flow', () => {
  it('create → list → detail → update → status change records', async () => {
    const projectId = await createProject('Story Project');
    const journeyId = await createJourney(projectId, 'Journey A');
    const storyId = await createStory(journeyId, 'As a user I can login');

    // list by journey
    let res = await app.request(`/api/stories?journeyId=${journeyId}`);
    expect(res.status).toBe(200);
    let body = (await res.json()) as Array<Record<string, unknown>>;
    expect(body).toHaveLength(1);
    expect(body[0].id).toBe(storyId);

    // 缺 journeyId → 400
    res = await app.request('/api/stories');
    expect(res.status).toBe(400);

    // detail（原始行，camelCase）
    res = await app.request(`/api/stories/${storyId}`);
    expect(res.status).toBe(200);
    body = (await res.json()) as Array<Record<string, unknown>>;
    expect(body[0]?.id ?? (body as unknown as Record<string, unknown>).id).toBe(
      storyId
    );

    // update
    res = await jsonRequest('PATCH', `/api/stories/${storyId}`, {
      title: 'As a user I can login with SSO',
      estimation: 5,
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });

    body = (await (
      await app.request(`/api/stories/${storyId}`)
    ).json()) as Record<string, unknown>;
    expect(body.title).toBe('As a user I can login with SSO');
    expect(body.estimation).toBe(5);

    // status 流转 → 写 status_changes
    res = await jsonRequest('POST', `/api/stories/${storyId}/status`, {
      status: 'done',
      reason: 'shipped',
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });

    body = (await (
      await app.request(`/api/stories/${storyId}`)
    ).json()) as Record<string, unknown>;
    expect(body.status).toBe('done');

    // status-changes 按 entity 查询
    res = await app.request(`/api/status-changes?entityId=${storyId}`);
    expect(res.status).toBe(200);
    const changes = (await res.json()) as Array<Record<string, unknown>>;
    expect(changes).toHaveLength(1);
    expect(changes[0].entity_id).toBe(storyId);
    expect(changes[0].entity_type).toBe('story');
    expect(changes[0].previous_status).toBe('backlog');
    expect(changes[0].new_status).toBe('done');
    expect(changes[0].reason).toBe('shipped');

    // 不存在的 story 状态流转 → 404
    res = await jsonRequest('POST', '/api/stories/nope/status', {
      status: 'done',
    });
    expect(res.status).toBe(404);

    // 直接 POST /api/status-changes 手动记录
    res = await jsonRequest('POST', '/api/status-changes', {
      entityId: storyId,
      entityType: 'story',
      previousStatus: 'done',
      newStatus: 'cancelled',
      reason: 'manual',
    });
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ success: true });

    // GET /api/status-changes 全量
    res = await app.request('/api/status-changes');
    expect(res.status).toBe(200);
    const all = (await res.json()) as Array<Record<string, unknown>>;
    expect(all).toHaveLength(2);
  });
});

describe('tasks CRUD + topological next', () => {
  it('create → list → detail → update → delete', async () => {
    const projectId = await createProject('Task Project');
    const journeyId = await createJourney(projectId, 'J');
    const storyId = await createStory(journeyId, 'S');
    const taskId = await createTask(storyId, 'Implement login');

    // list by story
    let res = await app.request(`/api/tasks?storyId=${storyId}`);
    expect(res.status).toBe(200);
    let body = (await res.json()) as Array<Record<string, unknown>>;
    expect(body).toHaveLength(1);
    expect(body[0].id).toBe(taskId);
    expect(body[0].storyId).toBe(storyId);

    // 缺 storyId → 400
    res = await app.request('/api/tasks');
    expect(res.status).toBe(400);

    // detail
    res = await app.request(`/api/tasks/${taskId}`);
    expect(res.status).toBe(200);
    body = (await res.json()) as Array<Record<string, unknown>>;
    expect(body[0]?.id ?? (body as unknown as Record<string, unknown>).id).toBe(
      taskId
    );

    // update
    res = await jsonRequest('PATCH', `/api/tasks/${taskId}`, {
      title: 'Implement login v2',
      assignee: 'bob',
      estimation: 4,
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });

    body = (await (
      await app.request(`/api/tasks/${taskId}`)
    ).json()) as Record<string, unknown>;
    expect(body.title).toBe('Implement login v2');
    expect(body.assignee).toBe('bob');
    expect(body.estimation).toBe(4);

    // delete
    res = await app.request(`/api/tasks/${taskId}`, { method: 'DELETE' });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });

    // 删除后详情返回空 body
    const deleted = await app.request(`/api/tasks/${taskId}`);
    expect(deleted.status).toBe(200);
    expect(await deleted.text()).toBe('');
  });

  it('GET /api/tasks/next honors dependency completion order', async () => {
    const projectId = await createProject('Topo Project');
    const journeyId = await createJourney(projectId, 'J');
    const storyId = await createStory(journeyId, 'S');
    // A 无依赖，B 依赖 A，C 依赖 B
    const a = await createTask(storyId, 'Task A');
    const b = await createTask(storyId, 'Task B', [a]);
    const c = await createTask(storyId, 'Task C', [b]);

    const next = async (): Promise<Record<string, unknown> | null> => {
      const res = await app.request(`/api/tasks/next?projectId=${projectId}`);
      expect(res.status).toBe(200);
      return (await res.json()) as Record<string, unknown> | null;
    };
    const setStatus = async (id: string, status: string) => {
      const res = await jsonRequest('POST', `/api/tasks/${id}/status`, {
        status,
        reason: `-> ${status}`,
      });
      expect(res.status).toBe(200);
    };

    // 全部 backlog，无候选 → null
    expect(await next()).toBeNull();

    // A、B 都进 todo：A 无依赖先出队，B 被 A 阻塞
    await setStatus(a, 'todo');
    await setStatus(b, 'todo');
    expect((await next())?.id).toBe(a);

    // A 完成后 B 解除阻塞
    await setStatus(a, 'done');
    expect((await next())?.id).toBe(b);

    // C 进 todo 但 B 未完成 → 仍返回 B
    await setStatus(c, 'todo');
    expect((await next())?.id).toBe(b);

    // B 完成后 C 解除阻塞
    await setStatus(b, 'done');
    expect((await next())?.id).toBe(c);

    // C 完成后无剩余 → null
    await setStatus(c, 'done');
    expect(await next()).toBeNull();

    // 不存在的项目 → 200 + null
    const missing = await app.request('/api/tasks/next?projectId=nope');
    expect(missing.status).toBe(200);
    expect(await missing.json()).toBeNull();

    // 缺 projectId → 400
    const noParam = await app.request('/api/tasks/next');
    expect(noParam.status).toBe(400);

    // 任务状态流转记录了 status_changes（entity_type=task）
    const changes = (await (
      await app.request(`/api/status-changes?entityId=${a}`)
    ).json()) as Array<Record<string, unknown>>;
    expect(changes).toHaveLength(2);
    expect(changes[0].entity_type).toBe('task');
    expect(changes[0].new_status).toBe('done');
    expect(changes[1].new_status).toBe('todo');
  });

  it('status endpoint 404s for unknown task', async () => {
    const res = await jsonRequest('POST', '/api/tasks/nope/status', {
      status: 'done',
    });
    expect(res.status).toBe(404);
  });
});

describe('PUT /api/projects/full transaction', () => {
  it('writes the whole tree and replaces children on re-put', async () => {
    const now = new Date().toISOString();
    const projectId = 'P-FULL-001';

    const project = {
      id: projectId,
      name: 'Full Tree Project',
      description: 'written in one transaction',
      created_at: now,
      updated_at: now,
      metadata: { tech_stack: ['bun'], version: '1.0.0', tags: ['x'] },
      settings: {
        llm_provider: 'openai',
        auto_save: true,
        display_preferences: {
          show_priority_colors: true,
          show_estimation: true,
          default_view: 'map',
        },
      },
      user_journeys: [
        {
          id: 'UJ-001',
          name: 'Journey One',
          description: 'jd',
          persona: 'admin',
          project_id: projectId,
          order: 0,
          created_at: now,
          updated_at: now,
          stories: [
            {
              id: 'US-001',
              title: 'Story One',
              description: 'sd',
              priority: 'high',
              estimation: 4,
              acceptance_criteria: ['works'],
              tags: ['core'],
              journey_id: 'UJ-001',
              order: 0,
              status: 'in_progress',
              created_at: now,
              updated_at: now,
              tasks: [
                {
                  id: 'TASK-001',
                  title: 'Task One',
                  description: 'td',
                  type: 'technical_task',
                  priority: 'P1',
                  estimation: 2,
                  status: 'todo',
                  dependencies: [],
                  tags: [],
                  story_id: 'US-001',
                  created_at: now,
                  updated_at: now,
                },
              ],
            },
          ],
        },
        {
          id: 'UJ-002',
          name: 'Journey Two',
          description: 'jd2',
          persona: 'user',
          project_id: projectId,
          order: 1,
          created_at: now,
          updated_at: now,
          stories: [],
        },
      ],
    };

    let res = await jsonRequest('PUT', '/api/projects/full', { project });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });

    res = await app.request(`/api/projects/${projectId}`);
    expect(res.status).toBe(200);
    let body = (await res.json()) as Record<string, unknown> & {
      user_journeys: Array<Record<string, unknown> & { stories: unknown[] }>;
    };
    expect(body.name).toBe('Full Tree Project');
    expect(body.user_journeys).toHaveLength(2);
    const journey = body.user_journeys[0];
    expect(journey.id).toBe('UJ-001');
    const story = (journey.stories as Array<
      Record<string, unknown> & { tasks: unknown[] }
    >)[0];
    expect(story.id).toBe('US-001');
    expect(story.status).toBe('in_progress');
    const task = (story.tasks as Array<Record<string, unknown>>)[0];
    expect(task.id).toBe('TASK-001');
    expect(task.status).toBe('todo');

    // 二次 PUT 只保留 1 个 journey → 旧 journeys 级联清除
    const slim = {
      ...project,
      user_journeys: [
        { ...project.user_journeys[0], stories: [] },
      ],
    };
    res = await jsonRequest('PUT', '/api/projects/full', { project: slim });
    expect(res.status).toBe(200);

    body = (await (
      await app.request(`/api/projects/${projectId}`)
    ).json()) as Record<string, unknown> & {
      user_journeys: Array<Record<string, unknown>>;
    };
    expect(body.user_journeys).toHaveLength(1);
    expect(body.user_journeys[0].id).toBe('UJ-001');
    expect(
      (body.user_journeys[0].stories as unknown[]).length
    ).toBe(0);
  });
});

describe('settings LLM key CRUD + status', () => {
  it('CRUD provider keys and reports configuration status', async () => {
    // 初始：两个 provider 均未配置
    let res = await app.request('/api/settings/llm/status');
    expect(res.status).toBe(200);
    let status = (await res.json()) as Record<
      string,
      { configured: boolean; baseURL?: string; model?: string }
    >;
    expect(status.openai.configured).toBe(false);
    expect(status.anthropic.configured).toBe(false);

    // 未配置时 test 端点不发起真实请求，直接报错
    res = await jsonRequest('POST', '/api/settings/llm/openai/test', {});
    expect(res.status).toBe(200);
    const testBody = (await res.json()) as {
      success: boolean;
      error?: string;
    };
    expect(testBody.success).toBe(false);
    expect(testBody.error).toContain('未配置');

    // 保存 openai key + baseURL + model
    res = await jsonRequest('PUT', '/api/settings/llm/openai', {
      apiKey: 'sk-test-123',
      baseURL: 'https://example.com/v1',
      model: 'gpt-test',
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });

    status = (await (
      await app.request('/api/settings/llm/status')
    ).json()) as Record<
      string,
      { configured: boolean; baseURL?: string; model?: string }
    >;
    expect(status.openai.configured).toBe(true);
    expect(status.openai.baseURL).toBe('https://example.com/v1');
    expect(status.openai.model).toBe('gpt-test');
    // anthropic 不受影响
    expect(status.anthropic.configured).toBe(false);

    // anthropic 独立保存
    res = await jsonRequest('PUT', '/api/settings/llm/anthropic', {
      apiKey: 'sk-ant-test',
    });
    expect(res.status).toBe(200);
    status = (await (
      await app.request('/api/settings/llm/status')
    ).json()) as Record<
      string,
      { configured: boolean; baseURL?: string; model?: string }
    >;
    expect(status.anthropic.configured).toBe(true);

    // 删除 openai → baseURL/model 一并清除
    res = await app.request('/api/settings/llm/openai', {
      method: 'DELETE',
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });

    status = (await (
      await app.request('/api/settings/llm/status')
    ).json()) as Record<
      string,
      { configured: boolean; baseURL?: string; model?: string }
    >;
    expect(status.openai.configured).toBe(false);
    expect(status.openai.baseURL).toBeUndefined();
    expect(status.anthropic.configured).toBe(true);
  });

  it('PUT overwrites existing key without touching other providers', async () => {
    await jsonRequest('PUT', '/api/settings/llm/openai', {
      apiKey: 'key-1',
    });
    await jsonRequest('PUT', '/api/settings/llm/openai', {
      apiKey: 'key-2',
      model: 'm2',
    });
    await jsonRequest('PUT', '/api/settings/llm/anthropic', {
      apiKey: 'key-a',
    });

    const status = (await (
      await app.request('/api/settings/llm/status')
    ).json()) as Record<string, { configured: boolean; model?: string }>;
    expect(status.openai.configured).toBe(true);
    expect(status.openai.model).toBe('m2');
    expect(status.anthropic.configured).toBe(true);

    // 删除 anthropic，openai 仍配置
    await app.request('/api/settings/llm/anthropic', { method: 'DELETE' });
    const after = (await (
      await app.request('/api/settings/llm/status')
    ).json()) as Record<string, { configured: boolean }>;
    expect(after.anthropic.configured).toBe(false);
    expect(after.openai.configured).toBe(true);
  });
});

describe('validation failures return 400', () => {
  it('zValidator rejects invalid bodies', async () => {
    // 缺 name
    let res = await jsonRequest('POST', '/api/projects', {});
    expect(res.status).toBe(400);

    // 缺 journeyId/title/priority/estimation
    res = await jsonRequest('POST', '/api/stories', {
      title: 'no journey',
    });
    expect(res.status).toBe(400);

    // 非法 priority 枚举
    res = await jsonRequest('POST', '/api/stories', {
      journeyId: 'j',
      title: 't',
      description: 'd',
      priority: 'urgent',
      estimation: 1,
    });
    expect(res.status).toBe(400);

    // 缺 storyId/title
    res = await jsonRequest('POST', '/api/tasks', {});
    expect(res.status).toBe(400);

    // 非法 task status
    res = await jsonRequest('POST', '/api/tasks/some-id/status', {
      status: 'banana',
    });
    expect(res.status).toBe(400);

    // 非法 provider 路径参数（不在 nativeEnum 内）→ 500
    res = await jsonRequest('PUT', '/api/settings/llm/gemini', {
      apiKey: 'x',
    });
    expect(res.status).toBe(500);
  });
});
