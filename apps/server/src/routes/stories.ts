// Stories REST routes
// 来源: storyRouter (tRPC) → Hono

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { StoryRepository, StatusChangeRepository } from '@x-cartographer/db';
import { Priority } from '@x-cartographer/shared';
import { generateShortId } from '@x-cartographer/db';
import { findDanglingModuleRefs, productIdOfActivity } from '../lib/module-refs';

const createStorySchema = z.object({
  activityId: z.string(),
  title: z.string(),
  description: z.string().default(''),
  priority: z.nativeEnum(Priority),
  estimation: z.number().default(0),
  acceptanceCriteria: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
  provenance: z.enum(['human_asserted', 'agent_inferred', 'imported']).default('agent_inferred'),
});

const updateStorySchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  priority: z.nativeEnum(Priority).optional(),
  estimation: z.number().optional(),
  acceptanceCriteria: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  order: z.number().optional(),
  position: z.object({ x: z.number(), y: z.number() }).optional(),
  milestoneId: z.string().nullable().optional(),
  activityId: z.string().optional(),
  userTaskId: z.string().nullable().optional(),
  affectedModules: z.array(z.string()).optional(),
});

const updateStatusSchema = z.object({
  status: z.enum(['backlog', 'todo', 'in_progress', 'accepted', 'cancelled']),
  reason: z.string().optional(),
});

const storyRepo = new StoryRepository();
const statusChangeRepo = new StatusChangeRepository();

/**
 * 统一 REST 输出形状（snake_case）——与 products/milestones/dev-tasks 一致。
 * 此前直传 drizzle 行导致 /:id 与 / 返回**混合形状**（部分 camel 部分 snake），
 * 调用方需同时处理两种键名。
 */
function toJson(s: {
  id: string;
  activityId: string | null;
  userTaskId: string | null;
  legacyJourneyId: string | null;
  milestoneId: string | null;
  title: string;
  description: string;
  priority: string;
  estimation: number;
  acceptanceCriteria: string[] | null;
  tags: string[] | null;
  affectedModules: string[] | null;
  provenance?: string;
  status: string | null;
  position: unknown;
  order: number;
  createdAt: Date;
  updatedAt: Date;
  dev_tasks?: unknown[];
}) {
  return {
    id: s.id,
    activity_id: s.activityId,
    user_task_id: s.userTaskId,
    milestone_id: s.milestoneId,
    title: s.title,
    description: s.description,
    priority: s.priority,
    estimation: s.estimation,
    acceptance_criteria: s.acceptanceCriteria ?? [],
    tags: s.tags ?? [],
    affected_modules: s.affectedModules ?? [],
    provenance: s.provenance,
    status: s.status,
    position: s.position,
    order: s.order,
    created_at: s.createdAt.toISOString(),
    updated_at: s.updatedAt.toISOString(),
  };
}

export const storiesRoutes = new Hono()
  // GET /api/stories?activityId=
  .get('/', async (c) => {
    const activityId = c.req.query('activityId');
    if (!activityId) return c.json({ error: 'activityId required' }, 400);
    return c.json((await storyRepo.findByActivityId(activityId)).map(toJson));
  })
  // GET /api/stories/:id
  .get('/:id', async (c) => {
    const story = await storyRepo.findById(c.req.param('id'));
    return c.json(story ? toJson(story) : undefined);
  })
  // POST /api/stories
  .post('/', zValidator('json', createStorySchema), async (c) => {
    const input = c.req.valid('json');
    // 短 ID（US-001 形态）：故事地图窄列里可完整显示，且便于人工引用
    const id = await generateShortId('story');
    await storyRepo.create(id, {
      activity_id: input.activityId,
      title: input.title,
      description: input.description,
      priority: input.priority,
      estimation: input.estimation,
      acceptance_criteria: input.acceptanceCriteria,
      tags: input.tags,
      provenance: input.provenance,
    });
    return c.json({ success: true, id }, 201);
  })
  // PATCH /api/stories/:id
  .patch('/:id', zValidator('json', updateStorySchema), async (c) => {
    const input = c.req.valid('json');
    const dto: Record<string, unknown> = {};
    if (input.title !== undefined) dto.title = input.title;
    if (input.description !== undefined) dto.description = input.description;
    if (input.priority !== undefined) dto.priority = input.priority;
    if (input.estimation !== undefined) dto.estimation = input.estimation;
    if (input.acceptanceCriteria !== undefined) dto.acceptance_criteria = input.acceptanceCriteria;
    if (input.tags !== undefined) dto.tags = input.tags;
    if (input.order !== undefined) dto.order = input.order;
    if (input.position !== undefined) dto.position = input.position;
    if (input.milestoneId !== undefined) dto.milestoneId = input.milestoneId;
    if (input.activityId !== undefined) dto.activityId = input.activityId;
    if (input.userTaskId !== undefined) dto.userTaskId = input.userTaskId;
    if (input.affectedModules !== undefined) dto.affected_modules = input.affectedModules;
    // 模块引用存在性校验（告警不阻断——§3.5「纯信息，无服务端裁决」）
    let moduleWarning: string[] = [];
    if (input.affectedModules !== undefined) {
      const existing = await storyRepo.findById(c.req.param('id'));
      const activityId = input.activityId ?? (existing?.activityId as string | undefined);
      const productId = activityId ? await productIdOfActivity(activityId) : null;
      moduleWarning = await findDanglingModuleRefs(productId, input.affectedModules);
    }
    await storyRepo.update(c.req.param('id'), dto);
    return c.json({
      success: true,
      ...(moduleWarning.length ? { warnings: { unknown_modules: moduleWarning } } : {}),
    });
  })
  // DELETE /api/stories/:id
  .delete('/:id', async (c) => {
    await storyRepo.delete(c.req.param('id'));
    return c.json({ success: true });
  })
  // POST /api/stories/:id/status (状态流转 + 记录)
  .post('/:id/status', zValidator('json', updateStatusSchema), async (c) => {
    const id = c.req.param('id');
    const input = c.req.valid('json');

    const existing = await storyRepo.findById(id);
    if (!existing) {
      return c.json({ error: `Story ${id} not found` }, 404);
    }

    await statusChangeRepo.create({
      id: '',
      entity_id: id,
      entity_type: 'story',
      previous_status: existing.status ?? 'backlog',
      new_status: input.status,
      reason: input.reason,
      changed_at: new Date().toISOString(),
    });

    await storyRepo.updateStatus(id, input.status);
    return c.json({ success: true });
  });
