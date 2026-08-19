// Milestones REST routes
// 排期模型：里程碑/版本 CRUD + 状态流转

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { MilestoneRepository } from '@x-cartographer/db';

const milestoneStatusSchema = z.enum(['planned', 'active', 'completed']);

const createMilestoneSchema = z.object({
  project_id: z.string(),
  name: z.string().min(1, '版本名称不能为空'),
  goal: z.string().optional(),
  target_date: z.string().optional(),
  status: milestoneStatusSchema.optional(),
});

const updateMilestoneSchema = z.object({
  name: z.string().min(1).optional(),
  goal: z.string().optional(),
  target_date: z.string().nullable().optional(),
  status: milestoneStatusSchema.optional(),
});

const milestoneRepo = new MilestoneRepository();

function toJson(m: {
  id: string;
  projectId: string;
  name: string;
  goal: string;
  targetDate: Date | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: m.id,
    project_id: m.projectId,
    name: m.name,
    goal: m.goal,
    target_date: m.targetDate?.toISOString(),
    status: m.status,
    created_at: m.createdAt.toISOString(),
    updated_at: m.updatedAt.toISOString(),
  };
}

export const milestonesRoutes = new Hono()
  // GET /api/milestones?projectId=
  .get('/', async (c) => {
    const projectId = c.req.query('projectId');
    if (!projectId) return c.json({ error: 'projectId required' }, 400);
    const milestones = await milestoneRepo.findByProjectId(projectId);
    return c.json(milestones.map(toJson));
  })
  // POST /api/milestones
  .post('/', zValidator('json', createMilestoneSchema), async (c) => {
    const input = c.req.valid('json');
    const id = nanoid();
    await milestoneRepo.create(id, input);
    return c.json({ success: true, id }, 201);
  })
  // PATCH /api/milestones/:id
  .patch('/:id', zValidator('json', updateMilestoneSchema), async (c) => {
    const input = c.req.valid('json');
    await milestoneRepo.update(c.req.param('id'), input);
    return c.json({ success: true });
  })
  // DELETE /api/milestones/:id
  .delete('/:id', async (c) => {
    await milestoneRepo.delete(c.req.param('id'));
    return c.json({ success: true });
  });
