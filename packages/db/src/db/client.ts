import fs from 'fs';
import { PGlite } from '@electric-sql/pglite';
import { drizzle as drizzlePglite } from 'drizzle-orm/pglite';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
import { createLogger } from '../lib/logger';

type DbInstance = ReturnType<typeof drizzlePglite<typeof schema>>;

const log = createLogger('db');

// 使用 globalThis 存储单例，避免 Next.js 模块热重载时重复创建 PGlite 实例
// 但 Route Handler 不访问数据库——它通过客户端传入的上下文工作，无需此单例
const g = globalThis as typeof globalThis & {
  __xpr_db?: DbInstance;
  __xpr_dbInitPromise?: Promise<void>;
  /**
   * 底层驱动的原始句柄（PGlite 实例 / postgres-js 客户端）。
   * 仅用于 `closeDb()` 显式关闭——drizzle 包装层不暴露统一的关闭入口。
   * 不存它的话，测试结束时 PGlite 的 worker/文件句柄无人释放，bun 测试运行器
   * 会判定「通过但有未清理资源」并以退出码 99 结束（0 失败却非 0 退出），
   * 使任何以退出码判定成败的 CI 步骤失败。
   */
  __xpr_raw?: { close?: () => Promise<void>; end?: () => Promise<void> };
};

