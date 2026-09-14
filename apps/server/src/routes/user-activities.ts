// UserActivities REST routes —— 原 journeys 正名（backbone 用户活动）
// docs/design/story-map-redesign.md §3.2

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { UserActivityRepository } from '@x-cartographer/db';

const createUserActivitySchema = z.object({
  productId: z.string(),
  name: z.string(),
  description: z.string().optional(),
  order: z.number().optional(),
});

const updateUserActivitySchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  order: z.number().optional(),
});

const userActivityRepo = new UserActivityRepository();

export const userActivitiesRoutes = new Hono()
  // GET /api/user-activities?productId=
  .get('/', async (c) => {
    const productId = c.req.query('productId');
    if (!productId) return c.json({ error: 'productId required' }, 400);
    return c.json(await userActivityRepo.findByProductId(productId));
  })
  // GET /api/user-activities/:id
  .get('/:id', async (c) => {
    return c.json(await userActivityRepo.findById(c.req.param('id')));
  })
  // POST /api/user-activities
  .post('/', zValidator('json', createUserActivitySchema), async (c) => {
    const input = c.req.valid('json');
    const id = nanoid();
    await userActivityRepo.create(id, {
      product_id: input.productId,
      name: input.name,
      description: input.description,
      order: input.order,
    });
    return c.json({ success: true, id }, 201);
  })
  // PATCH /api/user-activities/:id
  .patch('/:id', zValidator('json', updateUserActivitySchema), async (c) => {
    const input = c.req.valid('json');
    await userActivityRepo.update(c.req.param('id'), input);
    return c.json({ success: true });
  })
  // DELETE /api/user-activities/:id
  .delete('/:id', async (c) => {
    await userActivityRepo.delete(c.req.param('id'));
    return c.json({ success: true });
  });
