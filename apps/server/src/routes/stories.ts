// Stories REST routes
// 来源: storyRouter (tRPC) → Hono

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { StoryRepository, StatusChangeRepository } from '@x-cartographer/db';
import { Priority } from '@x-cartographer/shared';

const createStorySchema = z.object({
  journeyId: z.string(),
  title: z.string(),
  description: z.string().default(''),
  priority: z.nativeEnum(Priority),
  estimation: z.number().default(0),
  acceptanceCriteria: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
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
  journeyId: z.string().optional(),
});

const updateStatusSchema = z.object({
  status: z.enum(['backlog', 'todo', 'in_progress', 'done', 'cancelled']),
  reason: z.string().optional(),
});

const storyRepo = new StoryRepository();
const statusChangeRepo = new StatusChangeRepository();

export const storiesRoutes = new Hono()
  // GET /api/stories?journeyId=
  .get('/', async (c) => {
    const journeyId = c.req.query('journeyId');
    if (!journeyId) return c.json({ error: 'journeyId required' }, 400);
    return c.json(await storyRepo.findByJourneyId(journeyId));
  })
  // GET /api/stories/:id
  .get('/:id', async (c) => {
    return c.json(await storyRepo.findById(c.req.param('id')));
  })
  // POST /api/stories
  .post('/', zValidator('json', createStorySchema), async (c) => {
    const input = c.req.valid('json');
    const id = nanoid();
    await storyRepo.create(id, {
      journey_id: input.journeyId,
      title: input.title,
      description: input.description,
      priority: input.priority,
      estimation: input.estimation,
      acceptance_criteria: input.acceptanceCriteria,
      tags: input.tags,
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
    if (input.journeyId !== undefined) dto.journeyId = input.journeyId;
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
      id: nanoid(),
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
