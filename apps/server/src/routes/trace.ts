// Trace REST routes —— 约束追溯（docs/design/domain-model.md §2.3 两分的读路径）
// 纯读、零裁决（§3.5）：把 story/module/adr/task 的既有引用 join 成一条链。

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { traceByQuery } from '../lib/trace';

const traceQuerySchema = z.object({
  storyId: z.string().optional(),
  moduleId: z.string().optional(),
  adrId: z.string().optional(),
});

export const traceRoutes = new Hono()
  // GET /api/trace?storyId= | moduleId= | adrId=（三选一）
  .get('/', zValidator('query', traceQuerySchema), async (c) => {
    const result = await traceByQuery(c.req.valid('query'));
    if ('error' in result) return c.json({ error: result.error }, 400);
    return c.json(result);
  });
