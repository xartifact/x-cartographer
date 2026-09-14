// DevTasks REST routes —— 原 tasks 正名（执行域：AI/人执行的研发任务）
// docs/design/story-map-redesign.md §3.3；type 字段已废除

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { nanoid } from 'nanoid';
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
  productId: z.string().optional(),
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
  productId: z.string().optional(),
  storyId: z.string().nullable().optional(),
});

const updateStatusSchema = z.object({
  status: z.nativeEnum(TaskStatus),
  reason: z.string().optional(),
});

const allTasksQuerySchema = z.object({
  status: z.nativeEnum(TaskStatus).optional(),
  priority: z.nativeEnum(TaskPriority).optional(),
});

const taskRepo = new DevTaskRepository();
const statusChangeRepo = new StatusChangeRepository();

export const devTasksRoutes = new Hono()
  // GET /api/dev-tasks?storyId=
  .get('/', async (c) => {
    const storyId = c.req.query('storyId');
    if (!storyId) return c.json({ error: 'storyId required' }, 400);
    return c.json(await taskRepo.findByStoryId(storyId));
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
      // 产品级任务池（story_id 为 null 的任务）
      const poolTasks = await taskRepo.findByProductId(product.id);
      for (const row of poolTasks) {
        if (status && row.status !== status) continue;
        if (priority && row.priority !== priority) continue;
        result.push({
          id: row.id,
          title: row.title,
          description: row.description,
          priority: row.priority as DevTask['priority'],
          estimation: row.estimation,
          status: row.status as DevTask['status'],
          dependencies: row.dependencies ?? [],
          story_id: row.storyId,
          product_id: row.productId ?? product.id,
          tags: row.tags ?? [],
          assignee: row.assignee ?? undefined,
          started_at: row.startedAt?.toISOString(),
          completed_at: row.completedAt?.toISOString(),
          created_at: row.createdAt.toISOString(),
          updated_at: row.updatedAt.toISOString(),
          product: { id: product.id, name: product.name },
          story: null,
        });
      }
    }
    return c.json(result);
  })

  // GET /api/dev-tasks/:id
  .get('/:id', async (c) => {
    return c.json(await taskRepo.findById(c.req.param('id')));
  })
  // POST /api/dev-tasks
  .post('/', zValidator('json', createDevTaskSchema), async (c) => {
    const input = c.req.valid('json');
    const id = nanoid();
    await taskRepo.create(id, {
      story_id: input.storyId,
      product_id: input.productId,
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
  .patch('/:id', zValidator('json', updateDevTaskSchema), async (c) => {
    const input = c.req.valid('json');
    await taskRepo.update(c.req.param('id'), input);
    return c.json({ success: true });
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

    await statusChangeRepo.create({
      id: nanoid(),
      entity_id: id,
      entity_type: 'task',
      previous_status: existing.status,
      new_status: input.status,
      reason: input.reason,
      changed_at: new Date().toISOString(),
    });

    await taskRepo.update(id, { status: input.status });

    return c.json({ success: true });
  });
