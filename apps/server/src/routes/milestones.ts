// Milestones REST routes
// 排期模型：里程碑/版本 CRUD + 状态流转

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { generateShortId } from '@x-cartographer/db';
import { MilestoneRepository, StatusChangeRepository } from '@x-cartographer/db';

const milestoneStatusSchema = z.enum(['planned', 'active', 'completed']);

const createMilestoneSchema = z.object({
  product_id: z.string(),
  name: z.string().min(1, '版本名称不能为空'),
  goal: z.string().optional(),
  target_date: z.string().optional(),
  status: milestoneStatusSchema.optional(),
  adr_id: z.string().nullable().optional(),
  provenance: z.enum(['human_asserted', 'agent_inferred', 'imported']).optional(),
});

const updateMilestoneSchema = z.object({
  name: z.string().min(1).optional(),
  goal: z.string().optional(),
  target_date: z.string().nullable().optional(),
  status: milestoneStatusSchema.optional(),
  adr_id: z.string().nullable().optional(),
  provenance: z.enum(['human_asserted', 'agent_inferred', 'imported']).optional(),
});

const milestoneRepo = new MilestoneRepository();
const statusChangeRepo = new StatusChangeRepository();

function toJson(m: {
  id: string;
  projectId: string;
  name: string;
  goal: string;
  targetDate: Date | null;
  status: string;
  adrId: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: m.id,
    product_id: m.projectId,
    name: m.name,
    goal: m.goal,
    target_date: m.targetDate?.toISOString(),
    status: m.status,
    adr_id: m.adrId ?? null,
    created_at: m.createdAt.toISOString(),
    updated_at: m.updatedAt.toISOString(),
  };
}

export const milestonesRoutes = new Hono()
  // GET /api/milestones?productId=
  .get('/', async (c) => {
    const productId = c.req.query('productId');
    if (!productId) return c.json({ error: 'productId required' }, 400);
    const milestones = await milestoneRepo.findByProductId(productId);
    return c.json(milestones.map(toJson));
  })
  // POST /api/milestones
  .post('/', zValidator('json', createMilestoneSchema), async (c) => {
    const input = c.req.valid('json');
    const id = await generateShortId('milestone');
    await milestoneRepo.create(id, input);
    return c.json({ success: true, id }, 201);
  })
  // PATCH /api/milestones/:id
  .patch('/:id', zValidator('json', updateMilestoneSchema), async (c) => {
    const id = c.req.param('id');
    const input = c.req.valid('json');
    // 状态流转入账本（P4：每次变更可追溯；Q2 决策——Milestone 是实体，改动必须留痕）
    let previousStatus: string | undefined;
    if (input.status !== undefined) {
      const existing = await milestoneRepo.findById(id);
      if (!existing) return c.json({ error: 'milestone not found' }, 404);
      previousStatus = existing.status;
    }
    await milestoneRepo.update(id, input);
    if (input.status !== undefined && input.status !== previousStatus) {
      await statusChangeRepo.create({
        id: '',
        entity_id: id,
        entity_type: 'milestone',
        previous_status: previousStatus ?? 'planned',
        new_status: input.status,
        reason: c.req.query('reason') ?? (input as { reason?: string }).reason,
        changed_by: 'api',
        changed_at: new Date().toISOString(),
      });
    }
    return c.json({ success: true });
  })
  // DELETE /api/milestones/:id
  .delete('/:id', async (c) => {
    await milestoneRepo.delete(c.req.param('id'));
    return c.json({ success: true });
  });
