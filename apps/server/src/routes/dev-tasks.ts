// DevTasks REST routes —— 原 tasks 正名（执行域：AI/人执行的研发任务）
// docs/design/story-map-redesign.md §3.3；type 字段已废除

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { generateShortId } from '@x-cartographer/db';
import { findDanglingModuleRefs, productIdOfActivity } from '../lib/module-refs';
import { StoryRepository } from '@x-cartographer/db';
import {
  DevTaskRepository,
  StatusChangeRepository,
  getProductRepository,
} from '@x-cartographer/db';
import { TaskStatus, TaskPriority } from '@x-cartographer/shared';
import { validateDependencies, dependencyViolationResponse } from '../lib/dependency-graph';

const createDevTaskSchema = z.object({
  storyId: z.string().optional(),
  /** 工程治理类工作项的产品归属（不挂 story 时必填——派生链在 story 为空时断裂） */
  productId: z.string().optional(),
  /** 模块锚定：工程治理类工作的主锚（domain-model §2.5） */
  moduleId: z.string().optional(),
  title: z.string(),
  description: z.string(),
  priority: z.nativeEnum(TaskPriority),
  estimation: z.number(),
  dependencies: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
});

const updateDevTaskSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  priority: z.nativeEnum(TaskPriority).optional(),
  estimation: z.number().optional(),
  dependencies: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  assignee: z.string().optional(),
  storyId: z.string().nullable().optional(),
  productId: z.string().optional(),
  moduleId: z.string().optional(),
  affectedModules: z.array(z.string()).optional(),
}).strict();

const updateStatusSchema = z.object({
  status: z.nativeEnum(TaskStatus),
  /** 乐观锁：期望的当前状态；提供时以 CAS 原子流转，冲突返回 409 */
  expected_status: z.nativeEnum(TaskStatus).optional(),
  reason: z.string().optional(),
});

const allTasksQuerySchema = z.object({
  status: z.nativeEnum(TaskStatus).optional(),
  priority: z.nativeEnum(TaskPriority).optional(),
  /** 按模块锚定过滤（§6.7 方案 B：工程治理任务的主锚） */
  moduleId: z.string().optional(),
  /** 按产品过滤：任务的产品归属取自带 product_id，缺失时经 story→activity 反查 */
  productId: z.string().optional(),
});

const nextQuerySchema = z.object({
  productId: z.string(),
  /** 只看指派给某人的任务；缺省不按 assignee 过滤 */
  assignee: z.string().optional(),
});


const taskRepo = new DevTaskRepository();
const storyRepo = new StoryRepository();
const statusChangeRepo = new StatusChangeRepository();

/**
 * 统一 REST 输出形状（snake_case）——与 products/milestones/stories 一致。
 * 此前 /:id 与 / 直接返回 drizzle 行（camelCase），与全站其余端点不一致；
 * 调用方（CLI/web）不得不同时处理两种键名。
 */
function toJson(t: {
  id: string;
  storyId: string | null;
  productId: string | null;
  moduleId: string | null;
  title: string;
  description: string;
  priority: string;
  estimation: number;
  status: string;
  dependencies: string[] | null;
  tags: string[] | null;
  affectedModules: string[] | null;
  assignee: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: t.id,
    story_id: t.storyId,
    product_id: t.productId,
    module_id: t.moduleId,
    title: t.title,
    description: t.description,
    priority: t.priority,
    estimation: t.estimation,
    status: t.status,
    dependencies: t.dependencies ?? [],
    tags: t.tags ?? [],
    affected_modules: t.affectedModules ?? [],
    assignee: t.assignee ?? undefined,
    started_at: t.startedAt?.toISOString(),
    completed_at: t.completedAt?.toISOString(),
    created_at: t.createdAt.toISOString(),
    updated_at: t.updatedAt.toISOString(),
  };
}