const TABLE_SQLS = [
  // ── 平台域 ──
  `CREATE TABLE IF NOT EXISTS "products" (
    "id" text PRIMARY KEY NOT NULL,
    "name" text NOT NULL,
    "description" text,
    "metadata" jsonb DEFAULT '{"tech_stack":[],"version":"1.0.0","tags":[]}'::jsonb NOT NULL,
    "settings" jsonb NOT NULL,
    "provenance" text DEFAULT 'agent_inferred' NOT NULL,
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
    "changed_at" timestamp with time zone DEFAULT now() NOT NULL,
    "seq" bigserial NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS "milestones" (
    "id" text PRIMARY KEY NOT NULL,
    "product_id" text NOT NULL REFERENCES "products"("id") ON DELETE CASCADE,
    "name" text NOT NULL,
    "goal" text DEFAULT '' NOT NULL,
    "target_date" timestamp with time zone,
    "status" text DEFAULT 'planned' NOT NULL,
    "provenance" text DEFAULT 'agent_inferred' NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL
  )`,
  // ── 用户域（用户故事地图）──
  `CREATE TABLE IF NOT EXISTS "user_activities" (
    "id" text PRIMARY KEY NOT NULL,
    "product_id" text NOT NULL REFERENCES "products"("id") ON DELETE CASCADE,
    "name" text NOT NULL,
    "description" text DEFAULT '' NOT NULL,
    "order" integer DEFAULT 0 NOT NULL,
    "provenance" text DEFAULT 'agent_inferred' NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS "user_tasks" (
    "id" text PRIMARY KEY NOT NULL,
    "activity_id" text NOT NULL REFERENCES "user_activities"("id") ON DELETE CASCADE,
    "name" text NOT NULL,
    "description" text DEFAULT '' NOT NULL,
    "order" integer DEFAULT 0 NOT NULL,
    "provenance" text DEFAULT 'agent_inferred' NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS "user_stories" (
    "id" text PRIMARY KEY NOT NULL,
    "activity_id" text REFERENCES "user_activities"("id") ON DELETE CASCADE,
    "user_task_id" text REFERENCES "user_tasks"("id") ON DELETE SET NULL,
    "legacy_journey_id" text,
    "milestone_id" text REFERENCES "milestones"("id") ON DELETE SET NULL,
    "title" text NOT NULL,
    "description" text DEFAULT '' NOT NULL,
    "priority" text DEFAULT 'medium' NOT NULL,
    "estimation" real DEFAULT 0 NOT NULL,
    "acceptance_criteria" jsonb DEFAULT '[]'::jsonb NOT NULL,
    "tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
    "affected_modules" jsonb DEFAULT '[]'::jsonb NOT NULL,
    "status" text DEFAULT 'backlog',
    "position" jsonb,
    "order" integer DEFAULT 0 NOT NULL,
    "provenance" text DEFAULT 'agent_inferred' NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL
  )`,
  // ── 模块目录（一等实体：结构认知，非 ADR 投影）──
  `CREATE TABLE IF NOT EXISTS "system_modules" (
    "id" text NOT NULL,
    "product_id" text NOT NULL REFERENCES "products"("id") ON DELETE CASCADE,
    "name" text NOT NULL,
    "path" text DEFAULT '' NOT NULL,
    "responsibility" text DEFAULT '' NOT NULL,
    "depends_on" jsonb DEFAULT '[]'::jsonb NOT NULL,
    "provenance" text DEFAULT 'agent_inferred' NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
    PRIMARY KEY ("product_id", "id")
  )`,
  `CREATE INDEX IF NOT EXISTS "system_modules_product_id_idx" ON "system_modules" ("product_id")`,
  // ── 执行域 ──
  `CREATE TABLE IF NOT EXISTS "dev_tasks" (
    "id" text PRIMARY KEY NOT NULL,
    "story_id" text REFERENCES "user_stories"("id") ON DELETE CASCADE,
    "product_id" text REFERENCES "products"("id") ON DELETE CASCADE,
    "module_id" text,
    "title" text NOT NULL,
    "description" text DEFAULT '' NOT NULL,
    "priority" text DEFAULT 'P2' NOT NULL,
    "estimation" real DEFAULT 0 NOT NULL,
    "status" text DEFAULT 'backlog' NOT NULL,
    "dependencies" jsonb DEFAULT '[]'::jsonb NOT NULL,
    "tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
    "affected_modules" jsonb DEFAULT '[]'::jsonb NOT NULL,
    "assignee" text,
    "started_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL
  )`,
  // ── 技术宪法 ──
  `CREATE TABLE IF NOT EXISTS "adr_records" (
    "id" text PRIMARY KEY NOT NULL,
    "product_id" text NOT NULL REFERENCES "products"("id") ON DELETE CASCADE,
    "title" text NOT NULL,
    "status" text DEFAULT 'proposed' NOT NULL,
    "context" text NOT NULL,
    "decision" text NOT NULL,
    "consequences" text,
    "alternatives_considered" text,
    "supersedes" text,
    "milestone_id" text REFERENCES "milestones"("id") ON DELETE SET NULL,
    "module_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
    "changes" jsonb,
    "provenance" text DEFAULT 'agent_inferred' NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "seq" bigserial NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS "app_settings" (
    "key" text PRIMARY KEY NOT NULL,
    "value" text NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL
  )`,
];

/** 应用级锁文件名（与 PGlite 内部的 postmaster.pid 无关，语义见 acquirePgliteLock） */
const PGLITE_LOCK_FILE = '.xpr-db.pid';

/**
 * 应用级独占锁：打开 PGlite 数据目录前先取得。
 *
 * 与 PGlite 内部 postmaster.pid 的区别：那个文件由 WASM 内核在启动时写、
 * 内容与时机不受我们控制；本锁由应用写入自己的 pid，**先于** PGlite 打开。
 * 借鉴 x-herald（packages/db/src/connections/pglite.ts）的范式。
 *
 * 三种情形：
 *   - 无锁 / 持有者已死 → 清理后写自己的 pid，继续
 *   - 持有者是本进程 → 直接继续（重复初始化防护）
 *   - 持有者存活 → **立即抛错**，附 pid、命令行、运行时长与解锁命令
 *
 * 历史教训：旧实现撞锁后等待重试，重试失败则 `rmSync` 删掉整个数据目录
 * "重建"——2026-08-24 与 2026-09-18 两次本地库清空同此根源。
 * 数据目录的内容永远比"自动恢复"贵：打不开就报错，让人决定怎么办。
 */
