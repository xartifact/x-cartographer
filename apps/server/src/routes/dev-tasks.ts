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
import {
  TaskStatus,
  TaskPriority,
  type DevTask,
} from '@x-cartographer/shared';

const createDevTaskSchema = z.object({
  storyId: z.string().optional(),
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
  status: z.nativeEnum(TaskStatus).optional(),
  dependencies: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  assignee: z.string().optional(),
  storyId: z.string().nullable().optional(),
  affectedModules: z.array(z.string()).optional(),
});

const updateStatusSchema = z.object({
  status: z.nativeEnum(TaskStatus),
  /** 乐观锁：期望的当前状态；提供时以 CAS 原子流转，冲突返回 409 */
  expected_status: z.nativeEnum(TaskStatus).optional(),
  reason: z.string().optional(),
});

const allTasksQuerySchema = z.object({
  status: z.nativeEnum(TaskStatus).optional(),
  priority: z.nativeEnum(TaskPriority).optional(),
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
  .get('/next', async (c) => {
    const productId = c.req.query('productId');
    if (!productId) return c.json({ error: 'productId required' }, 400);
    const productRepo = getProductRepository();
    const product = await productRepo.findById(productId);
    if (!product) return c.json(null);

    const completedIds = new Set<string>();
    for (const activity of product.user_activities) {
      for (const story of activity.stories || []) {
        for (const task of story.dev_tasks || []) {
          if (task.status === TaskStatus.DONE || task.status === TaskStatus.CANCELLED) {
            completedIds.add(task.id);
          }
        }
      }
    }

    for (const activity of product.user_activities) {
      for (const story of activity.stories || []) {
        for (const task of story.dev_tasks || []) {
          if (task.status === TaskStatus.TODO) {
            const deps = task.dependencies ?? [];
            if (deps.length === 0 || deps.every((depId) => completedIds.has(depId))) {
              return c.json(task);
            }
          }
        }
      }
    }
    return c.json(null);
  })

  // GET /api/dev-tasks/all (跨产品任务聚合)
  .get('/all', zValidator('query', allTasksQuerySchema), async (c) => {
    const { status, priority } = c.req.valid('query');
    const productRepo = getProductRepository();
    const products = await productRepo.findAll();
    const result: Array<
      DevTask & { product: { id: string; name: string }; story: { id: string; title: string } | null }
    > = [];
    for (const product of products) {
      for (const activity of product.user_activities ?? []) {
        for (const story of activity.stories ?? []) {
          for (const task of story.dev_tasks ?? []) {
            if (status && task.status !== status) continue;
            if (priority && task.priority !== priority) continue;
            result.push({
              ...task,
              product: { id: product.id, name: product.name },
              story: { id: story.id, title: story.title },
            });
          }
        }
      }
    }
    return c.json(result);
  })

  // GET /api/dev-tasks/:id
  .get('/:id', async (c) => {
    const task = await taskRepo.findById(c.req.param('id'));
    // 与 stories/:id 一致：不存在时 Hono 返回空 body（c.json(undefined)）
    return c.json(task ? toJson(task) : undefined);
  })
  // POST /api/dev-tasks
  .post('/', zValidator('json', createDevTaskSchema), async (c) => {
    const input = c.req.valid('json');
    const id = await generateShortId('devTask');
    await taskRepo.create(id, {
      story_id: input.storyId,
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
    if (input.status !== undefined) dto.status = input.status;
    if (input.dependencies !== undefined) dto.dependencies = input.dependencies;
    if (input.tags !== undefined) dto.tags = input.tags;
    if (input.assignee !== undefined) dto.assignee = input.assignee;
    if (input.affectedModules !== undefined) dto.affected_modules = input.affectedModules;
    if (input.storyId !== undefined) dto.story_id = input.storyId;
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
