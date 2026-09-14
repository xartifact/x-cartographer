// UserTasks REST routes —— 活动下的用户操作步骤（地图元素）
// docs/design/story-map-redesign.md §3.2

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { ensureDb } from '@x-cartographer/db';
import { userTasks, userActivities } from '@x-cartographer/db';
import { eq, asc } from 'drizzle-orm';

const createUserTaskSchema = z.object({
  activityId: z.string(),
  name: z.string(),
  description: z.string().optional(),
  order: z.number().optional(),
});

const updateUserTaskSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  order: z.number().optional(),
  activityId: z.string().optional(),
});

export const userTasksRoutes = new Hono()
  // GET /api/user-tasks?activityId= 或 ?productId=（二选一）
  .get('/', async (c) => {
    const activityId = c.req.query('activityId');
    const productId = c.req.query('productId');
    if (!activityId && !productId) {
      return c.json({ error: 'activityId or productId required' }, 400);
    }
    const db = await ensureDb();
    const rows = activityId
      ? await db
          .select()
          .from(userTasks)
          .where(eq(userTasks.activityId, activityId))
          .orderBy(asc(userTasks.order))
      : await db
          .select({
            id: userTasks.id,
            activityId: userTasks.activityId,
            name: userTasks.name,
            description: userTasks.description,
            order: userTasks.order,
            createdAt: userTasks.createdAt,
            updatedAt: userTasks.updatedAt,
          })
          .from(userTasks)
          .innerJoin(userActivities, eq(userTasks.activityId, userActivities.id))
          .where(eq(userActivities.productId, productId!))
          .orderBy(asc(userActivities.order), asc(userTasks.order));
    return c.json(
      rows.map((row) => ({
        id: row.id,
        activity_id: row.activityId,
        name: row.name,
        description: row.description,
        order: row.order,
        created_at: row.createdAt.toISOString(),
        updated_at: row.updatedAt.toISOString(),
      }))
    );
  })
  // POST /api/user-tasks
  .post('/', zValidator('json', createUserTaskSchema), async (c) => {
    const input = c.req.valid('json');
    const id = nanoid();
    const db = await ensureDb();
    const now = new Date();
    await db.insert(userTasks).values({
      id,
      activityId: input.activityId,
      name: input.name,
      description: input.description ?? '',
      order: input.order ?? 0,
      createdAt: now,
      updatedAt: now,
    });
    return c.json({ success: true, id }, 201);
  })
  // PATCH /api/user-tasks/:id
  .patch('/:id', zValidator('json', updateUserTaskSchema), async (c) => {
    const input = c.req.valid('json');
    const db = await ensureDb();
    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (input.name !== undefined) updateData.name = input.name;
    if (input.description !== undefined) updateData.description = input.description;
    if (input.order !== undefined) updateData.order = input.order;
    if (input.activityId !== undefined) updateData.activityId = input.activityId;
    await db.update(userTasks).set(updateData).where(eq(userTasks.id, c.req.param('id')));
    return c.json({ success: true });
  })
  // DELETE /api/user-tasks/:id
  .delete('/:id', async (c) => {
    const db = await ensureDb();
    await db.delete(userTasks).where(eq(userTasks.id, c.req.param('id')));
    return c.json({ success: true });
  });
