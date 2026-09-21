// @x-cartographer/db - Data layer: schema, client, repositories, logger

// Database schema
export * from './db/schema';

// Database client
export { ensureDb, getDb, closeDb, rowsOf } from './db/client';
export type { DbInstance } from './db/client';

// Repositories
export * from './repositories';

// ID 生成（序列分配；规格供迁移脚本复用）
export { ID_SPECS, generateShortId, formatShortId, parseShortId, bumpSequenceTo } from './lib/short-id';
export type { ShortIdKind } from './lib/short-id';

// Logger
export { createLogger, getRootLoggerInstance } from './lib/logger';
export type { LogLevel } from './lib/logger';
