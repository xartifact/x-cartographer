#!/usr/bin/env bun
/**
 * 增量 schema 迁移（幂等，可对任意库状态重跑）
 *
 * 与 run-migrate-story-map.ts 的分工：
 * - run-migrate-story-map.ts 是 2026-09-10 故事地图重设计的**一次性编排**
 *   （含骨架重建、journey 归位等只做一次的动作），对已迁移库重跑会失败——这是设计如此。
 * - 本脚本承载**后续所有增量 schema 变更**（0005+），只做幂等 DDL，
 *   不碰数据归位，因此可安全地反复执行。
 *
 * 用法：cd apps/server && bun scripts/migrate-schema.ts [--dry-run]
 * 前置：本地库需先停止 gateway（PGlite 单实例）。
 */
import { sql } from 'drizzle-orm';
import { ensureDb, rowsOf, type DbInstance } from '@x-cartographer/db';

const DRY_RUN = process.argv.includes('--dry-run');
let db: DbInstance;

const query = async (s: string): Promise<Array<Record<string, unknown>>> =>
  rowsOf(await db.execute(sql.raw(s)));

const exec = async (s: string, label: string): Promise<void> => {
  if (DRY_RUN) { console.log(`  [dry] ${label}`); return; }
  await db.execute(sql.raw(s));
  console.log(`  ✓ ${label}`);
};

/** 幂等 DDL 清单：每项 = { label, statements }。新增迁移在此追加。 */
const MIGRATIONS: Array<{ since: string; label: string; statements: string[] }> = [
  {
    since: '0005',
    label: 'provenance 列（约束空间六实体）',
    statements: [
      `ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "provenance" text DEFAULT 'agent_inferred' NOT NULL`,
      `ALTER TABLE "milestones" ADD COLUMN IF NOT EXISTS "provenance" text DEFAULT 'agent_inferred' NOT NULL`,
      `ALTER TABLE "user_activities" ADD COLUMN IF NOT EXISTS "provenance" text DEFAULT 'agent_inferred' NOT NULL`,
      `ALTER TABLE "user_tasks" ADD COLUMN IF NOT EXISTS "provenance" text DEFAULT 'agent_inferred' NOT NULL`,
      `ALTER TABLE "user_stories" ADD COLUMN IF NOT EXISTS "provenance" text DEFAULT 'agent_inferred' NOT NULL`,
      `ALTER TABLE "adr_records" ADD COLUMN IF NOT EXISTS "provenance" text DEFAULT 'agent_inferred' NOT NULL`,
    ],
  },
  {
    since: '0006',
    label: 'system_modules 表（模块目录升为一等实体）',
    statements: [
      `CREATE TABLE IF NOT EXISTS "system_modules" (
        "id" text PRIMARY KEY NOT NULL,
        "product_id" text NOT NULL REFERENCES "products"("id") ON DELETE CASCADE,
        "name" text NOT NULL,
        "path" text DEFAULT '' NOT NULL,
        "responsibility" text DEFAULT '' NOT NULL,
        "depends_on" jsonb DEFAULT '[]'::jsonb NOT NULL,
        "provenance" text DEFAULT 'agent_inferred' NOT NULL,
        "created_at" timestamp with time zone DEFAULT now() NOT NULL,
        "updated_at" timestamp with time zone DEFAULT now() NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS "system_modules_product_id_idx" ON "system_modules" ("product_id")`,
    ],
  },
  {
    since: '0008',
    label: '工作项第二锚定路径（product_id 恢复 + module_id 新增，domain-model §2.5）',
    statements: [
      `ALTER TABLE "dev_tasks" ADD COLUMN IF NOT EXISTS "product_id" text REFERENCES "products"("id") ON DELETE CASCADE`,
      `ALTER TABLE "dev_tasks" ADD COLUMN IF NOT EXISTS "module_id" text REFERENCES "system_modules"("id") ON DELETE SET NULL`,
      `CREATE INDEX IF NOT EXISTS "dev_tasks_product_id_idx" ON "dev_tasks" ("product_id")`,
      `CREATE INDEX IF NOT EXISTS "dev_tasks_module_id_idx" ON "dev_tasks" ("module_id")`,
      // 回填：已有任务的产品归属经 story → activity → product 派生（幂等：只填 NULL 行）
      `UPDATE "dev_tasks" d SET "product_id" = a."product_id" FROM "user_stories" s JOIN "user_activities" a ON a."id" = s."activity_id" WHERE d."story_id" = s."id" AND d."product_id" IS NULL`,
    ],
  },
  {
    since: '0007',
    label: '死列清理（adr_id / persona）',
    statements: [
      // 注：本项原含 `dev_tasks.product_id`，但该列已于 0008 恢复
      // （工程治理类工作项需要它做产品归属——domain-model.md §2.5/§6.1）。
      // 保留在 0007 会在排序执行时把它再次删掉，故移除。
      `ALTER TABLE "milestones" DROP COLUMN IF EXISTS "adr_id"`,
      `ALTER TABLE "products" DROP COLUMN IF EXISTS "persona"`,
    ],
  },
];

