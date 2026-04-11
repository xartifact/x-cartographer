import fs from 'fs';
import { PGlite } from '@electric-sql/pglite';
import { drizzle as drizzlePglite } from 'drizzle-orm/pglite';
import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';
import { createLogger } from '@/lib/logger';

type DbInstance = ReturnType<typeof drizzlePglite<typeof schema>>;

const log = createLogger('db');

// 使用 globalThis 存储单例，避免 Next.js 模块热重载时重复创建 PGlite 实例
// 但 Route Handler 不访问数据库——它通过客户端传入的上下文工作，无需此单例
const g = globalThis as typeof globalThis & {
  __xpr_db?: DbInstance;
  __xpr_dbInitPromise?: Promise<void>;
};

const TABLE_SQLS = [
  `CREATE TABLE IF NOT EXISTS "projects" (
    "id" text PRIMARY KEY NOT NULL,
    "name" text NOT NULL,
    "description" text,
    "metadata" jsonb DEFAULT '{"tech_stack":[],"version":"1.0.0","tags":[]}'::jsonb NOT NULL,
    "settings" jsonb NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS "status_changes" (
    "id" text PRIMARY KEY NOT NULL,
    "entity_id" text NOT NULL,
    "entity_type" text NOT NULL,
    "previous_status" text NOT NULL,
    "new_status" text NOT NULL,
    "reason" text,
    "changed_by" text,
    "changed_at" timestamp with time zone DEFAULT now() NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS "user_journeys" (
    "id" text PRIMARY KEY NOT NULL,
    "project_id" text NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
    "name" text NOT NULL,
    "description" text DEFAULT '' NOT NULL,
    "persona" text DEFAULT '' NOT NULL,
    "order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS "user_stories" (
    "id" text PRIMARY KEY NOT NULL,
    "journey_id" text NOT NULL REFERENCES "user_journeys"("id") ON DELETE CASCADE,
    "title" text NOT NULL,
    "description" text DEFAULT '' NOT NULL,
    "priority" text DEFAULT 'medium' NOT NULL,
    "estimation" real DEFAULT 0 NOT NULL,
    "acceptance_criteria" jsonb DEFAULT '[]'::jsonb NOT NULL,
    "tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
    "status" text DEFAULT 'backlog',
    "position" jsonb,
    "order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS "tasks" (
    "id" text PRIMARY KEY NOT NULL,
    "story_id" text NOT NULL REFERENCES "user_stories"("id") ON DELETE CASCADE,
    "title" text NOT NULL,
    "description" text DEFAULT '' NOT NULL,
    "type" text DEFAULT 'technical_task' NOT NULL,
    "priority" text DEFAULT 'P2' NOT NULL,
    "estimation" real DEFAULT 0 NOT NULL,
    "status" text DEFAULT 'backlog' NOT NULL,
    "dependencies" jsonb DEFAULT '[]'::jsonb NOT NULL,
    "tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
    "assignee" text,
    "started_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS "app_settings" (
    "key" text PRIMARY KEY NOT NULL,
    "value" text NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL
  )`,
];

/**
 * 尝试打开 PGlite 文件数据库。
 *
 * PGlite 底层是 PostgreSQL WASM，pgdata 目录在进程崩溃后可能损坏：
 *   - postmaster.pid 残留 → PostgreSQL 拒绝启动
 *   - pgdata 不一致    → WASM abort（RuntimeError: Aborted）
 *
 * 策略：
 *   第 1 次尝试：清理锁文件后打开。
 *   若 waitReady 或首条 SQL 失败：清空 pgdata，第 2 次用全新目录打开。
 *   第 2 次若仍失败：向上抛出，让调用方感知。
 */
async function openPGlite(pgliteDir: string): Promise<DbInstance> {
  for (let attempt = 1; attempt <= 2; attempt++) {
    fs.mkdirSync(pgliteDir, { recursive: true });

    const pidFile = `${pgliteDir}/postmaster.pid`;
    if (fs.existsSync(pidFile)) {
      fs.unlinkSync(pidFile);
      log.warn('db.stale_lock_removed', { path: pidFile, attempt });
    }

    try {
      const pglite = new PGlite(pgliteDir);
      // waitReady 确保 WASM 和 PostgreSQL 完成内部启动
      await pglite.waitReady;
      for (const sql of TABLE_SQLS) {
        await pglite.exec(sql);
      }
      return drizzlePglite(pglite, { schema });
    } catch (err) {
      if (attempt === 1) {
        log.warn('db.pgdata_corrupted_resetting', {
          dir: pgliteDir,
          error: err instanceof Error ? err.message : String(err),
        });
        fs.rmSync(pgliteDir, { recursive: true, force: true });
        // 继续第 2 次循环，使用全新空目录
      } else {
        throw err;
      }
    }
  }
  // TypeScript 要求有返回值（实际不可达）
  throw new Error('PGlite 初始化失败');
}

async function initializeDb(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;

  if (databaseUrl) {
    log.info('db.connecting', { type: 'postgresql' });
    const pool = new Pool({ connectionString: databaseUrl });
    for (const sql of TABLE_SQLS) {
      await pool.query(sql);
    }
    g.__xpr_db = drizzlePg(pool, { schema }) as unknown as DbInstance;
    log.info('db.ready', { type: 'postgresql' });
  } else {
    log.info('db.connecting', { type: 'pglite' });
    const pgliteDir = `${process.cwd()}/data/pglite`;
    g.__xpr_db = await openPGlite(pgliteDir);
    log.info('db.ready', { type: 'pglite' });
  }
}

export async function ensureDb(): Promise<DbInstance> {
  if (g.__xpr_db) return g.__xpr_db;
  if (!g.__xpr_dbInitPromise) {
    g.__xpr_dbInitPromise = initializeDb().catch((err) => {
      g.__xpr_dbInitPromise = undefined;
      throw err;
    });
  }
  await g.__xpr_dbInitPromise;
  return g.__xpr_db!;
}

export function getDb(): DbInstance {
  if (!g.__xpr_db) {
    throw new Error('Database not initialized. Call ensureDb() first.');
  }
  return g.__xpr_db;
}

export type { DbInstance };
