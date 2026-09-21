// SystemModules REST routes —— 系统模块目录（一等实体，0006 起）
// docs/design/domain-model.md §6.4：模块是"结构认知"，独立于 ADR 日志维护；
// ADR 通过 module_ids 标注涉及范围，但模块定义只在 system_modules 表。

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { SystemModuleRepository } from '@x-cartographer/db';
import { recordConstraintWrite } from '../lib/constraint-ledger';
import { findCycleThrough } from '../lib/graph';

/**
 * 模块 id 是人类可读稳定 slug（§3.6）：小写字母/数字/连字符，
 * 不用随机 id —— 它会被 principles.module_ids 与 Story/Task.affected_modules 反复引用，
 * Agent 需要能直接拼出/记住。故此处**不做** short-id 序列生成。
 *
 * 作用域是产品（0009 起复合主键 (product_id, id)）：slug 只在所属产品目录内唯一。
 * 故 detail/delete 必须带 productId —— 单凭 slug 无从定位（`cli` 在多个产品下是不同模块）。
 */
const moduleIdSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9][a-z0-9-]*$/, 'id 必须是小写 slug（字母/数字/连字符，如 web-spa）');


/** 模块身份是 (产品, slug)：detail/delete 必须带产品上下文才能定位 */
const productQuerySchema = z.object({ productId: z.string().min(1) });

const upsertSystemModuleSchema = z.object({
  id: moduleIdSchema,
  product_id: z.string(),
  name: z.string().min(1),
  path: z.string().optional(),
  responsibility: z.string().optional(),
  depends_on: z.array(moduleIdSchema).default([]),
  provenance: z.enum(['human_asserted', 'agent_inferred', 'imported']).optional(),
});

const moduleRepo = new SystemModuleRepository();

export const systemModulesRoutes = new Hono()
  // GET /api/system-modules?productId=
  .get('/', zValidator('query', productQuerySchema), async (c) => {
    const { productId } = c.req.valid('query');
    const modules = await moduleRepo.findByProductId(productId);
    return c.json(modules.map((m) => ({ ...m })));
  })
  // GET /api/system-modules/:id?productId= —— 模块身份是 (产品, slug)，单凭 slug 无法定位
  .get('/:id', zValidator('query', productQuerySchema), async (c) => {
    const { productId } = c.req.valid('query');
    const mod = await moduleRepo.findById(productId, c.req.param('id'));
    if (!mod) return c.json({ error: 'module not found' }, 404);
    return c.json(mod);
  })
  // PUT /api/system-modules/:id —— 幂等 upsert（按 (产品, slug) 定位）
  .put('/:id', zValidator('json', upsertSystemModuleSchema), async (c) => {
    const input = c.req.valid('json');
    const id = c.req.param('id');
    if (input.id !== id) {
      return c.json({ error: 'body.id 与路径 id 不一致' }, 400);
    }
    // 先查后写：区分「新建」（增 = 高影响）与「更新」（模块定义刷新，同样改变
    // 结构认知——但随代码演进持续更新是模块目录的天性（§6.4），只在新建/删除记账，
    // 更新不记以免账本被例行维护噪音淹没）。
    const existing = await moduleRepo.findById(input.product_id, id);
    // 模块依赖校验（§2.4「约束 → 约束：允许，但不得成环」+ §5 无悬空）：
    // 与任务依赖（dependency-graph）同层同语义——只判定不裁决，违规拒绝写入。
    // 悬空在此也拒绝：依赖目录内不存在的 slug 会让模块依赖图出现幽灵节点。
    const catalog = await moduleRepo.findByProductId(input.product_id);
    const known = new Set(catalog.map((m) => m.id));
    const unknownDeps = input.depends_on.filter((d) => !known.has(d) && d !== id);
    if (unknownDeps.length > 0) {
      return c.json(
        {
          error: 'unknown_module_dependency',
          detail:
            `依赖了目录中不存在的模块：${unknownDeps.join(', ')}。` +
            `domain-model §5「无悬空」：模块依赖必须指向本产品目录内的真实模块。`,
        },
        400
      );
    }
    if (input.depends_on.includes(id)) {
      return c.json(
        {
          error: 'self_dependency',
          detail: `模块 ${id} 不能依赖自身（domain-model §2.4「不得成环」）。`,
        },
        400
      );
    }
    // 环检测：把本次写入的边以「待写入状态」覆盖进图，再查能否回到自身
    const edges = new Map(catalog.map((m) => [m.id, m.depends_on]));
    edges.set(id, input.depends_on);
    const cycle = findCycleThrough(edges, id);
    if (cycle) {
      return c.json(
        {
          error: 'module_dependency_cycle',
          detail:
            `该写入会形成模块依赖环：${cycle.join(' → ')}。` +
            `domain-model §2.4「约束 → 约束：不得成环」；请改为不构成环的依赖方向。`,
        },
        400
      );
    }
    await moduleRepo.upsert(input, input.product_id);
    if (!existing) {
      await recordConstraintWrite({
        entityType: 'system_module',
        entityId: id,
        action: `新增模块「${input.name}」（产品 ${input.product_id}）`,
        provenance: input.provenance,
      });
    }
    return c.json({ success: true, id });
  })
  // DELETE /api/system-modules/:id?productId= —— 同上，必须带产品上下文
  .delete('/:id', zValidator('query', productQuerySchema), async (c) => {
    const { productId } = c.req.valid('query');
    const id = c.req.param('id');
    const existing = await moduleRepo.findById(productId, id);
    await moduleRepo.delete(productId, id);
    // 删模块 = 移除一条结构认知（高影响）；既有引用按 §6.4.2 不清理，悬空靠扫描报告
    await recordConstraintWrite({
      entityType: 'system_module',
      entityId: id,
      action: `删除模块「${existing?.name ?? id}」（产品 ${productId}）`,
    });
    return c.json({ success: true });
  });