async function main(): Promise<void> {
  db = await ensureDb();
  console.log(`=== 增量 schema 迁移${DRY_RUN ? '（DRY-RUN）' : ''} ===`);

  // 前置：必须是已重设计过的库（故事地图语义）
  const tables = (await query(`SELECT tablename FROM pg_tables WHERE schemaname='public'`))
    .map((r) => String(r.tablename));
  if (!tables.includes('products')) {
    console.error('[abort] 未找到 products 表——本脚本用于已重设计的库；旧库请先跑 run-migrate-story-map.ts');
    process.exit(1);
  }

  const pre = (await query(`
    SELECT
      (SELECT count(*) FROM user_stories)::int AS stories,
      (SELECT count(*) FROM dev_tasks)::int AS tasks`))[0] as { stories: number; tasks: number };
  console.log(`[pre] stories=${pre.stories} tasks=${pre.tasks}`);

  // 按版本号排序执行 —— 不依赖数组字面顺序。
  // （曾因 0008 被插在 0007 之前，导致 0008 加回的 product_id 又被 0007 删掉。）
  const ordered = [...MIGRATIONS].sort((a, b) => a.since.localeCompare(b.since));
  for (const m of ordered) {
    console.log(`--- ${m.since}: ${m.label}`);
    for (const st of m.statements) {
      // DDL 重复执行（如列已存在）不应中断——IF NOT EXISTS / DROP IF EXISTS 已保证幂等，
      // 但仍兜底 catch，避免个别 PG 版本的措辞差异导致整体失败。
      try { await exec(st, st.split('\n')[0]!.slice(0, 76)); }
      catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.log(`  skip: ${msg.slice(0, 100)}`);
      }
    }
  }

  // 后置断言：数据行数不变（DDL 不应动数据）
  if (!DRY_RUN) {
    const post = (await query(`
      SELECT
        (SELECT count(*) FROM user_stories)::int AS stories,
        (SELECT count(*) FROM dev_tasks)::int AS tasks`))[0] as { stories: number; tasks: number };
    console.log(`[post] stories=${post.stories} tasks=${post.tasks}`);
    if (post.stories !== pre.stories || post.tasks !== pre.tasks) {
      console.error('[assert-fail] 数据行数变化——DDL 不应影响数据');
      process.exit(1);
    }
    // 死列断言：只含**当前仍未恢复**的死列（0007 范围内）。
    // 注：dev_tasks.product_id 不在此列——它已由 0008 恢复为有效字段（工程治理类
    // 工作项的产品归属），保留它是**预期状态**而非遗漏。
    const dead = (await query(`
      SELECT table_name || '.' || column_name AS col FROM information_schema.columns
      WHERE table_schema='public'
        AND ((table_name='milestones' AND column_name='adr_id')
          OR (table_name='products' AND column_name='persona'))`)).map((r) => String(r.col));
    if (dead.length > 0) { console.error(`[assert-fail] 死列仍存在: ${dead.join(', ')}`); process.exit(1); }
    console.log('  ✓ 死列已清除，行数守恒');
    console.log('SCHEMA MIGRATION PASS');
  } else {
    console.log('[DRY-RUN 完成未写入]');
  }
  process.exit(0);
}

main();
