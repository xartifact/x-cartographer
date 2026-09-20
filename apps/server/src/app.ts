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
import { adrRecordsRoutes } from './routes/adr-records';
import { systemModulesRoutes } from './routes/system-modules';
import { traceRoutes } from './routes/trace';
import { ctxRoutes } from './routes/ctx';
import { settingsRoutes } from './routes/settings';
import { checkSchemaHealth } from './lib/schema-health';
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

  /**
   * 存活探针：进程是否响应。
   * **不查库**——容器编排的 liveness 语义是"要不要重启进程"，
   * 数据库不可用属于依赖故障，重启应用无济于事（compose healthcheck 消费此端点）。
   */
  .get('/health', (c) => c.json({ status: 'ok' }))

  /**
   * 就绪探针：数据库可达 **且** schema 与当前代码一致。
   * CI 部署验证消费此端点——2026-09-15 事故正是"代码已升级、库未迁移"，
   * 而 /health 硬编码 ok 使该状态被误判为部署成功。
   * schema 不一致时返回 503，让部署流程立即失败而非把故障推给用户。
   */
  .get('/health/ready', async (c) => {
    const schema = await checkSchemaHealth();
    return c.json(
      {
        status: schema.ok ? 'ready' : 'not_ready',
        database: { reachable: schema.reachable },
        schema: {
          ok: schema.ok,
          missing_tables: schema.missingTables,
          missing_columns: schema.missingColumns,
          wrong_primary_keys: schema.wrongPrimaryKeys,
        },
        ...(schema.error ? { error: schema.error } : {}),
      },
      schema.ok ? 200 : 503
    );
  })

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
  .use('/adr-records/*', apiTokenAuth)
  .use('/system-modules/*', apiTokenAuth)
  .use('/trace/*', apiTokenAuth)
  .use('/ctx/*', apiTokenAuth)
  .route('/products', productsRoutes)
  .route('/user-activities', userActivitiesRoutes)
  .route('/user-tasks', userTasksRoutes)
  .route('/milestones', milestonesRoutes)
  .route('/stories', storiesRoutes)
  .route('/dev-tasks', devTasksRoutes)
  .route('/status-changes', statusChangesRoutes)
  .route('/adr-records', adrRecordsRoutes)
  .route('/system-modules', systemModulesRoutes)
  .route('/trace', traceRoutes)
  .route('/ctx', ctxRoutes)
  .route('/settings', settingsRoutes)
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
