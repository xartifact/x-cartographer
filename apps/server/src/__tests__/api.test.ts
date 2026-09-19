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
import { ensureDb } from '@x-cartographer/db';
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
  return app.request(url, init) as Promise<Response>;
}

async function createProduct(
  name: string,
  extra: Record<string, unknown> = {}
): Promise<string> {
  const res = await jsonRequest('POST', '/api/products', {
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

async function createActivity(productId: string, name: string): Promise<string> {
  const res = await jsonRequest('POST', '/api/user-activities', {
    productId,
    name,
    description: `${name} description`,
  });
  expect(res.status).toBe(201);
  const body = (await res.json()) as { success: boolean; id: string };
  return body.id;
}

async function createStory(
  activityId: string,
  title: string
): Promise<string> {
  const res = await jsonRequest('POST', '/api/stories', {
    activityId,
    title,
    description: `${title} description`,
    priority: 'high',
    estimation: 3,
  });
  expect(res.status).toBe(201);
  const body = (await res.json()) as { success: boolean; id: string };
  return body.id;
}

async function createDevTask(
  storyId: string,
  title: string,
  dependencies: string[] = []
): Promise<string> {
  const res = await jsonRequest('POST', '/api/dev-tasks', {
    storyId,
    title,
    description: `${title} description`,
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
  // 清空全部业务表（products 的 FK 级联删除 activities/stories/dev-tasks）
  await db.execute(
    sql`TRUNCATE TABLE products, status_changes, app_settings CASCADE`
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

describe('products CRUD', () => {
  it('full lifecycle: create → list → search → detail → update → delete', async () => {
    const id = await createProduct('Alpha Project', {
      tech_stack: ['bun', 'hono'],
      workspace_dir: '/tmp/alpha',
    });

    // list
    let res = await app.request('/api/products');
    expect(res.status).toBe(200);
    let body = (await res.json()) as Array<Record<string, unknown>> &
      Record<string, unknown>;
    expect(body).toHaveLength(1);
    expect(body[0].id).toBe(id);
    expect(body[0].name).toBe('Alpha Project');
    expect(body[0].user_activities).toEqual([]);
    // create 时写入的 tech_stack 进 metadata
    expect((body[0].metadata as { tech_stack: string[] }).tech_stack).toEqual([
      'bun',
      'hono',
    ]);

    // search（大小写不敏感，name/description 均匹配）
    res = await app.request('/api/products/search?q=alpha');
    expect(res.status).toBe(200);
    body = (await res.json()) as Array<Record<string, unknown>> &
      Record<string, unknown>;
    expect(body).toHaveLength(1);
    expect(body[0].id).toBe(id);

    res = await app.request(`/api/products/search?q=description`);
    body = (await res.json()) as Array<Record<string, unknown>> &
      Record<string, unknown>;
    expect(body).toHaveLength(1);

    res = await app.request('/api/products/search?q=zzz-none');
    body = (await res.json()) as Array<Record<string, unknown>> &
      Record<string, unknown>;
    expect(body).toHaveLength(0);

    // detail
    res = await app.request(`/api/products/${id}`);
    expect(res.status).toBe(200);
    body = (await res.json()) as Array<Record<string, unknown>> &
      Record<string, unknown>;
    expect(body[0]?.id ?? (body as unknown as Record<string, unknown>).id).toBe(
      id
    );

    // update（部分字段 + settings 合并）
    res = await jsonRequest('PATCH', `/api/products/${id}`, {
      name: 'Alpha Renamed',
      settings: { auto_save: false },
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });

    res = await app.request(`/api/products/${id}`);
    body = (await res.json()) as Array<Record<string, unknown>> &
      Record<string, unknown>;
    expect(body.name).toBe('Alpha Renamed');
    expect(
      (body.settings as { auto_save: boolean }).auto_save
    ).toBe(false);

    // delete（返回 JSON true）
    res = await app.request(`/api/products/${id}`, { method: 'DELETE' });
    expect(res.status).toBe(200);
    expect(await res.json()).toBe(true);

    res = await app.request(`/api/products/${id}`);
    expect(res.status).toBe(200);
    expect(await res.json()).toBeNull();
  });

  it('delete cascades to activities/stories/dev-tasks', async () => {
    const projectId = await createProduct('Cascade');
    const activityId = await createActivity(projectId, 'J');
    const storyId = await createStory(activityId, 'S');
    const taskId = await createDevTask(storyId, 'T');

    const res = await app.request(`/api/products/${projectId}`, {
      method: 'DELETE',
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toBe(true);

    const activities = (await (
      await app.request(`/api/user-activities?productId=${projectId}`)
    ).json()) as unknown[];
    expect(activities).toEqual([]);

    // stories/tasks 详情端点对不存在的行返回空 body（drizzle findFirst → undefined）
    const storyRes = await app.request(`/api/stories/${storyId}`);
    expect(storyRes.status).toBe(200);
    expect(await storyRes.text()).toBe('');

    const taskRes = await app.request(`/api/dev-tasks/${taskId}`);
    expect(taskRes.status).toBe(200);
    expect(await taskRes.text()).toBe('');
  });
});

describe('user-activities CRUD', () => {
  it('create → list by project → update → delete', async () => {
    const projectId = await createProduct('Journey Project');
    const activityId = await createActivity(projectId, 'Onboarding');

    let res = await app.request(`/api/user-activities?productId=${projectId}`);
    expect(res.status).toBe(200);
    let body = (await res.json()) as Array<Record<string, unknown>>;
    expect(body).toHaveLength(1);
    expect(body[0].id).toBe(activityId);
    expect(body[0].product_id).toBe(projectId);
    expect(body[0].stories).toEqual([]);

    // 缺 projectId → 400
    res = await app.request('/api/user-activities');
    expect(res.status).toBe(400);

    // update
    res = await jsonRequest('PATCH', `/api/user-activities/${activityId}`, {
      name: 'Onboarding v2',
      order: 5,
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });

    body = (await (
      await app.request(`/api/user-activities?productId=${projectId}`)
    ).json()) as Array<Record<string, unknown>>;
    expect(body[0].name).toBe('Onboarding v2');
    expect(body[0].order).toBe(5);

    // delete
    res = await app.request(`/api/user-activities/${activityId}`, {
      method: 'DELETE',
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });

    body = (await (
      await app.request(`/api/user-activities?productId=${projectId}`)
    ).json()) as Array<Record<string, unknown>>;
    expect(body).toHaveLength(0);
  });
});

describe('stories CRUD + status flow', () => {
  it('create → list → detail → update → status change records', async () => {
    const projectId = await createProduct('Story Project');
    const activityId = await createActivity(projectId, 'Journey A');
    const storyId = await createStory(activityId, 'As a user I can login');

    // list by journey
    let res = await app.request(`/api/stories?activityId=${activityId}`);
    expect(res.status).toBe(200);
    let body = (await res.json()) as Array<Record<string, unknown>> &
      Record<string, unknown>;
    expect(body).toHaveLength(1);
    expect(body[0].id).toBe(storyId);

    // 缺 activityId → 400
    res = await app.request('/api/stories');
    expect(res.status).toBe(400);

    // detail（原始行，camelCase）
    res = await app.request(`/api/stories/${storyId}`);
    expect(res.status).toBe(200);
    body = (await res.json()) as Array<Record<string, unknown>> &
      Record<string, unknown>;
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
    ).json()) as Array<Record<string, unknown>> &
      Record<string, unknown>;
    expect(body.title).toBe('As a user I can login with SSO');
    expect(body.estimation).toBe(5);

    // 跨旅程迁移（PATCH activityId → activity_id 持久化）
    const journey2 = await createActivity(projectId, 'Journey B');
    res = await jsonRequest('PATCH', `/api/stories/${storyId}`, {
      activityId: journey2,
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });

    body = (await (
      await app.request(`/api/stories/${storyId}`)
    ).json()) as Array<Record<string, unknown>> &
      Record<string, unknown>;
    expect(body.activity_id).toBe(journey2);
    res = await app.request(`/api/stories?activityId=${journey2}`);
    const moved = (await res.json()) as Array<Record<string, unknown>>;
    expect(moved.some((s) => s.id === storyId)).toBe(true);
    res = await app.request(`/api/stories?activityId=${activityId}`);
    const source = (await res.json()) as Array<Record<string, unknown>>;
    expect(source.some((s) => s.id === storyId)).toBe(false);

    // status 流转 → 写 status_changes
    res = await jsonRequest('POST', `/api/stories/${storyId}/status`, {
      status: 'accepted',
      reason: 'shipped',
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });

    body = (await (
      await app.request(`/api/stories/${storyId}`)
    ).json()) as Array<Record<string, unknown>> &
      Record<string, unknown>;
    expect(body.status).toBe('accepted');

    // status-changes 按 entity 查询
    res = await app.request(`/api/status-changes?entityId=${storyId}`);
    expect(res.status).toBe(200);
    const changes = (await res.json()) as Array<Record<string, unknown>>;
    // 2 条：创建故事时的 constraint_written（§6.7 方案 B）+ 状态流转 backlog→accepted
    expect(changes).toHaveLength(2);
    const flow = changes.find((c) => c.new_status === 'accepted')!;
    expect(flow.entity_id).toBe(storyId);
    expect(flow.entity_type).toBe('story');
    expect(flow.previous_status).toBe('backlog');
    expect(flow.reason).toBe('shipped');

    // 不存在的 story 状态流转 → 404
    res = await jsonRequest('POST', '/api/stories/nope/status', {
      status: 'accepted',
    });
    expect(res.status).toBe(404);

    // 直接 POST /api/status-changes 手动记录
    res = await jsonRequest('POST', '/api/status-changes', {
      entityId: storyId,
      entityType: 'story',
      previousStatus: 'accepted',
      newStatus: 'cancelled',
      reason: 'manual',
    });
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ success: true });

    // GET /api/status-changes 全量
    res = await app.request('/api/status-changes');
    expect(res.status).toBe(200);
    const all = (await res.json()) as Array<Record<string, unknown>>;
    // ≥2：该故事的 constraint_written + 状态流转 + 手工 cancelled + 其它（各 describe
    // 的 beforeEach 清库，但同一 it 内创建 product/activity/story 也会各记一条）
    expect(all.length).toBeGreaterThanOrEqual(2);
  });
});

describe('dev-tasks CRUD + topological next', () => {
  it('create → list → detail → update → delete', async () => {
    const projectId = await createProduct('Task Project');
    const activityId = await createActivity(projectId, 'J');
    const storyId = await createStory(activityId, 'S');
    const taskId = await createDevTask(storyId, 'Implement login');

    // list by story
    let res = await app.request(`/api/dev-tasks?storyId=${storyId}`);
    expect(res.status).toBe(200);
    let body = (await res.json()) as Array<Record<string, unknown>> &
      Record<string, unknown>;
    expect(body).toHaveLength(1);
    expect(body[0].id).toBe(taskId);
    expect(body[0].story_id).toBe(storyId);

    // 缺 storyId → 400
    res = await app.request('/api/dev-tasks');
    expect(res.status).toBe(400);

    // detail
    res = await app.request(`/api/dev-tasks/${taskId}`);
    expect(res.status).toBe(200);
    body = (await res.json()) as Array<Record<string, unknown>> &
      Record<string, unknown>;
    expect(body[0]?.id ?? (body as unknown as Record<string, unknown>).id).toBe(
      taskId
    );

    // update
    res = await jsonRequest('PATCH', `/api/dev-tasks/${taskId}`, {
      title: 'Implement login v2',
      assignee: 'bob',
      estimation: 4,
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });

    body = (await (
      await app.request(`/api/dev-tasks/${taskId}`)
    ).json()) as Array<Record<string, unknown>> &
      Record<string, unknown>;
    expect(body.title).toBe('Implement login v2');
    expect(body.assignee).toBe('bob');
    expect(body.estimation).toBe(4);

    // delete
    res = await app.request(`/api/dev-tasks/${taskId}`, { method: 'DELETE' });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });

    // 删除后详情返回空 body
    const deleted = await app.request(`/api/dev-tasks/${taskId}`);
    expect(deleted.status).toBe(200);
    expect(await deleted.text()).toBe('');
  });

  it('GET /api/tasks/next honors dependency completion order', async () => {
    const projectId = await createProduct('Topo Project');
    const activityId = await createActivity(projectId, 'J');
    const storyId = await createStory(activityId, 'S');
    // A 无依赖，B 依赖 A，C 依赖 B
    const a = await createDevTask(storyId, 'Task A');
    const b = await createDevTask(storyId, 'Task B', [a]);
    const c = await createDevTask(storyId, 'Task C', [b]);

    const next = async (): Promise<Record<string, unknown> | null> => {
      const res = await app.request(`/api/dev-tasks/next?productId=${projectId}`);
      expect(res.status).toBe(200);
      return (await res.json()) as Record<string, unknown> | null;
    };
    const setStatus = async (id: string, status: string) => {
      const res = await jsonRequest('POST', `/api/dev-tasks/${id}/status`, {
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
    const missing = await app.request('/api/dev-tasks/next?productId=nope');
    expect(missing.status).toBe(200);
    expect(await missing.json()).toBeNull();

    // 缺 projectId → 400
    const noParam = await app.request('/api/dev-tasks/next');
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

  it('status endpoint 404s for unknown dev-task', async () => {
    const res = await jsonRequest('POST', '/api/dev-tasks/nope/status', {
      status: 'done',
    });
    expect(res.status).toBe(404);
  });
  it('legacy /api/tasks routes return 410 Gone', async () => {
    const res = await jsonRequest('POST', '/api/tasks/nope/status', {
      status: 'done',
    });
    expect(res.status).toBe(410);
  });
});

describe('system modules 目录 + affected_modules 校验 (0006)', () => {
  it('upsert 幂等、列表按 product 隔离、引用校验只告警不阻断', async () => {
    const productId = await createProduct('模块目录产品');
    const activityId = await createActivity(productId, '模块活动');
    const storyId = await createStory(activityId, '模块校验故事');

    // 目录初始为空
    let res = await jsonRequest('GET', `/api/system-modules?productId=${productId}`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);

    // upsert 两次（同 slug）→ 内容被整体替换，仍只有一条
    const modBody = {
      id: 'web-spa',
      product_id: productId,
      name: 'Web SPA',
      path: 'apps/web',
      responsibility: '前端应用',
      depends_on: [],
      provenance: 'human_asserted',
    };
    res = await jsonRequest('PUT', '/api/system-modules/web-spa', modBody);
    expect(res.status).toBe(200);
    res = await jsonRequest('PUT', '/api/system-modules/web-spa', modBody);
    expect(res.status).toBe(200);

    res = await jsonRequest('GET', `/api/system-modules?productId=${productId}`);
    const mods = (await res.json()) as Array<Record<string, unknown>>;
    expect(mods).toHaveLength(1);
    expect(mods[0].id).toBe('web-spa');

    // 非法 slug 被拒（id 规范例外：人可读 slug，不走短 ID 序列）
    res = await jsonRequest('PUT', '/api/system-modules/Bad_Slug', {
      ...modBody,
      id: 'Bad_Slug',
    });
    expect(res.status).toBe(400);

    // 引用存在的模块 → 无 warning
    res = await jsonRequest('PATCH', `/api/stories/${storyId}`, {
      affectedModules: ['web-spa'],
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });

    // 引用不存在的模块 → 写入成功 + 告警（§3.5 纯信息不裁决）
    res = await jsonRequest('PATCH', `/api/stories/${storyId}`, {
      affectedModules: ['web-spa', 'nope'],
    });
    expect(res.status).toBe(200);
    const warned = (await res.json()) as {
      success: boolean;
      warnings?: { unknown_modules: string[] };
    };
    expect(warned.success).toBe(true);
    expect(warned.warnings?.unknown_modules).toEqual(['nope']);

    // 值确实写入（告警不阻断）
    res = await jsonRequest('GET', `/api/stories/${storyId}`);
    const story = (await res.json()) as Record<string, unknown>;
    expect(story.affected_modules).toEqual(['web-spa', 'nope']);

    // dev-task 侧同样校验（此前 camelCase/snake_case 不匹配导致静默丢弃）
    const taskId = await createDevTask(storyId, '模块校验任务');
    res = await jsonRequest('PATCH', `/api/dev-tasks/${taskId}`, {
      affectedModules: ['web-spa'],
    });
    expect(res.status).toBe(200);
    res = await jsonRequest('GET', `/api/dev-tasks/${taskId}`);
    const task = (await res.json()) as Record<string, unknown>;
    expect(task.affected_modules).toEqual(['web-spa']);

    // 当前态宪法含模块目录（0006 起由表提供，非折叠产物）
    res = await jsonRequest('GET', `/api/adr-records/current?projectId=${productId}`);
    const constitution = (await res.json()) as { modules: Array<{ id: string }> };
    expect(constitution.modules.map((m) => m.id)).toEqual(['web-spa']);
  });

  it('0009 复合主键：同 slug 跨产品共存，detail/delete 按 (产品, slug) 定位', async () => {
    const productIdA = await createProduct('模块产品 A');
    const productIdB = await createProduct('模块产品 B');
    const modBody = (pid: string, name: string) => ({
      id: 'cli',
      product_id: pid,
      name,
      depends_on: [],
    });

    // 两个产品各写同名 cli——0009 前这会静默覆盖（模块易主），现在必须共存
    const r1 = await jsonRequest('PUT', '/api/system-modules/cli', modBody(productIdA, 'A 的 CLI'));
    expect(r1.status).toBe(200);
    const r2 = await jsonRequest('PUT', '/api/system-modules/cli', modBody(productIdB, 'B 的 CLI'));
    expect(r2.status).toBe(200);

    // 各自目录读回各自内容（曾实测：A 被 B 改写）
    const listA = (await (
      await jsonRequest('GET', `/api/system-modules?productId=${productIdA}`)
    ).json()) as Array<{ id: string; name: string }>;
    const listB = (await (
      await jsonRequest('GET', `/api/system-modules?productId=${productIdB}`)
    ).json()) as Array<{ id: string; name: string }>;
    expect(listA).toHaveLength(1);
    expect(listA[0]?.name).toBe('A 的 CLI');
    expect(listB).toHaveLength(1);
    expect(listB[0]?.name).toBe('B 的 CLI');

    // detail 需 productId：缺省 400，带上则定位到对应产品的那条
    const noCtx = await jsonRequest('GET', '/api/system-modules/cli');
    expect(noCtx.status).toBe(400);
    const dA = await jsonRequest('GET', `/api/system-modules/cli?productId=${productIdA}`);
    expect(dA.status).toBe(200);
    expect(((await dA.json()) as { name: string }).name).toBe('A 的 CLI');

    // delete 需 productId：缺省 400；带 B 的上下文只删 B 的，A 的仍在
    const delNoCtx = await jsonRequest('DELETE', '/api/system-modules/cli');
    expect(delNoCtx.status).toBe(400);
    const delB = await jsonRequest('DELETE', `/api/system-modules/cli?productId=${productIdB}`);
    expect(delB.status).toBe(200);
    const after = (await (
      await jsonRequest('GET', `/api/system-modules?productId=${productIdA}`)
    ).json()) as Array<{ id: string }>;
    expect(after).toHaveLength(1);
  });
});

describe('约束写入协议 方案 B（§6.7）：高影响写入直接生效 + 账本留痕', () => {
  it('创建故事自动记 constraint_written，ratify 后为 ratified，重复追认 409', async () => {
    const productId = await createProduct('约束账本产品');
    const activityId = await createActivity(productId, '约束账本活动');

    // 1. 创建故事（高影响）→ 直接生效 + 账本
    const res = await jsonRequest('POST', '/api/stories', {
      activityId,
      title: '账本冒烟故事',
      description: 'd',
      priority: 'high',
      estimation: 1,
    });
    expect(res.status).toBe(201);
    const { id: storyId } = (await res.json()) as { id: string };

    // 故事本身直接可查（方案 B：直接生效，不落 proposed）
    const got = await jsonRequest('GET', `/api/stories/${storyId}`);
    expect(got.status).toBe(200);

    // 账本含 constraint_written，reason 带 impact/provenance 编码
    const history = (await (
      await jsonRequest('GET', `/api/status-changes?entityId=${storyId}`)
    ).json()) as Array<{ entity_type: string; previous_status: string; new_status: string; reason?: string }>;
    const written = history.find((h) => h.new_status === 'constraint_written');
    expect(written).toBeTruthy();
    expect(written!.previous_status).toBe('(none)');
    expect(written!.entity_type).toBe('story');
    expect(written!.reason).toContain('constraint-impact:high');

    // 2. 追认（缺理由 → 400）
    const noReason = await jsonRequest('POST', '/api/status-changes/ratify', {
      entityType: 'story',
      entityId: storyId,
      reason: '',
    });
    expect(noReason.status).toBe(400);

    // 3. 正常追认
    const ratify = await jsonRequest('POST', '/api/status-changes/ratify', {
      entityType: 'story',
      entityId: storyId,
      reason: '人工核对通过',
    });
    expect(ratify.status).toBe(200);

    // 4. 重复追认 → 409
    const again = await jsonRequest('POST', '/api/status-changes/ratify', {
      entityType: 'story',
      entityId: storyId,
      reason: '再次',
    });
    expect(again.status).toBe(409);
  });

  it('模块新增/删除分别记 constraint_written', async () => {
    const productId = await createProduct('约束账本模块产品');
    const modBody = {
      id: 'ledger-mod',
      product_id: productId,
      name: '账本模块',
      depends_on: [],
    };
    const put = await jsonRequest('PUT', '/api/system-modules/ledger-mod', modBody);
    expect(put.status).toBe(200);

    const del = await jsonRequest('DELETE', `/api/system-modules/ledger-mod?productId=${productId}`);
    expect(del.status).toBe(200);

    // 幂等重放（upsert 已存在 → 更新，不应新增 constraint_written）
    const put2 = await jsonRequest('PUT', '/api/system-modules/ledger-mod', modBody);
    expect(put2.status).toBe(200);

    const history = (await (
      await jsonRequest('GET', '/api/status-changes?entityId=ledger-mod')
    ).json()) as Array<{ new_status: string; reason?: string }>;
    const writes = history.filter((h) => h.new_status === 'constraint_written');
    // 新建 1 + 删除 1 + 重建 1（删后同 slug 再 PUT 是新增，高影响应记）
    expect(writes).toHaveLength(3);
    expect(writes[0]!.reason).toContain('新增模块');
    expect(writes[1]!.reason).toContain('删除模块');
    expect(writes[2]!.reason).toContain('新增模块');
  });

  it('trace: story 入口 join 出模块/任务，无入口或缺实体返回明确错误', async () => {
    const productId = await createProduct('追溯产品');
    const activityId = await createActivity(productId, '追溯活动');
    // 模块
    const put = await jsonRequest('PUT', '/api/system-modules/trace-mod', {
      id: 'trace-mod',
      product_id: productId,
      name: '追溯模块',
      depends_on: [],
    });
    expect(put.status).toBe(200);
    // 故事 affected_modules 指向模块
    const storyRes = await jsonRequest('POST', '/api/stories', {
      activityId,
      title: '追溯故事',
      description: 'd',
      priority: 'high',
      estimation: 1,
      affectedModules: ['trace-mod'],
    });
    expect(storyRes.status).toBe(201);
    const { id: storyId } = (await storyRes.json()) as { id: string };
    // 挂 story 的任务 + 脱离 story 挂模块的任务
    const t1 = await jsonRequest('POST', '/api/dev-tasks', {
      storyId,
      title: '故事内任务',
      description: 'd',
      priority: 'P2',
      estimation: 1,
    });
    expect(t1.status).toBe(201);
    const t2 = await jsonRequest('POST', '/api/dev-tasks', {
      productId,
      moduleId: 'trace-mod',
      title: '模块锚定任务',
      description: 'd',
      priority: 'P2',
      estimation: 1,
    });
    expect(t2.status).toBe(201);
    const t2id = ((await t2.json()) as { id: string }).id;
    // story 入口：应 join 出模块 + 两类任务
    const traced = await jsonRequest('GET', `/api/trace?storyId=${storyId}`);
    expect(traced.status).toBe(200);
    const result = (await traced.json()) as {
      product_id: string;
      stories: Array<{ id: string }>;
      modules: Array<{ id: string }>;
      tasks: Array<{ id: string; story_id: string | null }>;
      adrs: Array<{ id: string }>;
    };
    expect(result.product_id).toBe(productId);
    expect(result.stories.map((s) => s.id)).toContain(storyId);
    expect(result.modules.map((m) => m.id)).toContain('trace-mod');
    const taskIds = result.tasks.map((t) => t.id);
    if (taskIds.length < 2) console.error('TRACE_DUMP', JSON.stringify({ storyId, t1: (await (await jsonRequest('GET', `/api/dev-tasks?storyId=${storyId}`)).json()), t2: await (await jsonRequest('GET', `/api/trace?moduleId=trace-mod`)).text?.() ?? '', result }));
    expect(taskIds.length).toBeGreaterThanOrEqual(2);

    // module 入口
    const byMod = await jsonRequest('GET', '/api/trace?moduleId=trace-mod');
    expect(byMod.status).toBe(200);
    const modResult = (await byMod.json()) as { tasks: Array<{ id: string }> };
    // module 入口：只收模块锚定任务（t2）；t1 挂 story 且无 affected_modules，不属本模块
    expect(modResult.tasks.map((t) => t.id)).toContain(t2id);
    // 错误：缺入口 / 多入口 / 实体不存在
    const none = await jsonRequest('GET', '/api/trace');
    expect(none.status).toBe(400);
    const both = await jsonRequest('GET', `/api/trace?storyId=${storyId}&moduleId=trace-mod`);
    expect(both.status).toBe(400);
    const miss = await jsonRequest('GET', '/api/trace?storyId=NOPE');
    expect(miss.status).toBe(400);
  });
});

describe('PUT /api/products/full transaction', () => {
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
        auto_save: true,
        display_preferences: {
          show_priority_colors: true,
          show_estimation: true,
          default_view: 'map',
        },
      },
      user_activities: [
        {
          id: 'UJ-001',
          name: 'Activity One',
          description: 'jd',
          product_id: projectId,
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
              activity_id: 'UJ-001',
              order: 0,
              status: 'in_progress',
              created_at: now,
              updated_at: now,
              dev_tasks: [
                {
                  id: 'TASK-001',
                  title: 'DevTask One',
                  description: 'td',
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
          name: 'Activity Two',
          description: 'jd2',
          product_id: projectId,
          order: 1,
          created_at: now,
          updated_at: now,
          stories: [],
        },
      ],
    };

    let res = await jsonRequest('PUT', '/api/products/full', { project });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });

    res = await app.request(`/api/products/${projectId}`);
    expect(res.status).toBe(200);
    let body = (await res.json()) as Record<string, unknown> & {
      user_activities: Array<Record<string, unknown> & { stories: unknown[] }>;
    };
    expect(body.name).toBe('Full Tree Project');
    expect(body.user_activities).toHaveLength(2);
    const journey = body.user_activities[0];
    expect(journey.id).toBe('UJ-001');
    const story = (journey.stories as Array<
      Record<string, unknown> & { tasks: unknown[] }
    >)[0];
    expect(story.id).toBe('US-001');
    expect(story.status).toBe('in_progress');
    const task = (story.dev_tasks as Array<Record<string, unknown>>)[0];
    expect(task.id).toBe('TASK-001');
    expect(task.status).toBe('todo');

    // 二次 PUT 只保留 1 个 journey → 旧 activities 级联清除
    const slim = {
      ...project,
      user_activities: [
        { ...project.user_activities[0], stories: [] },
      ],
    };
    res = await jsonRequest('PUT', '/api/products/full', { project: slim });
    expect(res.status).toBe(200);

    body = (await (
      await app.request(`/api/products/${projectId}`)
    ).json()) as Record<string, unknown> & {
      user_activities: Array<Record<string, unknown> & { stories: unknown[] }>;
    };
    expect(body.user_activities).toHaveLength(1);
    expect(body.user_activities[0].id).toBe('UJ-001');
    expect(
      (body.user_activities[0].stories as unknown[]).length
    ).toBe(0);
  });
});

describe('ADR 创建落点：高影响非人主张落 proposed (§4.1/§4.4)', () => {
  const adrBody = (productId: string, extra: Record<string, unknown> = {}) => ({
    product_id: productId,
    title: '网关不得引入 LLM 依赖',
    context: '定位为纯存储/协调层',
    decision: '禁止内置模型调用',
    ...extra,
  });

  it('agent_inferred 且不传 status → 落库 proposed', async () => {
    const productId = await createProduct('ADR 落点产品');
    const res = await jsonRequest('POST', '/api/adr-records', adrBody(productId, {
      provenance: 'agent_inferred',
    }));
    expect(res.status).toBe(201);
    const created = (await res.json()) as {
      success: boolean;
      id: string;
      status: string;
      warnings?: Record<string, unknown>;
    };
    expect(created.status).toBe('proposed');
    expect(created.warnings).toBeUndefined();

    // 落库值（不只是响应回显）
    const stored = (await (
      await app.request(`/api/adr-records/${created.id}`)
    ).json()) as Record<string, unknown>;
    expect(stored.status).toBe('proposed');
  });

  it('缺省 provenance（即 agent_inferred）同样不自动 accepted', async () => {
    const productId = await createProduct('ADR 缺省产品');
    const res = await jsonRequest('POST', '/api/adr-records', adrBody(productId));
    expect(res.status).toBe(201);
    const created = (await res.json()) as { id: string; status: string };
    expect(created.status).toBe('proposed');
  });

  it('human_asserted + accepted → 保持 accepted，无警告', async () => {
    const productId = await createProduct('ADR 人主张产品');
    const res = await jsonRequest('POST', '/api/adr-records', adrBody(productId, {
      provenance: 'human_asserted',
      status: 'accepted',
    }));
    expect(res.status).toBe(201);
    const created = (await res.json()) as {
      id: string;
      status: string;
      warnings?: Record<string, unknown>;
    };
    expect(created.status).toBe('accepted');
    expect(created.warnings).toBeUndefined();

    const stored = (await (
      await app.request(`/api/adr-records/${created.id}`)
    ).json()) as Record<string, unknown>;
    expect(stored.status).toBe('accepted');
    // §3.1「来源可见」：主张来源必须能被读回，否则无法检验落点判定是否被绕过
    expect(stored.provenance).toBe('human_asserted');
  });

  it('agent_inferred 显式 accepted → 沿用请求值并记录警告（不静默改用户意图）', async () => {
    const productId = await createProduct('ADR 绕过落点产品');
    const res = await jsonRequest('POST', '/api/adr-records', adrBody(productId, {
      provenance: 'agent_inferred',
      status: 'accepted',
    }));
    expect(res.status).toBe(201);
    const created = (await res.json()) as {
      id: string;
      status: string;
      warnings?: { status_without_human_assertion?: string };
    };
    expect(created.status).toBe('accepted');
    expect(created.warnings?.status_without_human_assertion).toBe('accepted');
  });

  it('agent_inferred 显式 proposed → 与落点一致，不报警告', async () => {
    const productId = await createProduct('ADR 一致产品');
    const res = await jsonRequest('POST', '/api/adr-records', adrBody(productId, {
      provenance: 'agent_inferred',
      status: 'proposed',
    }));
    expect(res.status).toBe(201);
    const created = (await res.json()) as {
      status: string;
      warnings?: Record<string, unknown>;
    };
    expect(created.status).toBe('proposed');
    expect(created.warnings).toBeUndefined();
  });

  it('落 proposed 的记录不进入当前态折叠（未升格即未生效）', async () => {
    const productId = await createProduct('ADR 折叠产品');
    const created = await jsonRequest('POST', '/api/adr-records', adrBody(productId, {
      provenance: 'agent_inferred',
      changes: {
        architecture_principles: {
          upsert: [{ id: 'no-llm', strength: 'MUST_NOT', statement: '网关不得引入 LLM' }],
        },
      },
    }));
    const { id: adrId } = (await created.json()) as { id: string };
    const constitution = (await (
      await app.request(`/api/adr-records/current?projectId=${productId}`)
    ).json()) as { architecture_principles: unknown[] };
    expect(constitution.architecture_principles).toEqual([]);

    // 显式升格后（须带 reason）该原则才生效
    const promote = await jsonRequest('POST', `/api/adr-records/${adrId}/status`, {
      status: 'accepted',
      reason: '人复核通过',
    });
    expect(promote.status).toBe(200);
    const after = (await (
      await app.request(`/api/adr-records/current?projectId=${productId}`)
    ).json()) as { architecture_principles: Array<{ id: string }> };
    expect(after.architecture_principles.map((p) => p.id)).toEqual(['no-llm']);
  });
});


describe('validation failures return 400', () => {
  it('zValidator rejects invalid bodies', async () => {
    // 缺 name
    let res = await jsonRequest('POST', '/api/products', {});
    expect(res.status).toBe(400);

    // 缺 activityId/title/priority/estimation
    res = await jsonRequest('POST', '/api/stories', {
      title: 'no journey',
    });
    expect(res.status).toBe(400);

    // 非法 priority 枚举
    res = await jsonRequest('POST', '/api/stories', {
      activityId: 'j',
      title: 't',
      description: 'd',
      priority: 'urgent',
      estimation: 1,
    });
    expect(res.status).toBe(400);

    // 缺 storyId/title
    res = await jsonRequest('POST', '/api/dev-tasks', {});
    expect(res.status).toBe(400);

    // 非法 task status
    res = await jsonRequest('POST', '/api/dev-tasks/some-id/status', {
      status: 'banana',
    });
    expect(res.status).toBe(400);

  });
});