export const devTasksRoutes = new Hono()
  // GET /api/dev-tasks?storyId=
  .get('/', async (c) => {
    const storyId = c.req.query('storyId');
    if (!storyId) return c.json({ error: 'storyId required' }, 400);
    return c.json((await taskRepo.findByStoryId(storyId)).map(toJson));
  })
  // GET /api/dev-tasks/next?productId= (拓扑规则)
  //
  // 两种锚定都要参与（domain-model §2.5）：① 故事锚定（深树可达）② 模块锚定
  // （story_id=null，只能经 product_id 定位）。此前只遍历深树，模块锚定任务
  // **永远不出队**——todo 也拿不到，工程治理分支闭环断裂（生产实证 39 条）。
  //
  // 顺序：先深树（活动→故事→任务，保持既有推荐次序），再模块锚定（按创建序），
  // 保证同一状态下结果稳定可复现。
  .get('/next', zValidator('query', nextQuerySchema), async (c) => {
    const { productId, assignee } = c.req.valid('query');
    const productRepo = getProductRepository();
    const product = await productRepo.findById(productId);
    if (!product) return c.json(null);

    // 全量任务行是唯一数据源：深树看不到模块锚定任务，混用两种形状还会让
    // toJson 的入参类型对不上。深树只用来定**顺序**。
    const allTasks = await taskRepo.findAllTasks();
    const rowById = new Map(allTasks.map((t) => [t.id, t]));
    // ① 故事锚定：保持既有深树推荐次序（活动→故事→任务）
    const treeOrdered: typeof allTasks = [];
    for (const activity of product.user_activities) {
      for (const story of activity.stories || []) {
        for (const t of story.dev_tasks || []) {
          const row = rowById.get(t.id);
          if (row) treeOrdered.push(row);
        }
      }
    }
    // ② 模块锚定：不挂 story，产品归属只能靠 product_id（§2.5 恢复该列的原因），
    //    按创建序排列，保证同一状态下推荐结果稳定可复现
    const moduleAnchored = allTasks
      .filter((t) => t.storyId === null && t.productId === productId)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

    const candidates = [...treeOrdered, ...moduleAnchored];
    const completedIds = new Set(
      candidates
        .filter((t) => t.status === TaskStatus.DONE || t.status === TaskStatus.CANCELLED)
        .map((t) => t.id)
    );

    for (const task of candidates) {
      if (task.status !== TaskStatus.TODO) continue;
      if (assignee !== undefined && task.assignee !== assignee) continue;
      // 依赖判定跨两种锚定：只需被依赖任务已完成，不要求与本任务同锚定方式
      const deps = task.dependencies ?? [];
      if (deps.length === 0 || deps.every((depId) => completedIds.has(depId))) {
        return c.json(toJson(task));
      }
    }
    return c.json(null);
  })

  // GET /api/dev-tasks/all (跨产品任务聚合)
  // 以 repo 全量为权威：深树（product.user_activities.stories.dev_tasks）看不到
  // 脱离 story 的工程治理任务（§6.7 方案 B 迁锚后 story_id=null），曾致它们从
  // 本视图消失。product 优先取任务自带的 product_id，否则经 story→activity 反查。
  .get('/all', zValidator('query', allTasksQuerySchema), async (c) => {
    const { status, priority, moduleId, productId } = c.req.valid('query');
    const tasks = await taskRepo.findAllTasks();
    const products = await getProductRepository().findAll();
    const productById = new Map(products.map((p) => [p.id, p]));
    // story 上下文两张表：story 本体（标题）与 story→productId（经 activity 归属）
    const storyById = new Map<string, { id: string; title: string }>();
    const productIdByStory = new Map<string, string>();
    for (const p of products) {
      for (const a of p.user_activities ?? []) {
        for (const s of a.stories ?? []) {
          storyById.set(s.id, { id: s.id, title: s.title });
          productIdByStory.set(s.id, p.id);
        }
      }
    }
    const result: Array<
      ReturnType<typeof toJson> & {
        product: { id: string; name: string };
        story: { id: string; title: string } | null;
      }
    > = [];
    for (const t of tasks) {
      if (status && t.status !== status) continue;
      if (priority && t.priority !== priority) continue;
      if (moduleId && t.moduleId !== moduleId) continue;
      const row = toJson(t as never);
      const pid = t.productId ?? (t.storyId ? productIdByStory.get(t.storyId) : undefined) ?? '';
      // 产品过滤按**解析后**的归属判定：模块锚定任务只有 product_id，
      // 故事锚定任务可能两者皆备，故不能用 t.productId 直接比。
      if (productId && pid !== productId) continue;
      const story = t.storyId ? storyById.get(t.storyId) : undefined;
      result.push({
        ...row,
        product: { id: pid, name: productById.get(pid)?.name ?? '' },
        story: story ?? null,
      });
    }
    return c.json(result);
  })

  // GET /api/dev-tasks/:id
  .get('/:id', async (c) => {
    const task = await taskRepo.findById(c.req.param('id'));
    return c.json(task ? toJson(task) : null);
  })
  // POST /api/dev-tasks
  .post('/', zValidator('json', createDevTaskSchema), async (c) => {
    const input = c.req.valid('json');
    // 依赖图校验（§2.4 必须无环 / §5 无悬空）：新建任务尚不被依赖，无环可成，
    // 但仍须拒绝悬空引用——悬空依赖会让它永久不出队
    const violation = dependencyViolationResponse(
      await validateDependencies(null, input.dependencies)
    );
    if (violation) return c.json(violation, 400);
    const id = await generateShortId('devTask');
    await taskRepo.create(id, {
      story_id: input.storyId,
      product_id: input.productId,
      module_id: input.moduleId,
      title: input.title,
      description: input.description,
      priority: input.priority,
      estimation: input.estimation,
      dependencies: input.dependencies,
      tags: input.tags,
    });
    return c.json({ success: true, id }, 201);
  })
  // PATCH /api/dev-tasks/:id
  // 显式映射 camelCase → snake_case DTO：仓库层按 `dto.affected_modules` 等读取，
  // 直接透传 input 会让 affectedModules/productId/storyId 被静默丢弃（曾实测复现）。
  // 范式与 stories.ts 的 PATCH 一致。
  .patch('/:id', zValidator('json', updateDevTaskSchema), async (c) => {
    const input = c.req.valid('json');
    const dto: Record<string, unknown> = {};
    if (input.title !== undefined) dto.title = input.title;
    if (input.description !== undefined) dto.description = input.description;
    if (input.priority !== undefined) dto.priority = input.priority;
    if (input.estimation !== undefined) dto.estimation = input.estimation;
    if (input.dependencies !== undefined) dto.dependencies = input.dependencies;
    if (input.tags !== undefined) dto.tags = input.tags;
    if (input.assignee !== undefined) dto.assignee = input.assignee;
    if (input.affectedModules !== undefined) dto.affected_modules = input.affectedModules;
    if (input.storyId !== undefined) dto.story_id = input.storyId;
    if (input.productId !== undefined) dto.product_id = input.productId;
    if (input.moduleId !== undefined) dto.module_id = input.moduleId;
    // 依赖图校验（§2.4/§5）：悬空 → 永久阻塞；自环/成环 → 破坏 DAG
    if (input.dependencies !== undefined) {
      const violation = dependencyViolationResponse(
        await validateDependencies(c.req.param('id'), input.dependencies)
      );
      if (violation) return c.json(violation, 400);
    }
    // 模块引用存在性校验（告警不阻断；产品上下文经 story→activity 解析）
    let moduleWarning: string[] = [];
    if (input.affectedModules !== undefined) {
      const task = await taskRepo.findById(c.req.param('id'));
      const storyId = input.storyId ?? (task?.storyId as string | undefined);
      const story = storyId ? await storyRepo.findById(storyId) : undefined;
      const activityId = story?.activityId as string | undefined;
      const productId = activityId ? await productIdOfActivity(activityId) : null;
      moduleWarning = await findDanglingModuleRefs(productId, input.affectedModules);
    }
    await taskRepo.update(c.req.param('id'), dto);
    return c.json({
      success: true,
      ...(moduleWarning.length ? { warnings: { unknown_modules: moduleWarning } } : {}),
    });
  })
  // DELETE /api/dev-tasks/:id
  .delete('/:id', async (c) => {
    await taskRepo.delete(c.req.param('id'));
    return c.json({ success: true });
  })
  // POST /api/dev-tasks/:id/status (状态流转 + 账本)
  .post('/:id/status', zValidator('json', updateStatusSchema), async (c) => {
    const id = c.req.param('id');
    const input = c.req.valid('json');
    const existing = await taskRepo.findById(id);

    if (!existing) {
      return c.json({ error: `DevTask ${id} not found` }, 404);
    }
    if (input.status === 'cancelled' && !input.reason?.trim()) {
      return c.json({ error: 'Cancellation reason is required' }, 400);
    }

    // 乐观锁 CAS：条件下推 WHERE，冲突（expected_status 不匹配）返回 409
    const moved = await taskRepo.compareAndSetStatus(id, input.status, input.expected_status);
    if (!moved) {
      return c.json(
        {
          error: 'status conflict',
          detail: `expected_status=${input.expected_status} 与当前状态不一致，任务已被并发修改`,
          current_status: (await taskRepo.findById(id))?.status,
        },
        409
      );
    }

    await statusChangeRepo.create({
      id: '',
      entity_id: id,
      entity_type: 'task',
      previous_status: existing.status,
      new_status: input.status,
      reason: input.reason,
      changed_at: new Date().toISOString(),
    });

    return c.json({ success: true });
  });
