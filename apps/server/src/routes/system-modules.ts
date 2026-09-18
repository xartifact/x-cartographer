// SystemModules REST routes —— 系统模块目录（一等实体，0006 起）
// docs/design/domain-model.md §6.4：模块是"结构认知"，独立于 ADR 日志维护；
// ADR 通过 module_ids 标注涉及范围，但模块定义只在 system_modules 表。

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { SystemModuleRepository } from '@x-cartographer/db';

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
    await moduleRepo.upsert(input, input.product_id);
    return c.json({ success: true, id });
  })
  // DELETE /api/system-modules/:id?productId= —— 同上，必须带产品上下文
  .delete('/:id', zValidator('query', productQuerySchema), async (c) => {
    const { productId } = c.req.valid('query');
    await moduleRepo.delete(productId, c.req.param('id'));
    return c.json({ success: true });
  });
