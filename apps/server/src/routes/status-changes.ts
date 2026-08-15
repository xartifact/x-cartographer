// Status changes REST routes
// 来源: statusRouter (tRPC) → Hono

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { StatusChangeRepository } from '@xpm/db';

const createStatusChangeSchema = z.object({
  entityId: z.string(),
  entityType: z.enum(['task', 'story']),
  previousStatus: z.string(),
  newStatus: z.string(),
  reason: z.string().optional(),
  changedBy: z.string().optional(),
});

const statusChangeRepo = new StatusChangeRepository();

export const statusChangesRoutes = new Hono()
  // GET /api/status-changes?entityId=
  .get('/', async (c) => {
    const entityId = c.req.query('entityId');
    if (entityId) return c.json(await statusChangeRepo.findByEntityId(entityId));
    return c.json(await statusChangeRepo.findAll());
  })
  // POST /api/status-changes
  .post('/', zValidator('json', createStatusChangeSchema), async (c) => {
    const input = c.req.valid('json');
    await statusChangeRepo.create({
      id: nanoid(),
      entity_id: input.entityId,
      entity_type: input.entityType,
      previous_status: input.previousStatus,
      new_status: input.newStatus,
      reason: input.reason,
      changed_by: input.changedBy,
      changed_at: new Date().toISOString(),
    });
    return c.json({ success: true }, 201);
  });
