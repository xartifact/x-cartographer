#!/usr/bin/env bun
/**
 * 容器入口：先迁移，成功才启动服务。
 *
 * 背景：两次生产事故同根因——新镜像已启动、库未迁移 → API 全 500。
 * 就绪探针能把这类状态**显式暴露**（503 而非静默 500），但迁移仍依赖人手动执行。
 * 本脚本把它变成容器的固有行为：**任何方式启动容器，都先迁移**。
 *
 * 失败语义：迁移失败 → 非零退出 → compose 的 restart: always 会重试
 * （迁移脚本幂等，重试安全）。绝不在 schema 未就绪时启动服务。
 */
import { spawn } from 'node:child_process';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('[entrypoint] ✗ DATABASE_URL 未设置 —— 拒绝在无库配置时启动');
  process.exit(1);
}

console.log('[entrypoint] 1/2 数据库迁移...');
const migrate = spawn('bun', ['run', 'apps/server/scripts/migrate-schema.ts'], {
  stdio: 'inherit',
  env: process.env,
});
const { promise: migrateDone, resolve: onMigrateExit } = Promise.withResolvers<number>();
migrate.on('exit', onMigrateExit);
const migrateCode = await migrateDone;

if (migrateCode !== 0) {
  console.error(`[entrypoint] ✗ 迁移失败（exit ${migrateCode}）—— 不启动服务，退出以触发容器重试`);
  process.exit(migrateCode);
}
console.log('[entrypoint] ✓ 迁移完成');

console.log('[entrypoint] 2/2 启动网关...');
const server = spawn('bun', ['run', 'apps/server/src/index.ts'], {
  stdio: 'inherit',
  env: process.env,
});
server.on('exit', (code) => process.exit(code ?? 0));

// 任一信号转发给服务进程，保证 docker stop 的优雅关闭
for (const sig of ['SIGTERM', 'SIGINT'] as const) {
  process.on(sig, () => server.kill(sig));
}