function acquirePgliteLock(pgliteDir: string): void {
  const lockPath = `${pgliteDir}/${PGLITE_LOCK_FILE}`;
  fs.mkdirSync(pgliteDir, { recursive: true });

  if (fs.existsSync(lockPath)) {
    const existingPid = Number.parseInt(fs.readFileSync(lockPath, 'utf-8').trim(), 10);
    if (existingPid === process.pid) return; // 同进程重复初始化（测试场景）

    if (Number.isInteger(existingPid) && existingPid > 0 && isProcessAlive(existingPid)) {
      let command = '';
      let elapsed = '';
      try {
        // 仅取诊断信息用；失败不影响错误抛出
        const out = require('node:child_process')
          .execSync(`ps -p ${existingPid} -o command=,etime=`, { encoding: 'utf-8', timeout: 1000 })
          .trim();
        const m = out.match(/^(.+?)\s+(\d{2}:\d{2}:\d{2}|\d+:\d{2})$/);
        if (m) {
          command = m[1]!.trim();
          elapsed = m[2]!;
        } else {
          command = out;
        }
      } catch {
        /* 诊断信息可选 */
      }
      log.error('db.lock_held_by_live_process', {
        pid: existingPid,
        command: command || undefined,
        elapsed: elapsed || undefined,
        lockPath,
      });
      const cmdSuffix = command ? ` "${command}"` : '';
      const elapsedSuffix = elapsed ? `（已运行 ${elapsed}）` : '';
      throw new Error(
        `PGlite 数据目录已被存活进程锁定：PID ${existingPid}${cmdSuffix}${elapsedSuffix}。` +
          `锁文件：${lockPath}。停止持有者：kill ${existingPid}（确认进程已退出后也可手动删锁文件）。` +
          `绝不在锁被持有时打开/重建数据目录——那会损坏或清空数据。`
      );
    }

    // 持有者已退出：清掉残留锁（崩溃残留是正常情形，清理后继续）
    fs.unlinkSync(lockPath);
    log.warn('db.stale_lock_removed', { lockPath, stalePid: existingPid });
  }

  fs.writeFileSync(lockPath, String(process.pid));
  const cleanup = () => {
    try {
      // 只清理仍是自己写的锁（避免误删后到者的锁）
      if (fs.existsSync(lockPath) && fs.readFileSync(lockPath, 'utf-8').trim() === String(process.pid)) {
        fs.unlinkSync(lockPath);
      }
    } catch {
      /* 尽力清理 */
    }
  };
  process.once('exit', cleanup);
  process.once('SIGINT', () => {
    cleanup();
    process.exit(0);
  });
  process.once('SIGTERM', () => {
    cleanup();
    process.exit(0);
  });
}

/**
 * 打开 PGlite 文件数据库。
 *
 * 策略（x-herald 范式）：
 *   1. 取应用级锁——被存活进程持有时**立即失败**，绝不等待重试。
 *   2. 打开后失败（pgdata 真损坏，如 WASM abort）→ **向上抛错**，不删数据。
 *      恢复方式：从远端 sync-dev-db.ts 重建或用备份还原——由人决定，非自动清空。
 */
async function openPGlite(pgliteDir: string): Promise<DbInstance> {
  acquirePgliteLock(pgliteDir);
  try {
    const pglite = new PGlite(pgliteDir);
    // waitReady 确保 WASM 和 PostgreSQL 完成内部启动
    await pglite.waitReady;
    for (const sql of TABLE_SQLS) {
      await pglite.exec(sql);
    }
    // 记下原始句柄供 closeDb() 释放（见 g.__xpr_raw 注释：不释放会让测试以 99 退出）
    g.__xpr_raw = pglite as unknown as { close?: () => Promise<void> };
    return drizzlePglite(pglite, { schema });
  } catch (err) {
    log.error('db.pglite_open_failed', {
      dir: pgliteDir,
      error: err instanceof Error ? err.message : String(err),
      hint: 'pgdata 可能损坏。恢复：停掉全部进程后用 sync-dev-db.ts 从远端重建，或还原备份。绝不自动清空。',
    });
    throw err;
  }
}

