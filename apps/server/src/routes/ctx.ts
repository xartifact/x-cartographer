// Ctx REST route —— 任务上下文切片（P2：Agent 的实际输入面）
// 纯读、零裁决（§3.5）。

import { Hono } from 'hono';
import { buildTaskContext } from '../lib/ctx';

export const ctxRoutes = new Hono()
  // GET /api/ctx/:taskId —— 任务视角的上下文切片
  .get('/:taskId', async (c) => {
    const result = await buildTaskContext(c.req.param('taskId'));
    if (!result) return c.json({ error: `任务不存在: ${c.req.param('taskId')}` }, 404);
    return c.json(result);
  });
