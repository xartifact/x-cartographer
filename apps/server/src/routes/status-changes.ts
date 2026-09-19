// Status changes REST routes
// 来源: statusRouter (tRPC) → Hono

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { StatusChangeRepository } from '@x-cartographer/db';
import { isConstraintRatified, recordConstraintRatification } from '../lib/constraint-ledger';
import type { ConstraintLedgerEntityType } from '@x-cartographer/shared';

const ratifySchema = z.object({
  entityId: z.string(),
  entityType: z.enum(['story', 'system_module', 'user_activity', 'product', 'user_task', 'milestone']),
  /** 追认理由必填——无理由的追认等于自我许可（§4.4 核心约束） */
  reason: z.string().min(1),
  changedBy: z.string().optional(),
});

const createStatusChangeSchema = z.object({
  entityId: z.string(),
  // 与 shared StatusChangeRecord['entity_type'] 一致（约束账本实体见 constraint-ledger.ts）
  entityType: z.enum([
    'task',
    'story',
    'adr',
    'milestone',
    'system_module',
    'user_activity',
    'product',
    'user_task',
  ]),
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
      id: '',
      entity_id: input.entityId,
      entity_type: input.entityType,
      previous_status: input.previousStatus,
      new_status: input.newStatus,
      reason: input.reason,
      changed_by: input.changedBy,
      changed_at: new Date().toISOString(),
    });
    return c.json({ success: true }, 201);
  })
  // POST /api/status-changes/ratify —— 约束写入的人事追认（§6.7 方案 B）
  // 幂等性弱校验：已追认则 409（重复追认是流程错误，不是新事实）
  .post('/ratify', zValidator('json', ratifySchema), async (c) => {
    const input = c.req.valid('json');
    const ratified = await isConstraintRatified(input.entityId);
    if (ratified) {
      return c.json({ error: '该实体已追认，重复追认是流程错误' }, 409);
    }
    await recordConstraintRatification({
      entityType: input.entityType,
      entityId: input.entityId,
      reason: input.reason,
      changedBy: input.changedBy,
    });
    return c.json({ success: true });
  });