/**
 * 检查进程是否存活（跨平台：macOS/Linux 用 kill(pid, 0)，Windows 用 tasklist）
 */
function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    // ESRCH = 进程不存在；EPERM = 存在但无权信号（视为存活）
    return (err as NodeJS.ErrnoException).code === 'EPERM';
  }
}

/**
 * 查询结果归一化：drizzle 的 `execute()` 在两种驱动下返回形态不同——
 * PGlite 返回 `{ rows: [...] }`，postgres-js（生产 `DATABASE_URL`）返回裸数组。
 * 任何直接消费 `execute()` 返回值的代码都必须经此处，否则在另一种驱动下会崩
 * （生产事故：实体创建全线 500，因 `result.rows[0]` 在 postgres-js 下为 undefined）。
 */
export function rowsOf(result: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(result)) return result as Array<Record<string, unknown>>;
  const rows = (result as { rows?: Array<Record<string, unknown>> } | null)?.rows;
  return rows ?? [];
}

async function initializeDb(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;

  if (databaseUrl) {
    log.info('db.connecting', { type: 'postgresql' });
    const sql = postgres(databaseUrl, { max: 5 });
    for (const stmt of TABLE_SQLS) {
      await sql.unsafe(stmt);
    }
    g.__xpr_raw = sql as unknown as { end?: () => Promise<void> };
    g.__xpr_db = drizzlePostgres(sql, { schema }) as unknown as DbInstance;
    log.info('db.ready', { type: 'postgresql' });
  } else {
    log.info('db.connecting', { type: 'pglite' });
    // 数据目录可覆盖（隔离测试环境：e2e 用独立目录，避免污染 dev 数据）
    const dbDir = process.env.XPR_DB_DIR ?? `${process.cwd()}/data/pglite`;
    const pgliteDir = dbDir;
    g.__xpr_db = await openPGlite(pgliteDir);
    log.info('db.ready', { type: 'pglite', dir: pgliteDir });
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

/**
 * 关闭数据库连接并清空单例（**测试收尾用**）。
 *
 * 为什么必须有：`ensureDb()` 打开 PGlite（内嵌 Postgres，带 worker 与文件句柄）后，
 * 若进程退出前无人释放，bun 测试运行器会判定「通过但有未清理资源」并以**退出码 99**
 * 结束——0 失败却非 0 退出，使任何以退出码判定成败的 CI 步骤失败（实测 apps/server
 * 的 api.test.ts：43 测试全过但 exit 99；加本函数后 exit 0）。
 *
 * 关闭方式封装在此处而非让调用方摸内部字段：PGlite 用 `close()`、postgres-js 用
 * `end()`，两者名字不同且属实现细节。**不要**用 process.exit(0) 绕过——那会掩盖
 * 真实的未清理异步错误，本函数的目的正是让它们能被暴露。
 *
 * 幂等：未初始化或重复调用均安全。
 */
export async function closeDb(): Promise<void> {
  const raw = g.__xpr_raw;
  g.__xpr_db = undefined;
  g.__xpr_dbInitPromise = undefined;
  g.__xpr_raw = undefined;
  if (!raw) return;
  try {
    if (raw.close) await raw.close();
    else if (raw.end) await raw.end();
  } catch (err) {
    log.warn('db.close_failed', { error: err instanceof Error ? err.message : String(err) });
  }
}

export function getDb(): DbInstance {
  if (!g.__xpr_db) {
    throw new Error('Database not initialized. Call ensureDb() first.');
  }
  return g.__xpr_db;
}

export type { DbInstance };
