// Gateway Hono 应用（纯框架，无运行时依赖，供 web RPC client 引用类型）
// basePath('/api')：hc 端 key 为短路径（projects/journeys/...），api.projects 直接访问。

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { register } from 'prom-client';
import { projectsRoutes } from './routes/projects';
import { journeysRoutes } from './routes/journeys';
import { storiesRoutes } from './routes/stories';
import { tasksRoutes } from './routes/tasks';
import { milestonesRoutes } from './routes/milestones';
import { statusChangesRoutes } from './routes/status-changes';
import { settingsRoutes } from './routes/settings';
import { createLogger } from '@x-cartographer/db';
import { apiTokenAuth } from './middleware/auth';
const log = createLogger('gateway');

/**
 * 顶层 const 链式装配。
 * basePath('/api') 让 /api/projects 等在 hc 端以短 key（projects）访问。
 * const 类型由 TS 完整推断（含路由 schema），web 侧用 typeof app 消费（hc RPC 类型安全）。
 */
export const app = new Hono()
  .use('*', cors())
  .use('*', logger())

  .get('/health', (c) => c.json({ status: 'ok' }))

  .get('/metrics', async (c) => {
    c.header('Content-Type', register.contentType);
    return c.body(await register.metrics());
  })

  // /api basePath：hc 端 key 为短路径
  .basePath('/api')
  .use('/projects/*', apiTokenAuth)
  .use('/journeys/*', apiTokenAuth)
  .use('/milestones/*', apiTokenAuth)
  .use('/stories/*', apiTokenAuth)
  .use('/tasks/*', apiTokenAuth)
  .use('/status-changes/*', apiTokenAuth)
  .route('/projects', projectsRoutes)
  .route('/journeys', journeysRoutes)
  .route('/milestones', milestonesRoutes)
  .route('/stories', storiesRoutes)
  .route('/tasks', tasksRoutes)
  .route('/status-changes', statusChangesRoutes)
  .route('/settings', settingsRoutes)

  .onError((err, c) => {
    log.error('api.error', { message: err instanceof Error ? err.message : String(err) });
    return c.json({ error: err instanceof Error ? err.message : 'Internal error' }, 500);
  })

  .notFound((c) => c.json({ error: 'Not found' }, 404));

export function createApp() {
  return app;
}

export type AppType = typeof app;
