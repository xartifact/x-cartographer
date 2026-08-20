// Settings REST routes — API Token 管理
// 注意：内置 LLM 配置（/llm/*）已随"移除内置 AI"移除，智能交由外部 Agent 驱动。

import { Hono } from 'hono';
import { AppSettingsRepository } from '@x-cartographer/db';
import { nanoid } from 'nanoid';

const repo = new AppSettingsRepository();

export const settingsRoutes = new Hono()
  // GET /api/settings/token — 查询 API Token 是否已配置
  .get('/token', async (c) => {
    const token = await repo.get('api_token');
    return c.json({ configured: !!token });
  })
  // POST /api/settings/token — 生成/轮换 API Token（供外部 Agent / CI 接入）
  .post('/token', async (c) => {
    const token = nanoid(48);
    await repo.set('api_token', token);
    return c.json({ success: true, token }, 201);
  })
  // DELETE /api/settings/token — 撤销 API Token
  .delete('/token', async (c) => {
    await repo.delete('api_token');
    return c.json({ success: true });
  });
