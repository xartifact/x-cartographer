// Stories REST routes
// 来源: storyRouter (tRPC) → Hono

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { StoryRepository, StatusChangeRepository } from '@x-cartographer/db';
import { Priority } from '@x-cartographer/shared';
import { generateShortId } from '@x-cartographer/db';

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

export const storiesRoutes = new Hono()
  // GET /api/stories?activityId=
  .get('/', async (c) => {
    const activityId = c.req.query('activityId');
    if (!activityId) return c.json({ error: 'activityId required' }, 400);
    return c.json(await storyRepo.findByActivityId(activityId));
  })
  // GET /api/stories/:id
  .get('/:id', async (c) => {
    return c.json(await storyRepo.findById(c.req.param('id')));
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
    await storyRepo.update(c.req.param('id'), dto);
    return c.json({ success: true });
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
