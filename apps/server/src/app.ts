// Gateway Hono 应用（纯框架，无运行时依赖，供 web RPC client 引用类型）
// basePath('/api')：hc 端 key 为短路径（products/user-activities/...），api.products 直接访问。
// 重设计迁移（docs/design/story-map-redesign.md）：旧路由 projects/journeys/tasks 返回 410/301。

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { register } from 'prom-client';
import { productsRoutes } from './routes/products';
import { userActivitiesRoutes } from './routes/user-activities';
import { userTasksRoutes } from './routes/user-tasks';
import { storiesRoutes } from './routes/stories';
import { devTasksRoutes } from './routes/dev-tasks';
import { milestonesRoutes } from './routes/milestones';
import { statusChangesRoutes } from './routes/status-changes';
import { settingsRoutes } from './routes/settings';
import type { MiddlewareHandler } from 'hono';
import { createLogger } from '@x-cartographer/db';
import { apiTokenAuth } from './middleware/auth';
import { spaStaticMiddleware } from './middleware/spa-static';
const log = createLogger('gateway');

/**
 * 旧路由兼容：410 Gone（资源已迁移，带指引）
 */
const gone =
  (legacy: string, replacement: string): MiddlewareHandler =>
  async (c) =>
    c.json(
      {
        error: 'Gone',
        message: `'${legacy}' 已迁移至 '${replacement}'（用户故事地图重设计，见 docs/design/story-map-redesign.md）`,
        replacement,
      },
      410
    );

/**
 * 顶层 const 链式装配。
 * basePath('/api') 让 /api/products 等在 hc 端以短 key（products）访问。
 * const 类型由 TS 完整推断（含路由 schema），web 侧用 typeof app 消费（hc RPC 类型安全）。
 */
export const app = new Hono()
  .use('*', cors())
  .use('*', logger())

  // 生产镜像托管 apps/web/dist；dev 下文件不存在，中间件透传所有请求
  .use('*', spaStaticMiddleware())

  .get('/health', (c) => c.json({ status: 'ok' }))

  .get('/metrics', async (c) => {
    c.header('Content-Type', register.contentType);
    return c.body(await register.metrics());
  })

  // /api basePath：hc 端 key 为短路径
  .basePath('/api')
  .use('/products/*', apiTokenAuth)
  .use('/user-activities/*', apiTokenAuth)
  .use('/user-tasks/*', apiTokenAuth)
  .use('/milestones/*', apiTokenAuth)
  .use('/stories/*', apiTokenAuth)
  .use('/dev-tasks/*', apiTokenAuth)
  .use('/status-changes/*', apiTokenAuth)
  .route('/products', productsRoutes)
  .route('/user-activities', userActivitiesRoutes)
  .route('/user-tasks', userTasksRoutes)
  .route('/milestones', milestonesRoutes)
  .route('/stories', storiesRoutes)
  .route('/dev-tasks', devTasksRoutes)
  .route('/status-changes', statusChangesRoutes)
  .route('/settings', settingsRoutes)

  // ── 旧路由兼容（一个版本周期）──
  .use('/projects/*', gone('projects', 'products'))
  .use('/journeys/*', gone('journeys', 'user-activities'))
  .use('/tasks/*', gone('tasks', 'dev-tasks'))

  .onError((err, c) => {
    log.error('api.error', { message: err instanceof Error ? err.message : String(err) });
    return c.json({ error: err instanceof Error ? err.message : 'Internal error' }, 500);
  })

  .notFound((c) => c.json({ error: 'Not found' }, 404));

export function createApp() {
  return app;
}

export type AppType = typeof app;
