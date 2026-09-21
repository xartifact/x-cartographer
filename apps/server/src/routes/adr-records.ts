// AdrRecords REST routes —— 技术宪法账本（ADR，append-only）
// docs/design/technical-constitution.md §3；镜像 milestones.ts 的 zod+Hono 写法。
// 约束写入协议（高影响非人主张落 proposed）见 docs/design/domain-model.md §4.1/§4.4。

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { AdrRepository, createLogger } from '@x-cartographer/db';
import { resolveAdrCreateStatus } from '../lib/constraint-impact';

// §3.1 状态机：proposed → accepted | rejected；accepted → deprecated | superseded。
// `rejected`（评估过、决定不做）必须可写入——否则该状态在 shared 类型/db schema/repo 里
// 都是死的，设计文档里"记录被否决的决策"这条能力实际不可达。
const adrStatusSchema = z.enum(['proposed', 'accepted', 'rejected', 'superseded', 'deprecated']);

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
  provenance: z.enum(['human_asserted', 'agent_inferred', 'imported']).optional(),
});

const transitionStatusSchema = z.object({
  status: adrStatusSchema,
  reason: z.string().optional(),
});

const log = createLogger('adr-records');
const adrRepo = new AdrRepository();

export const adrRecordsRoutes = new Hono()
  // GET /api/adr-records?productId=（其余路由统一用 productId，勿再用旧名 projectId）
  .get('/', async (c) => {
    const productId = c.req.query('productId');
    if (!productId) return c.json({ error: 'productId required' }, 400);
    return c.json(await adrRepo.listByProject(productId));
  })
  // GET /api/adr-records/current?productId=（折叠后的当前宪法）
  .get('/current', async (c) => {
    const productId = c.req.query('productId');
    if (!productId) return c.json({ error: 'productId required' }, 400);
    return c.json(await adrRepo.getCurrentConstitution(productId));
  })
  // GET /api/adr-records/as-of-milestone?milestoneId=（历史架构快照）
  .get('/as-of-milestone', async (c) => {
    const milestoneId = c.req.query('milestoneId');
    if (!milestoneId) return c.json({ error: 'milestoneId required' }, 400);
    try {
      return c.json(await adrRepo.getConstitutionAsOfMilestone(milestoneId));
    } catch (e) {
      return c.json({ error: e instanceof Error ? e.message : String(e) }, 404);
    }
  })
  // GET /api/adr-records/:id
  .get('/:id', async (c) => {
    const rec = await adrRepo.findById(c.req.param('id'));
    if (!rec) return c.json({ error: 'ADR not found' }, 404);
    return c.json(rec);
  })
  // POST /api/adr-records（仅追加；supersedes 联动在 repo 内）
  //
  // 约束写入协议（§4.1）：建 ADR 是「一次决策」，属高影响写入。非人主张
  // （agent_inferred / imported）的落点由 resolveAdrCreateStatus 判定——
  // 未显式指定 status 时**强制 proposed**，不自动 accepted（升格须显式且带理由，§4.4）。
  // human_asserted 维持现状：可传 status，缺省仍是 proposed。
  .post('/', zValidator('json', createAdrSchema), async (c) => {
    const input = c.req.valid('json');
    const landing = resolveAdrCreateStatus({
      provenance: input.provenance,
      status: input.status,
    });
    if (landing.warnings) {
      // 不静默改用户意图，但也不静默放过：调用方显式要跳过 proposed，
      // 此处沿用其值并留痕（响应 + 日志双写）。
      log.warn('adr.create.status_without_human_assertion', {
        provenance: input.provenance ?? 'agent_inferred',
        status: landing.status,
        title: input.title,
      });
    }
    const rec = await adrRepo.create({
      product_id: input.product_id,
      title: input.title,
      status: landing.status,
      context: input.context,
      decision: input.decision,
      consequences: input.consequences ?? undefined,
      alternatives_considered: input.alternatives_considered ?? undefined,
      supersedes: input.supersedes ?? undefined,
      milestone_id: input.milestone_id ?? undefined,
      module_ids: input.module_ids,
      changes: input.changes ?? undefined,
      provenance: input.provenance,
    });
    return c.json(
      {
        success: true,
        id: rec.id,
        status: rec.status,
        ...(landing.warnings ? { warnings: landing.warnings } : {}),
      },
      201
    );
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
