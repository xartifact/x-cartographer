// Journeys REST routes
// 来源: journeyRouter (tRPC) → Hono

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { JourneyRepository } from '@xpm/db';

const createJourneySchema = z.object({
  projectId: z.string(),
  name: z.string(),
  description: z.string(),
  persona: z.string(),
});

const updateJourneySchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  persona: z.string().optional(),
  order: z.number().optional(),
});

const journeyRepo = new JourneyRepository();

export const journeysRoutes = new Hono()
  // GET /api/journeys?projectId=
  .get('/', async (c) => {
    const projectId = c.req.query('projectId');
    if (!projectId) return c.json({ error: 'projectId required' }, 400);
    return c.json(await journeyRepo.findByProjectId(projectId));
  })
  // POST /api/journeys
  .post('/', zValidator('json', createJourneySchema), async (c) => {
    const input = c.req.valid('json');
    const id = nanoid();
    await journeyRepo.create(id, {
      project_id: input.projectId,
      name: input.name,
      description: input.description,
      persona: input.persona,
    });
    return c.json({ success: true, id }, 201);
  })
  // PATCH /api/journeys/:id
  .patch('/:id', zValidator('json', updateJourneySchema), async (c) => {
    const input = c.req.valid('json');
    await journeyRepo.update(c.req.param('id'), input);
    return c.json({ success: true });
  })
  // DELETE /api/journeys/:id
  .delete('/:id', async (c) => {
    await journeyRepo.delete(c.req.param('id'));
    return c.json({ success: true });
  });
