// Products REST routes —— 原 projects 正名（docs/design/story-map-redesign.md）

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { generateShortId } from '@x-cartographer/db';
import { getProductRepository } from '@x-cartographer/db';
import type { Product } from '@x-cartographer/shared';

const createProductSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  tech_stack: z.array(z.string()).optional(),
  workspace_dir: z.string().optional(),
  provenance: z.enum(['human_asserted', 'agent_inferred', 'imported']).optional(),
});

const updateProductSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  settings: z.record(z.string(), z.unknown()).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const productsRoutes = new Hono()
  // GET /api/products
  .get('/', async (c) => {
    const repository = getProductRepository();
    return c.json(await repository.findAll());
  })
  // GET /api/products/search?q=
  .get('/search', async (c) => {
    const query = c.req.query('q') ?? '';
    const repository = getProductRepository();
    return c.json(await repository.search(query));
  })
  // GET /api/products/:id
  .get('/:id', async (c) => {
    const repository = getProductRepository();
    return c.json(await repository.findById(c.req.param('id')));
  })
  // POST /api/products
  .post('/', zValidator('json', createProductSchema), async (c) => {
    const input = c.req.valid('json');
    const repository = getProductRepository();
    const id = await generateShortId('product');
    await repository.create(id, input);
    return c.json({ success: true, id }, 201);
  })
  // PATCH /api/products/:id
  .patch('/:id', zValidator('json', updateProductSchema), async (c) => {
    const input = c.req.valid('json');
    const repository = getProductRepository();
    await repository.update(c.req.param('id'), input);
    return c.json({ success: true });
  })
  // DELETE /api/products/:id
  .delete('/:id', async (c) => {
    const repository = getProductRepository();
    return c.json(await repository.delete(c.req.param('id')));
  })
  // PUT /api/products/full (事务写全树)
  // 注：zod v4.4.3 的 z.object+z.record 对此 payload 形状有非确定性误判（最小复现存档于重设计 PR 调查记录），改用结构防御检查
  .put('/full', async (c) => {
    const body = (await c.req.raw.json()) as { project?: unknown };
    if (!body || typeof body !== 'object' || !body.project || typeof body.project !== 'object') {
      return c.json({ success: false, error: 'project payload required' }, 400);
    }
    const repository = getProductRepository();
    await repository.saveFullProduct(body.project as unknown as Product);
    return c.json({ success: true });
  });
