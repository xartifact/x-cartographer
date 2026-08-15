// @xpm/gateway - Hono API server 启动入口
// 业务路由见 ./app.ts

import { app } from './app';
import { createLogger } from '@xpm/db';

const log = createLogger('gateway');

export { app, createApp } from './app';
export type { AppType } from './app';

// 独立启动入口（bun run src/index.ts）
const isMain = Bun.main === import.meta.path;
if (isMain) {
  const port = Number(process.env.PORT ?? 8787);
  log.info('gateway.starting', { port });
  Bun.serve({ fetch: app.fetch, port });
  log.info('gateway.ready', { port });
}
