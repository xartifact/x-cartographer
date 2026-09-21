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
import { ensureDb, closeDb } from '@x-cartographer/db';
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

afterAll(async () => {
  // 必须显式关闭 PGlite：否则 worker/文件句柄无人释放，bun 测试运行器以退出码 99
  // 结束（0 失败却非 0 退出），使以退出码判定成败的 CI 步骤失败。
  await closeDb();
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

  /**
   * story create 此前不接受 userTaskId / milestoneId（schema 未声明，zod 静默剥离）：
   * 正向推演要求「先声明步骤，再往下放故事」（domain-model §8 Q3），Agent 在 create
   * 时顺带挂步骤/版本的写法会静默失效，只能再补一次 PATCH——多一次往返且容易漏，
   * 漏了就表现为「故事没排期 / 没归步骤」。
   */
  it('story create 接受 userTaskId 与 milestoneId（曾静默剥离）', async () => {
    const projectId = await createProduct('create 字段产品');
    const activityId = await createActivity(projectId, 'create 字段活动');
    await jsonRequest('POST', '/api/user-tasks', { activityId, name: '步骤' });
    const steps = (await (
      await app.request(`/api/user-tasks?activityId=${activityId}`)
    ).json()) as Array<{ id: string }>;
    const ms = await jsonRequest('POST', '/api/milestones', {
      product_id: projectId, name: 'v-create',
    });
    const { id: msId } = (await ms.json()) as { id: string };

    const res = await jsonRequest('POST', '/api/stories', {
      activityId,
      title: '一次成型',
      priority: 'medium',
      userTaskId: steps[0]!.id,
      milestoneId: msId,
    });
    expect(res.status).toBe(201);
    const { id: storyId } = (await res.json()) as { id: string };

    const story = (await (await app.request(`/api/stories/${storyId}`)).json()) as {
      user_task_id: string | null;
      milestone_id: string | null;
    };
    expect(story.user_task_id).toBe(steps[0]!.id);
    expect(story.milestone_id).toBe(msId);
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

  /**
   * domain-model §2.5：工程治理类工作（重构/技术债）走**模块锚定**——
   * story_id=null + module_id 主锚 + product_id 直连，不强行编入故事地图。
   *
   * 回归：/next 曾只遍历 product.user_activities.stories.dev_tasks 深树，
   * 深树看不到脱离 story 的任务，于是这类任务**永远不出队**（todo 也拿不到），
   * 工程治理分支闭环断裂。生产实证：PROD-007 有 39 条 story_id=null 的任务。
   */
  it('模块锚定任务（story_id=null）参与 next 拓扑推荐，且依赖判定跨两种锚定', async () => {
    const projectId = await createProduct('治理拓扑产品');
    const activityId = await createActivity(projectId, '治理活动');
    const storyId = await createStory(activityId, '治理对照故事');
    // 故事锚定的上游任务 —— 模块锚定任务依赖它，验证依赖判定不因锚定方式断裂
    const upstream = await createDevTask(storyId, '故事锚定上游');
    const gov = await jsonRequest('POST', '/api/dev-tasks', {
      productId: projectId,
      moduleId: 'gov-mod',
      title: '模块锚定任务',
      description: '工程治理类',
      priority: 'P1',
      estimation: 2,
      dependencies: [upstream],
    });
    expect(gov.status).toBe(201);
    const { id: govId } = (await gov.json()) as { id: string };

    const next = async (): Promise<Record<string, unknown> | null> => {
      const res = await app.request(`/api/dev-tasks/next?productId=${projectId}`);
      expect(res.status).toBe(200);
      return (await res.json()) as Record<string, unknown> | null;
    };

    // 上游先就绪：深树任务照常出队
    await jsonRequest('POST', `/api/dev-tasks/${upstream}/status`, { status: 'todo' });
    expect((await next())?.id).toBe(upstream);

    // 上游完成 → 模块锚定任务解除阻塞，必须成为候选（修前恒为 null）
    await jsonRequest('POST', `/api/dev-tasks/${upstream}/status`, { status: 'done' });
    await jsonRequest('POST', `/api/dev-tasks/${govId}/status`, { status: 'todo' });
    const picked = await next();
    expect(picked?.id).toBe(govId);
    expect(picked?.story_id).toBeNull();
    expect(picked?.module_id).toBe('gov-mod');
  });

  it('next 对已无候选的产品仍返回 null（模块锚定任务全部完成时）', async () => {
    const projectId = await createProduct('治理清空产品');
    const res = await jsonRequest('POST', '/api/dev-tasks', {
      productId: projectId, moduleId: 'only-mod',
      title: '唯一治理任务', description: 'd', priority: 'P2', estimation: 1,
    });
    const { id } = (await res.json()) as { id: string };
    await jsonRequest('POST', `/api/dev-tasks/${id}/status`, { status: 'todo' });
    const first = await app.request(`/api/dev-tasks/next?productId=${projectId}`);
    expect(((await first.json()) as Record<string, unknown>).id).toBe(id);

    await jsonRequest('POST', `/api/dev-tasks/${id}/status`, { status: 'done' });
    const after = await app.request(`/api/dev-tasks/next?productId=${projectId}`);
    expect(await after.json()).toBeNull();
  });

  /**
   * `--assignee` 是 CLI help 与 skill 长期宣传的 flag，但服务端从未读取它
   * （静默忽略，永不过滤）。此处钉死契约：只返回指派给该人的候选。
   */
  it('next 按 assignee 过滤：无匹配返回 null，不匹配者不出队', async () => {
    const projectId = await createProduct('assignee 产品');
    const r = await jsonRequest('POST', '/api/dev-tasks', {
      productId: projectId, moduleId: 'assignee-mod',
      title: '指派任务', description: 'd', priority: 'P2', estimation: 1,
    });
    const { id } = (await r.json()) as { id: string };
    await jsonRequest('PATCH', `/api/dev-tasks/${id}`, { assignee: 'alice' });
    await jsonRequest('POST', `/api/dev-tasks/${id}/status`, { status: 'todo' });

    const forAlice = await app.request(
      `/api/dev-tasks/next?productId=${projectId}&assignee=alice`
    );
    expect(((await forAlice.json()) as Record<string, unknown>).id).toBe(id);

    // 换个人：任务仍 todo 但不该出队
    const forBob = await app.request(
      `/api/dev-tasks/next?productId=${projectId}&assignee=bob`
    );
    expect(await forBob.json()).toBeNull();

    // 不带 filter 时忽略 assignee，照常出队
    const noFilter = await app.request(`/api/dev-tasks/next?productId=${projectId}`);
    expect(((await noFilter.json()) as Record<string, unknown>).id).toBe(id);
  });

  /**
   * domain-model §2.4「工作 → 工作：DevTask 依赖 DAG，允许，**必须无环**」
   * + §5「无悬空：引用的实体必须存在」。
   *
   * 回归：dependencies 此前无任何写入校验——悬空/自环/成环全部被接受。
   * 悬空边尤其致命：next 的 completedIds 永不含它，deps.every(completed) 恒 false，
   * 该任务**永久不出队**且无诊断（生产实测 11 条悬空边）。
   */
  describe('依赖图写入校验（悬空 / 自环 / 成环）', () => {
    it('拒绝悬空依赖：指向不存在的任务', async () => {
      const projectId = await createProduct('依赖校验产品');
      const res = await jsonRequest('POST', '/api/dev-tasks', {
        productId: projectId, moduleId: 'dep-mod',
        title: '悬空依赖任务', description: 'd', priority: 'P2', estimation: 1,
        dependencies: ['TASK-9999'],
      });
      expect(res.status).toBe(400);
      const body = (await res.json()) as { error?: string; detail?: unknown };
      expect(JSON.stringify(body)).toContain('TASK-9999');
    });

    it('拒绝自环：任务依赖自身', async () => {
      const projectId = await createProduct('自环产品');
      const created = await jsonRequest('POST', '/api/dev-tasks', {
        productId: projectId, moduleId: 'self-mod',
        title: '自环任务', description: 'd', priority: 'P2', estimation: 1,
      });
      const { id } = (await created.json()) as { id: string };
      // create 时 id 尚未生成，故自环只能经 PATCH 产生
      const patch = await jsonRequest('PATCH', `/api/dev-tasks/${id}`, {
        dependencies: [id],
      });
      expect(patch.status).toBe(400);
      expect(JSON.stringify(await patch.json())).toContain(id);
    });

    it('拒绝成环：A→B 后再写 B→A', async () => {
      const projectId = await createProduct('成环产品');
      const act = await createActivity(projectId, '成环活动');
      const story = await createStory(act, '成环故事');
      const a = await createDevTask(story, '环任务 A');
      const b = await createDevTask(story, '环任务 B', [a]);
      // B 依赖 A 合法；反向再依赖就成环
      const patch = await jsonRequest('PATCH', `/api/dev-tasks/${a}`, {
        dependencies: [b],
      });
      expect(patch.status).toBe(400);
      expect(JSON.stringify(await patch.json())).toContain(a);
    });

    it('拒绝间接成环：A→B→C 后再写 C→A', async () => {
      const projectId = await createProduct('间接成环产品');
      const act = await createActivity(projectId, '间接活动');
      const story = await createStory(act, '间接故事');
      const a = await createDevTask(story, '间接 A');
      const b = await createDevTask(story, '间接 B', [a]);
      const c = await createDevTask(story, '间接 C', [b]);
      const patch = await jsonRequest('PATCH', `/api/dev-tasks/${a}`, {
        dependencies: [c],
      });
      expect(patch.status).toBe(400);
    });

    it('合法 DAG 写入不受影响（回归）', async () => {
      const projectId = await createProduct('合法依赖产品');
      const act = await createActivity(projectId, '合法活动');
      const story = await createStory(act, '合法故事');
      const a = await createDevTask(story, '合法 A');
      const b = await createDevTask(story, '合法 B', [a]);
      const c = await createDevTask(story, '合法 C', [a, b]);
      const res = await jsonRequest('GET', `/api/dev-tasks/${c}`);
      const cTask = (await res.json()) as { dependencies: string[] };
      expect(cTask.dependencies.sort()).toEqual([a, b].sort());
    });
  });

  /**
   * `/all?productId=` 是 CLI 统计（summary/overview/context export）的数据源，
   * 产品过滤必须按**解析后**的归属判定：模块锚定任务只有 product_id，
   * 故事锚定任务经 story→activity 反查——两种都要正确归属。
   */
  it('dev-tasks/all 按产品过滤，两种锚定的归属都正确', async () => {
    type AllTaskRow = { title: string; product: { id: string } | null };
    const pidA = await createProduct('归属产品 A');
    const pidB = await createProduct('归属产品 B');
    const actA = await createActivity(pidA, 'A 活动');
    const storyA = await createStory(actA, 'A 故事');
    await createDevTask(storyA, 'A 故事锚定任务');
    await jsonRequest('POST', '/api/dev-tasks', {
      productId: pidA, moduleId: 'a-mod',
      title: 'A 模块锚定任务', description: 'd', priority: 'P2', estimation: 1,
    });
    await jsonRequest('POST', '/api/dev-tasks', {
      productId: pidB, moduleId: 'b-mod',
      title: 'B 模块锚定任务', description: 'd', priority: 'P2', estimation: 1,
    });

    const onlyA = await app.request(`/api/dev-tasks/all?productId=${pidA}`);
    const rowsA = (await onlyA.json()) as AllTaskRow[];
    expect(rowsA).toHaveLength(2);
    expect(rowsA.every((t) => t.product?.id === pidA)).toBe(true);
    expect(rowsA.map((t) => t.title).sort()).toEqual(['A 故事锚定任务', 'A 模块锚定任务']);

    const onlyB = await app.request(`/api/dev-tasks/all?productId=${pidB}`);
    const rowsB = (await onlyB.json()) as AllTaskRow[];
    expect(rowsB).toHaveLength(1);
    expect(rowsB[0]!.title).toBe('B 模块锚定任务');
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
  /**
   * dev_tasks.started_at / completed_at 只有状态流转语义上该写它，但 POST /:id/status
   * 此前从不触碰这两列（生产 593 条 / 472 done，两列皆 0 填充）；
   * 唯一写入路径 PUT /api/products/full CLI 无命令（P5：agent 唯一通道是 CLI），
   * 实际不可达——UI「完成时间」分支成为死代码。
   */
  it('状态流转维护 started_at / completed_at', async () => {
    const projectId = await createProduct('时间戳产品');
    const act = await createActivity(projectId, '时间戳活动');
    const story = await createStory(act, '时间戳故事');
    const id = await createDevTask(story, '时间戳任务');

    const read = async (): Promise<{ started_at?: string; completed_at?: string }> => {
      const res = await app.request(`/api/dev-tasks/${id}`);
      return (await res.json()) as { started_at?: string; completed_at?: string };
    };
    const move = async (status: string) => {
      const res = await jsonRequest('POST', `/api/dev-tasks/${id}/status`, {
        status,
        reason: `-> ${status}`,
      });
      expect(res.status).toBe(200);
    };

    // 新建：两列皆空（backlog 尚未开始、也未完成）
    expect((await read()).started_at).toBeUndefined();
    expect((await read()).completed_at).toBeUndefined();

    // 进入进行中 → 记开始时间
    await move('in_progress');
    const started = await read();
    expect(started.started_at).toBeTruthy();
    expect(started.completed_at).toBeUndefined();

    // 完成 → 记完成时间，开始时间保留
    await move('done');
    const done = await read();
    expect(done.completed_at).toBeTruthy();
    expect(done.started_at).toBe(started.started_at);

    // 重开 → 清完成时间（不再是"已完成"），开始时间保留（活确实开始过）
    await move('in_progress');
    const reopened = await read();
    expect(reopened.completed_at).toBeUndefined();
    expect(reopened.started_at).toBe(started.started_at);

    // 再次完成 → 重新记完成时间
    await move('done');
    expect((await read()).completed_at).toBeTruthy();

    // done → cancelled 也要清（取消后不是已完成）
    await move('cancelled');
    expect((await read()).completed_at).toBeUndefined();
  });

  it('直接 backlog→done 只记完成时间，不伪造开始时间', async () => {
    const projectId = await createProduct('直通产品');
    const act = await createActivity(projectId, '直通活动');
    const story = await createStory(act, '直通故事');
    const id = await createDevTask(story, '直通任务');

    await jsonRequest('POST', `/api/dev-tasks/${id}/status`, { status: 'done' });
    const res = await app.request(`/api/dev-tasks/${id}`);
    const t = (await res.json()) as { started_at?: string; completed_at?: string };
    expect(t.completed_at).toBeTruthy();
    // 没有证据表明"开始过"——不猜（避免把未开始的任务记成已开始）
    expect(t.started_at).toBeUndefined();
  });

  /**
   * 字段落库回归：本项目反复出现「API 接受字段但静默丢弃」——命令返回 200
   * success，调用方以为改了，实际没写。历史实例：CLI --activity / --affected-modules
   * / --assignee / --module，server 端 dev-tasks PATCH 的 affectedModules。
   *
   * 静态分析对本类缺陷误报/漏报都多（route 映射了但 repo 没写、schema 没声明但
   * update 支持），只能靠**行为验证**：写可辨识值再读回比对。
   */
  it('PATCH 的每个字段都真的落库（曾：priority 在仓库层被静默丢弃）', async () => {
    const projectId = await createProduct('字段落库产品');
    const activityId = await createActivity(projectId, '字段落库活动');
    const storyId = await createStory(activityId, '字段落库故事');
    const taskId = await createDevTask(storyId, '字段落库任务');

    const read = async (): Promise<Record<string, unknown>> =>
      (await (await app.request(`/api/dev-tasks/${taskId}`)).json()) as Record<string, unknown>;

    const before = await read();
    expect(before.priority).toBe('P2'); // createDevTask 默认

    // priority：route 有映射但 repository.update() 漏了该分支 → 此前静默不变
    let res = await jsonRequest('PATCH', `/api/dev-tasks/${taskId}`, { priority: 'P0' });
    expect(res.status).toBe(200);
    expect((await read()).priority).toBe('P0');

    // 其余字段一并钉死（同一批 if 链，改动时不易漏）
    res = await jsonRequest('PATCH', `/api/dev-tasks/${taskId}`, {
      title: '改名', description: '新描述', estimation: 13, tags: ['x'], assignee: 'bob',
      affectedModules: ['mod-x'],
    });
    expect(res.status).toBe(200);
    const after = await read();
    expect(after.title).toBe('改名');
    expect(after.description).toBe('新描述');
    expect(after.estimation).toBe(13);
    expect(after.tags).toEqual(['x']);
    expect(after.assignee).toBe('bob');
    expect(after.affected_modules).toEqual(['mod-x']);
  });
});

describe('dev-task CAS 乐观锁（task-claim-concurrency.md）', () => {
  it('CAS 乐观锁：expected_status 条件流转（task-claim-concurrency.md §2）', async () => {
    const projectId = await createProduct('CAS Project');
    const activityId = await createActivity(projectId, 'J');
    const storyId = await createStory(activityId, 'S');
    const taskId = await createDevTask(storyId, 'Claim me');

    // 1. expected_status 匹配 → 流转成功
    let res = await jsonRequest('POST', `/api/dev-tasks/${taskId}/status`, {
      status: 'todo',
      expected_status: 'backlog',
      reason: '认领（CAS 命中）',
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });

    // 2. expected_status 与当前不符 → 409 + 当前状态回显
    res = await jsonRequest('POST', `/api/dev-tasks/${taskId}/status`, {
      status: 'done',
      expected_status: 'backlog',
      reason: '过期认领（应被拒）',
    });
    expect(res.status).toBe(409);
    const conflict = (await res.json()) as { error: string; current_status: string };
    expect(conflict.error).toBe('status conflict');
    expect(conflict.current_status).toBe('todo');

    // 3. 不传 expected_status → 行为不变（无条件流转，向后兼容）
    res = await jsonRequest('POST', `/api/dev-tasks/${taskId}/status`, {
      status: 'done',
      reason: '无条件流转',
    });
    expect(res.status).toBe(200);

    // 4. 两次成功流转都留了账（CAS 命中 1 条 + 无条件 1 条；409 不留账）
    const changes = (await (
      await app.request(`/api/status-changes?entityId=${taskId}`)
    ).json()) as Array<Record<string, unknown>>;
    expect(changes).toHaveLength(2);

    // 5. 404 优先于 CAS 判定（任务不存在时不误报 409）
    res = await jsonRequest('POST', '/api/dev-tasks/nope/status', {
      status: 'done',
      expected_status: 'todo',
    });
    expect(res.status).toBe(404);
  });

  it('并发认领模拟：同一 expected_status 的两次交错流转只有一次成功', async () => {
    const projectId = await createProduct('Race Project');
    const activityId = await createActivity(projectId, 'J');
    const storyId = await createStory(activityId, 'S');
    const taskId = await createDevTask(storyId, 'Race target');

    // 两个 Agent 同时以 expected_status=backlog 认领同一任务
    const claim = () =>
      jsonRequest('POST', `/api/dev-tasks/${taskId}/status`, {
        status: 'in_progress',
        expected_status: 'backlog',
        reason: '并发认领',
      });
    const [first, second] = await Promise.all([claim(), claim()]);

    const statuses = await Promise.all([first.status, second.status]);
    expect(statuses.sort()).toEqual([200, 409]);

    // 任务状态只前进一次，账本只记一条
    const detail = (await (
      await app.request(`/api/dev-tasks/${taskId}`)
    ).json()) as { status: string };
    expect(detail.status).toBe('in_progress');
    const changes = (await (
      await app.request(`/api/status-changes?entityId=${taskId}`)
    ).json()) as Array<Record<string, unknown>>;
    expect(changes).toHaveLength(1);
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
    res = await jsonRequest('GET', `/api/adr-records/current?productId=${productId}`);
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

describe('任务上下文切片 ctx（P2：Agent 的实际输入面）', () => {
  it('挂 story 的任务：join 出意图（验收标准）+ 模块（职责/依赖）+ 上游依赖状态', async () => {
    const productId = await createProduct('ctx 产品');
    const activityId = await createActivity(productId, 'ctx 活动');
    await jsonRequest('PUT', '/api/system-modules/ctx-mod', {
      id: 'ctx-mod', product_id: productId, name: 'ctx 模块',
      responsibility: '负责一切', depends_on: [],
    });
    const sRes = await jsonRequest('POST', '/api/stories', {
      activityId, title: 'ctx 故事', description: 'd', priority: 'high', estimation: 1,
      affectedModules: ['ctx-mod'],
      acceptanceCriteria: ['标准一', '标准二'],
    });
    expect(sRes.status).toBe(201);
    const { id: storyId } = (await sRes.json()) as { id: string };
    // 上游依赖任务（done）
    const up = await jsonRequest('POST', '/api/dev-tasks', {
      storyId, title: '上游任务', description: 'd', priority: 'P2', estimation: 1,
    });
    const { id: upId } = (await up.json()) as { id: string };
    await jsonRequest('POST', `/api/dev-tasks/${upId}/status`, { status: 'done' });
    // 本任务依赖上游
    const tRes = await jsonRequest('POST', '/api/dev-tasks', {
      storyId, title: '本任务', description: '任务描述正文', priority: 'P1', estimation: 2,
      dependencies: [upId],
    });
    const { id: taskId } = (await tRes.json()) as { id: string };

    const res = await jsonRequest('GET', `/api/ctx/${taskId}`);
    expect(res.status).toBe(200);
    const ctx = (await res.json()) as {
      task: { id: string; title: string; story_id: string | null; module_id: string | null };
      story: { id: string; acceptance_criteria: string[] } | null;
      modules: Array<{ id: string; responsibility: string; depended_by: string[] }>;
      principles: Array<{ id: string }>;
      dependencies: { upstream: Array<{ id: string; done: boolean }> };
      ledger: Array<{ new_status: string }>;
    };

    expect(ctx.task.id).toBe(taskId);
    expect(ctx.task.story_id).toBe(storyId);
    // 意图：story + 验收标准
    expect(ctx.story?.id).toBe(storyId);
    expect(ctx.story?.acceptance_criteria).toEqual(['标准一', '标准二']);
    // 结构：story 的 affected_modules 跨锚进来
    expect(ctx.modules.map((m) => m.id)).toContain('ctx-mod');
    // 实现：上游依赖带完成标记
    expect(ctx.dependencies.upstream).toHaveLength(1);
    expect(ctx.dependencies.upstream[0]!.done).toBe(true);
    // 账本近况（本任务与上游的创建/流转记录）
    expect(ctx.ledger.length).toBeGreaterThanOrEqual(1);
  });

  it('治理类任务（无 story）：走模块锚定，404 与渲染路径明确', async () => {
    const productId = await createProduct('ctx 治理产品');
    const r = await jsonRequest('POST', '/api/dev-tasks', {
      productId, moduleId: 'ctx-gov',
      title: '治理任务', description: 'd', priority: 'P2', estimation: 1,
    });
    expect(r.status).toBe(201);
    await jsonRequest('PUT', '/api/system-modules/ctx-gov', {
      id: 'ctx-gov', product_id: productId, name: '治理模块', depends_on: [],
      responsibility: '治理职责',
    });

    const res = await jsonRequest('GET', '/api/ctx/ctx-gov-nonexist');
    expect(res.status).toBe(404);

    const ok = await jsonRequest('POST', '/api/dev-tasks', {
      productId, moduleId: 'ctx-gov',
      title: '治理任务2', description: 'd', priority: 'P2', estimation: 1,
    });
    const { id: tid } = (await ok.json()) as { id: string };
    const res2 = await jsonRequest('GET', `/api/ctx/${tid}`);
    expect(res2.status).toBe(200);
    const ctx = (await res2.json()) as {
      story: null;
      modules: Array<{ id: string; responsibility: string }>;
    };
    expect(ctx.story).toBeNull();
    expect(ctx.modules[0]!.responsibility).toBe('治理职责');
  });

  /**
   * §3.3 折叠只看 acceptedAt：proposed ADR 的 changes 未升格即未生效。
   *
   * 回归：ctx 曾用 foldConstitution(listByProject(...)) 裸折叠，绕过 acceptedAt 过滤，
   * 于是 proposed 的原则被当作生效约束注入——与 adr current / task info 给出相反事实
   * （生产实证 ADR-006：ctx 见 9 条，adr current 见 0 条）。
   */
  it('proposed ADR 的原则不进入 ctx（未升格即未生效），升格后才出现', async () => {
    const productId = await createProduct('ctx 宪法产品');
    const activityId = await createActivity(productId, 'ctx 宪法活动');
    const storyId = await createStory(activityId, 'ctx 宪法故事');
    const taskId = await createDevTask(storyId, 'ctx 宪法任务');
    await jsonRequest('PUT', '/api/system-modules/ctx-const', {
      id: 'ctx-const', product_id: productId, name: '宪法模块', depends_on: [],
    });
    const adrBody = (extra: Record<string, unknown> = {}) => ({
      product_id: productId,
      title: 'ctx 原则',
      context: 'c',
      decision: 'd',
      changes: {
        architecture_principles: {
          upsert: [{ id: 'ctx-rule', strength: 'MUST', statement: '尚未升格的原则' }],
        },
      },
      ...extra,
    });

    // 非人主张、未指定 status → 落 proposed：不得出现于任何读路径
    const created = await jsonRequest('POST', '/api/adr-records', adrBody());
    expect(created.status).toBe(201);
    const { id: adrId } = (await created.json()) as { id: string };

    const before = (await (await jsonRequest('GET', `/api/ctx/${taskId}`)).json()) as {
      principles: Array<{ id: string }>;
    };
    expect(before.principles.map((p) => p.id)).not.toContain('ctx-rule');

    // 显式升格（须带理由）后，同一读路径才应看到它
    const promote = await jsonRequest('POST', `/api/adr-records/${adrId}/status`, {
      status: 'accepted',
      reason: '人复核通过',
    });
    expect(promote.status).toBe(200);

    const after = (await (await jsonRequest('GET', `/api/ctx/${taskId}`)).json()) as {
      principles: Array<{ id: string; strength: string }>;
    };
    expect(after.principles.map((p) => p.id)).toContain('ctx-rule');
    // 与权威读路径（adr current）保持同一事实
    const constitution = (await (
      await jsonRequest('GET', `/api/adr-records/current?productId=${productId}`)
    ).json()) as { architecture_principles: Array<{ id: string }> };
    expect(after.principles.map((p) => p.id).sort()).toEqual(
      constitution.architecture_principles.map((p) => p.id).sort()
    );
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
      await app.request(`/api/adr-records/current?productId=${productId}`)
    ).json()) as { architecture_principles: unknown[] };
    expect(constitution.architecture_principles).toEqual([]);

    // 显式升格后（须带 reason）该原则才生效
    const promote = await jsonRequest('POST', `/api/adr-records/${adrId}/status`, {
      status: 'accepted',
      reason: '人复核通过',
    });
    expect(promote.status).toBe(200);
    const after = (await (
      await app.request(`/api/adr-records/current?productId=${productId}`)
    ).json()) as { architecture_principles: Array<{ id: string }> };
    expect(after.architecture_principles.map((p) => p.id)).toEqual(['no-llm']);
  });

  /**
   * §4.4 核心约束：「升格动作 proposed → accepted **必须带 `--reason`**」，
   * 洞察是「提议生效必须留痕且显式，无法静默自我许可」。
   *
   * 回归：transitionStatusSchema.reason 曾是 optional，可无理由升格 ADR 使其
   * changes 进入生效折叠（§3.3）且账本无理由——正是要防的自我许可。
   * 同库既有对照：status-changes/ratify 用 z.string().min(1)。
   */
  it('升格到 accepted 必须带 reason；其他流转可省', async () => {
    const productId = await createProduct('ADR 升格理由产品');
    const created = await jsonRequest('POST', '/api/adr-records', adrBody(productId, {
      changes: {
        architecture_principles: {
          upsert: [{ id: 'must-have-reason', strength: 'MUST', statement: '测试原则' }],
        },
      },
    }));
    const { id: adrId } = (await created.json()) as { id: string };

    // 无 reason 升格 → 400（此前 200，静默自我许可）
    const noReason = await jsonRequest('POST', `/api/adr-records/${adrId}/status`, {
      status: 'accepted',
    });
    expect(noReason.status).toBe(400);

    // 空字符串同样拒绝
    const emptyReason = await jsonRequest('POST', `/api/adr-records/${adrId}/status`, {
      status: 'accepted',
      reason: '',
    });
    expect(emptyReason.status).toBe(400);

    // 拒绝后该 ADR 仍未生效（不能因失败写入而部分生效）
    const constitution = (await (
      await app.request(`/api/adr-records/current?productId=${productId}`)
    ).json()) as { architecture_principles: unknown[] };
    expect(constitution.architecture_principles).toEqual([]);

    // 带 reason 才放行
    const ok = await jsonRequest('POST', `/api/adr-records/${adrId}/status`, {
      status: 'accepted',
      reason: '人复核通过',
    });
    expect(ok.status).toBe(200);

    // 账本留下该理由（§4.4「永远可查」）
    const ledger = (await (
      await app.request(`/api/status-changes?entityId=${adrId}`)
    ).json()) as Array<{ new_status: string; reason: string | null }>;
    expect(ledger.some((l) => l.new_status === 'accepted' && l.reason === '人复核通过')).toBe(true);

    // 非升格流转（deprecated）可省略 reason——不扩大约束范围
    const deprecate = await jsonRequest('POST', `/api/adr-records/${adrId}/status`, {
      status: 'deprecated',
    });
    expect(deprecate.status).toBe(200);
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

  /**
   * 引用不存在的实体 = 调用方的确定性错误，必须 4xx 且**不回吐 SQL**。
   *
   * 回归：5 个创建端点的外键违例此前一律 500，响应体是原始 SQL 语句
   * （含表名、全部列名、参数值）——既泄露 schema，又让客户端无法区分
   * 「自己传错 ID」与「服务端故障」，agent 会按可重试错误盲目重试。
   */
  it('外键违例返回 4xx 且不回吐 SQL（不泄露 schema）', async () => {
    const cases: Array<[string, Record<string, unknown>]> = [
      ['/api/dev-tasks', { storyId: 'US-9999', title: 't', description: 'd', priority: 'P2', estimation: 1 }],
      ['/api/stories', { activityId: 'UA-9999', title: 't', priority: 'medium' }],
      ['/api/user-activities', { productId: 'PROD-9999', name: 'x' }],
      ['/api/user-tasks', { activityId: 'UA-9999', name: 'x' }],
      ['/api/adr-records', { product_id: 'PROD-9999', title: 'a', context: 'c', decision: 'd' }],
    ];
    for (const [url, body] of cases) {
      const res = await jsonRequest('POST', url, body);
      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.status).toBeLessThan(500);
      const text = JSON.stringify(await res.json());
      // 不回吐 SQL 与列名
      expect(text).not.toContain('Failed query');
      expect(text).not.toContain('insert into');
      expect(text.toLowerCase()).not.toContain('dev_tasks');
      expect(text.toLowerCase()).not.toContain('user_stories');
    }
  });

  /**
   * domain-model §5「无悬空」+ 实体均有产品作用域：故事不得挂他产品的版本、
   * 不得挂他活动下的步骤。实测两者此前均 200 接受，导致排期统计跨产品混入、
   * 故事地图步骤分组自相矛盾（故事属 A 列却挂 B 列步骤，A 列步骤区为空）。
   */
  it('故事跨域引用被拒：他产品版本 / 他活动步骤', async () => {
    const pidA = await createProduct('跨域产品 A');
    const pidB = await createProduct('跨域产品 B');
    const actA = await createActivity(pidA, 'A 活动');
    const actB = await createActivity(pidB, 'B 活动');
    const storyA = await createStory(actA, 'A 故事');

    // B 产品的版本
    const ms = await jsonRequest('POST', '/api/milestones', {
      product_id: pidB, name: 'B 的版本',
    });
    const { id: msB } = (await ms.json()) as { id: string };
    const crossMs = await jsonRequest('PATCH', `/api/stories/${storyA}`, {
      milestoneId: msB,
    });
    expect(crossMs.status).toBe(400);

    // B 活动下的步骤
    await jsonRequest('POST', '/api/user-tasks', { activityId: actB, name: 'B 步骤' });
    const stepsB = (await (
      await app.request(`/api/user-tasks?activityId=${actB}`)
    ).json()) as Array<{ id: string }>;
    const crossStep = await jsonRequest('PATCH', `/api/stories/${storyA}`, {
      userTaskId: stepsB[0]!.id,
    });
    expect(crossStep.status).toBe(400);

    // 同产品版本 + 同活动步骤仍可挂（不误伤）
    const msA = await jsonRequest('POST', '/api/milestones', {
      product_id: pidA, name: 'A 的版本',
    });
    const { id: msAId } = (await msA.json()) as { id: string };
    await jsonRequest('POST', '/api/user-tasks', { activityId: actA, name: 'A 步骤' });
    const stepsA = (await (
      await app.request(`/api/user-tasks?activityId=${actA}`)
    ).json()) as Array<{ id: string }>;
    const ok = await jsonRequest('PATCH', `/api/stories/${storyA}`, {
      milestoneId: msAId,
      userTaskId: stepsA[0]!.id,
    });
    expect(ok.status).toBe(200);
  });

  /**
   * domain-model §2.4「约束 → 约束：允许，但不得成环」+ §5 无环规则。
   * 任务依赖已校验（TASK-622），模块依赖此前无校验——实测 mx→my 后再 my→mx
   * 被 200 接受，模块依赖图（dagre 分层布局）会拿到无意义的环。
   */
  it('system_modules.depends_on 拒绝成环', async () => {
    const pid = await createProduct('模块环产品');
    const put = (id: string, deps: string[]) =>
      jsonRequest('PUT', `/api/system-modules/${id}`, {
        id, product_id: pid, name: id, depends_on: deps,
      });

    expect((await put('mx', [])).status).toBe(200);
    expect((await put('my', ['mx'])).status).toBe(200);

    // my→mx 已存在，再写 mx→my 成环
    const cycle = await put('mx', ['my']);
    expect(cycle.status).toBe(400);
    expect(JSON.stringify(await cycle.json())).toContain('mx');

    // 自环
    const self = await put('mx', ['mx']);
    expect(self.status).toBe(400);

    // 悬空依赖同样拒绝（引用的模块必须存在）
    const dangling = await put('mx', ['nope']);
    expect(dangling.status).toBe(400);

    // 合法依赖不误伤：新模块依赖既有模块（不闭合环）应通过
    expect((await put('mz', ['mx'])).status).toBe(200);
  });
});

/**
 * 全字段落库审计：本项目最高频的缺陷类型是「API 接受字段但静默丢弃」——命令返回
 * 200/201 success，调用方以为写入生效，实际未落库。已发生实例（7 次）：
 *   CLI --activity / --affected-modules / --assignee / --module / --module-id、
 *   server dev-tasks PATCH affectedModules（camelCase/snake_case 不匹配）、
 *   server dev-tasks PATCH priority（route 映射了但 repo 未写）、
 *   story create 缺 userTaskId/milestoneId（schema 未声明，zod 静默剥离）。
 *
 * 为什么不能用静态分析替代：route 映射了但 repo 没写、schema 没声明但 update 支持，
 * 两种形态静态扫描都判不准（本项目实测误报率高）。故此处做**行为验证**：写可辨识
 * 值 → 读回比对。覆盖 7 类实体 × create/patch 两条写入路径。
 */
describe('字段落库审计：写入的每个字段都必须读得回来', () => {
  it('story / dev-task / milestone / module / activity / user-task / adr 全字段', async () => {
    const pid = await createProduct('落库审计产品');
    const act = await jsonRequest('POST', '/api/user-activities', {
      productId: pid, name: '审计活动', description: 'AD', order: 7,
    });
    const activityId = ((await act.json()) as { id: string }).id;
    const ut = await jsonRequest('POST', '/api/user-tasks', {
      activityId, name: '审计步骤', description: 'SD', order: 3,
    });
    const utId = (await ut.json() as { id: string }).id;
    const ms = await jsonRequest('POST', '/api/milestones', {
      product_id: pid, name: '审计版本', goal: 'GOAL', target_date: '2026-12-31', status: 'active',
    });
    const msId = (await ms.json() as { id: string }).id;
    await jsonRequest('PUT', '/api/system-modules/audit-mod', {
      id: 'audit-mod', product_id: pid, name: '审计模块', path: 'apps/audit', responsibility: 'R',
    });

    // ── story create：含归属字段（一次成型）──
    const sc = await jsonRequest('POST', '/api/stories', {
      activityId, title: 'S1', description: 'SD', priority: 'high', estimation: 5,
      acceptanceCriteria: ['AC1', 'AC2'], tags: ['t1'], affectedModules: ['audit-mod'],
      userTaskId: utId, milestoneId: msId,
    });
    expect(sc.status).toBe(201);
    const storyId = (await sc.json() as { id: string }).id;
    const s1 = (await (await app.request(`/api/stories/${storyId}`)).json()) as Record<string, unknown>;
    expect(s1.title).toBe('S1');
    expect(s1.priority).toBe('high');
    expect(s1.estimation).toBe(5);
    expect(s1.acceptance_criteria).toEqual(['AC1', 'AC2']);
    expect(s1.tags).toEqual(['t1']);
    expect(s1.affected_modules).toEqual(['audit-mod']);
    expect(s1.user_task_id).toBe(utId);
    expect(s1.milestone_id).toBe(msId);

    // ── story patch：改挂另一个版本 ──
    const ms2 = await jsonRequest('POST', '/api/milestones', { product_id: pid, name: '审计版本2' });
    const ms2Id = (await ms2.json() as { id: string }).id;
    await jsonRequest('PATCH', `/api/stories/${storyId}`, {
      title: 'S2', description: 'SD2', priority: 'low', estimation: 9,
      acceptanceCriteria: ['AC9'], tags: ['t9'], affectedModules: ['audit-mod'],
      milestoneId: ms2Id, order: 11,
    });
    const s2 = (await (await app.request(`/api/stories/${storyId}`)).json()) as Record<string, unknown>;
    expect(s2.title).toBe('S2');
    expect(s2.priority).toBe('low');
    expect(s2.estimation).toBe(9);
    expect(s2.acceptance_criteria).toEqual(['AC9']);
    expect(s2.tags).toEqual(['t9']);
    expect(s2.milestone_id).toBe(ms2Id);

    // ── dev-task create / patch（priority 曾静默丢弃）──
    const tc = await jsonRequest('POST', '/api/dev-tasks', {
      storyId, title: 'K1', description: 'KD', priority: 'P1', estimation: 7, tags: ['kt'],
    });
    const taskId = (await tc.json() as { id: string }).id;
    const t1 = (await (await app.request(`/api/dev-tasks/${taskId}`)).json()) as Record<string, unknown>;
    expect(t1.title).toBe('K1');
    expect(t1.priority).toBe('P1');
    expect(t1.estimation).toBe(7);
    expect(t1.tags).toEqual(['kt']);
    expect(t1.story_id).toBe(storyId);

    await jsonRequest('PATCH', `/api/dev-tasks/${taskId}`, {
      title: 'K2', description: 'KD2', priority: 'P0', estimation: 2,
      tags: ['kt2'], affectedModules: ['audit-mod'], assignee: 'alice',
    });
    const t2 = (await (await app.request(`/api/dev-tasks/${taskId}`)).json()) as Record<string, unknown>;
    expect(t2.title).toBe('K2');
    expect(t2.priority).toBe('P0');
    expect(t2.estimation).toBe(2);
    expect(t2.tags).toEqual(['kt2']);
    expect(t2.affected_modules).toEqual(['audit-mod']);
    expect(t2.assignee).toBe('alice');

    // ── milestone / module / activity / user-task ──
    const msRead = (await (await app.request(`/api/milestones?productId=${pid}`)).json() as Array<Record<string, unknown>>)
      .find((m) => m.id === msId)!;
    expect(msRead.goal).toBe('GOAL');
    expect(msRead.status).toBe('active');
    expect(msRead.target_date).toBeTruthy();

    const modRead = (await (await app.request(`/api/system-modules/audit-mod?productId=${pid}`)).json()) as Record<string, unknown>;
    expect(modRead.path).toBe('apps/audit');
    expect(modRead.responsibility).toBe('R');

    const actRead = (await (await app.request(`/api/user-activities?productId=${pid}`)).json() as Array<Record<string, unknown>>)
      .find((a) => a.id === activityId)!;
    expect(actRead.description).toBe('AD');
    expect(actRead.order).toBe(7);

    const adr = await jsonRequest('POST', '/api/adr-records', {
      product_id: pid, title: '审计ADR', context: 'C', decision: 'D',
      consequences: 'CONS', alternatives_considered: 'ALT', milestone_id: msId, module_ids: ['audit-mod'],
    });
    const adrId = (await adr.json() as { id: string }).id;
    const adrRead = (await (await app.request(`/api/adr-records/${adrId}`)).json()) as Record<string, unknown>;
    expect(adrRead.title).toBe('审计ADR');
    expect(adrRead.context).toBe('C');
    expect(adrRead.decision).toBe('D');
    expect(adrRead.consequences).toBe('CONS');
    expect(adrRead.alternatives_considered).toBe('ALT');
    expect(adrRead.milestone_id).toBe(msId);
    expect(adrRead.module_ids).toEqual(['audit-mod']);
  });
});