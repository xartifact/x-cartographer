// AdrRecords REST routes —— 技术宪法账本（ADR，append-only）
// docs/design/technical-constitution.md §3；镜像 milestones.ts 的 zod+Hono 写法。

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { AdrRepository } from '@x-cartographer/db';

const adrStatusSchema = z.enum(['proposed', 'accepted', 'superseded', 'deprecated']);

/** changes 结构校验（§3.2）：按类分组（tech_stack/architecture_principles/modules），各类内 upsert/remove 的 id 集合不得相交 */
/** 单类变更集校验：upsert/remove 的 id 集合不得相交（§3.2） */
const noOverlap = (ups: Array<{ id: string }>, rems: string[]) => {
  const ids = new Set(ups.map((u) => u.id));
  return !rems.some((rm) => ids.has(rm));
};

const techStackEntry = z.object({ id: z.string().min(1), layer: z.string(), choice: z.string(), version: z.string().optional(), rationale: z.string().optional() });
const principleEntry = z.object({ id: z.string().min(1), strength: z.enum(['MUST', 'SHOULD', 'MAY', 'MUST_NOT']), statement: z.string(), module_ids: z.array(z.string()).optional() });
const moduleEntry = z.object({ id: z.string().min(1), name: z.string(), path: z.string(), responsibility: z.string(), depends_on: z.array(z.string()).default([]) });

const changesSchema = z
  .object({
    tech_stack: z
      .object({ upsert: z.array(techStackEntry).optional(), remove: z.array(z.string()).optional() })
      .refine((c) => noOverlap(c.upsert ?? [], c.remove ?? []), 'tech_stack: 同一 id 不能同时出现在 upsert 与 remove')
      .optional(),
    architecture_principles: z
      .object({ upsert: z.array(principleEntry).optional(), remove: z.array(z.string()).optional() })
      .refine((c) => noOverlap(c.upsert ?? [], c.remove ?? []), 'architecture_principles: 同一 id 不能同时出现在 upsert 与 remove')
      .optional(),
    modules: z
      .object({ upsert: z.array(moduleEntry).optional(), remove: z.array(z.string()).optional() })
      .refine((c) => noOverlap(c.upsert ?? [], c.remove ?? []), 'modules: 同一 id 不能同时出现在 upsert 与 remove')
      .optional(),
  });

const createAdrSchema = z.object({
  product_id: z.string(),
  title: z.string().min(1),
  status: adrStatusSchema.optional(),
  context: z.string(),
  decision: z.string(),
  consequences: z.string().nullable().optional(),
  alternatives_considered: z.string().nullable().optional(),
  supersedes: z.string().nullable().optional(),
  milestone_id: z.string().nullable().optional(),
  module_ids: z.array(z.string()).optional(),
  changes: changesSchema.nullable().optional(),
});

const transitionStatusSchema = z.object({
  status: adrStatusSchema,
  reason: z.string().optional(),
});

const adrRepo = new AdrRepository();

export const adrRecordsRoutes = new Hono()
  // GET /api/adr-records?projectId=
  .get('/', async (c) => {
    const projectId = c.req.query('projectId');
    if (!projectId) return c.json({ error: 'projectId required' }, 400);
    return c.json(await adrRepo.listByProject(projectId));
  })
  // GET /api/adr-records/current?projectId=（折叠后的当前宪法）
  .get('/current', async (c) => {
    const projectId = c.req.query('projectId');
    if (!projectId) return c.json({ error: 'projectId required' }, 400);
    return c.json(await adrRepo.getCurrentConstitution(projectId));
  })
  // GET /api/adr-records/:id
  .get('/:id', async (c) => {
    const rec = await adrRepo.findById(c.req.param('id'));
    if (!rec) return c.json({ error: 'ADR not found' }, 404);
    return c.json(rec);
  })
  // POST /api/adr-records（仅追加；supersedes 联动在 repo 内）
  .post('/', zValidator('json', createAdrSchema), async (c) => {
    const input = c.req.valid('json');
    const rec = await adrRepo.create({
      product_id: input.product_id,
      title: input.title,
      status: input.status,
      context: input.context,
      decision: input.decision,
      consequences: input.consequences ?? undefined,
      alternatives_considered: input.alternatives_considered ?? undefined,
      supersedes: input.supersedes ?? undefined,
      milestone_id: input.milestone_id ?? undefined,
      module_ids: input.module_ids,
      changes: input.changes ?? undefined,
    });
    return c.json({ success: true, id: rec.id }, 201);
  })
  // POST /api/adr-records/:id/status（状态流转 + 账本）
  .post('/:id/status', zValidator('json', transitionStatusSchema), async (c) => {
    const id = c.req.param('id');
    const input = c.req.valid('json');
    try {
      await adrRepo.transitionStatus(id, input.status, input.reason);
      return c.json({ success: true });
    } catch (e) {
      return c.json(
        { error: 'transition failed', detail: e instanceof Error ? e.message : String(e) },
        400
      );
    }
  });
