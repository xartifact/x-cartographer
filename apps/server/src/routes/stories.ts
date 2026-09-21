// Stories REST routes
// 来源: storyRouter (tRPC) → Hono
// 约束写入协议（§4.1）：story 增删与换列改变约束语义，写入路径经分类器判定。

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { StoryRepository, StatusChangeRepository, generateShortId, createLogger } from '@x-cartographer/db';
import { Priority } from '@x-cartographer/shared';
import { findDanglingModuleRefs, productIdOfActivity } from '../lib/module-refs';
import { assessConstraintImpact } from '../lib/constraint-impact';
import { recordConstraintWrite } from '../lib/constraint-ledger';
import { validateStoryRefs } from '../lib/story-refs';

const createStorySchema = z.object({
  activityId: z.string(),
  title: z.string(),
  description: z.string().default(''),
  priority: z.nativeEnum(Priority),
  estimation: z.number().default(0),
  acceptanceCriteria: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
  affectedModules: z.array(z.string()).default([]),
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
const log = createLogger('stories');

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
      affected_modules: input.affectedModules,
      provenance: input.provenance,
    });
    // 约束写入协议（§4.1 方案 B）：创建 UserStory 是高影响写入，直接生效 + 账本留痕
    await recordConstraintWrite({
      entityType: 'story',
      entityId: id,
      action: `创建故事「${input.title}」`,
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
    // 约束影响判定（§4.1）。story 修改里只有「换列」（改 activityId）改变约束语义
    // ——「改 activity 结构」；其余可改字段（补描述 / 加标签 / 调 order / 填
    // affected_modules）属低影响明列项，故不判定（不播报正常事实，避免噪音响应）。
    if (input.activityId !== undefined) {
      const fields = ['activityId'];
      log.info('story.constraint_impact', {
        id: c.req.param('id'),
        impact: assessConstraintImpact({ entity: 'story', action: 'update', fields }),
        fields,
      });
    }
    // 跨域引用校验（§5 无悬空 + 实体均有产品作用域）：版本须同产品、步骤须同活动
    if (input.milestoneId !== undefined || input.userTaskId !== undefined || input.activityId !== undefined) {
      const violation = await validateStoryRefs(c.req.param('id'), {
        activityId: input.activityId,
        milestoneId: input.milestoneId,
        userTaskId: input.userTaskId,
      });
      if (violation) return c.json(violation, 400);
    }
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
    const id = c.req.param('id');
    const story = await storyRepo.findById(id);
    await storyRepo.delete(id);
    // 删除 UserStory 是高影响写入（§4.1）——删后实体不复存在，账本是唯一留痕
    await recordConstraintWrite({
      entityType: 'story',
      entityId: id,
      action: `删除故事「${story?.title ?? id}」`,
    });
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
