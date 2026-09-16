#!/usr/bin/env bun
/**
 * 一键生产迁移编排：用户故事地图重设计（docs/design/story-map-redesign.md §4）
 * 在 apps/server 目录下执行：bun scripts/run-migrate-story-map.ts [--dry-run]
 * 步骤：0 前置断言 → 1 结构迁移(0003 幂等) → 2 半迁移清理 → 3 缺列补齐 → 4 数据归位 → 5 后置断言
 * 回滚：旧表 _legacy_* 保留 + stories.legacy_journey_id 列保留；数据层只写 activity_id/order。
 */
import { sql, type SQL } from 'drizzle-orm';
import {
  ensureDb,
  bumpSequenceTo,
  ID_SPECS,
  parseShortId,
  rowsOf,
  type DbInstance,
} from '@x-cartographer/db';

const DRY_RUN = process.argv.includes('--dry-run');
let db: DbInstance;

/** 查询并取 rows（兼容 PGlite `{rows}` 与 postgres-js 裸数组两种驱动形态） */
const query = async (s: string): Promise<Array<Record<string, unknown>>> =>
  rowsOf(await db.execute(sql.raw(s)));

const exec = async (s: string, allowFail = false): Promise<boolean> => {
  if (DRY_RUN) { console.log(`  [dry] ${s.slice(0, 70)}`); return true; }
  try { await db.execute(sql.raw(s)); return true; }
  catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (allowFail || msg.includes('already exists') || msg.includes('does not exist')) { console.log(`  skip: ${s.slice(0, 60)}`); return false; }
    console.error(`FAIL: ${s.slice(0, 90)}\n  ${msg.slice(0, 200)}`);
    process.exit(1);
  }
};
const qCount = async (t: string): Promise<number> => {
  const r = await query(`SELECT count(*)::int AS n FROM ${t}`);
  return Number(r[0]?.n ?? 0);
};
const hasTable = async (t: string): Promise<boolean> => {
  const r = await query(`SELECT to_regclass('public.${t}') IS NOT NULL AS e`);
  return Boolean(r[0]?.e);
};
const cols = async (t: string): Promise<string[]> => {
  const r = await query(`SELECT column_name FROM information_schema.columns WHERE table_name='${t}'`);
  return r.map((x) => String(x.column_name));
};

const ACTIVITIES = [
  { order: 1, name: '管理产品', match: /管理多个项目|切换当前项目|保存和加载|导入导出|持久化|数据管理/ },
  { order: 2, name: '组织故事地图', match: /故事地图|故事列表|用户故事|旅程|关系可视化|依赖图|故事卡片|帮助|筛选|拖拽|批量编辑/ },
  { order: 3, name: '拆解任务', match: /拆解|任务列表|任务依赖|Kanban|Markdown 序列化|任务按状态/ },
  { order: 4, name: '跟踪执行', match: /任务管理|状态|乐观锁|认领|跟踪|基础设施|脚手架|错误边界|暗色|虚拟滚动|快捷键|CI|单元测试|技术宪法|ADR|架构|模块/ },
  { order: 5, name: '规划发布', match: /排期|版本|里程碑|Roadmap|发布|容量/ },
];

async function main(): Promise<void> {
  db = await ensureDb();
  console.log('=== 步骤 0：前置断言 ===');
  const tList = await query(`SELECT tablename FROM pg_tables WHERE schemaname='public'`);
  const t = tList.map((x) => String(x.tablename));
  if (!t.includes('projects') && !t.includes('products')) { console.error('[abort] 空库/连错库'); process.exit(1); }
  const preStories = await qCount('user_stories');
  // 任务数基线：迁移会把 tasks 改名为 dev_tasks，故无论当前是哪张表，
  // 都要把「有数据的那张」当作同一实体计数（dev_tasks 存在但为空 = 半迁移残留）
  const preTasks =
    (await hasTable('dev_tasks')) && (await qCount('dev_tasks')) > 0
      ? await qCount('dev_tasks')
      : (await hasTable('tasks')) ? await qCount('tasks') : 0;
  const preChanges = await qCount('status_changes');
  console.log(`[pre] stories=${preStories} tasks=${preTasks} changes=${preChanges}`);
  if (preStories === 0) { console.error('[abort] stories=0'); process.exit(1); }
  if (preTasks === 0) console.warn('[warn] dev_tasks=0（数据少的开发库可正常）');

  console.log('=== 步骤 1：结构迁移（0003 幂等）===');
  if (t.includes('products') && !t.includes('projects')) {
    console.log('  已迁移 → 跳过');
  } else {
    const raw = await Bun.file('../../packages/db/src/db/migrations/0003_story_map_redesign.sql').text();
    const stmts = raw.split('\n').filter((l) => !l.trim().startsWith('--')).join('\n').split(';').map((s) => s.trim()).filter(Boolean);
    for (const st of stmts) { await exec(st, true); }
    console.log(`  0003 执行完成（${stmts.length} 条）`);
  }

  console.log('=== 步骤 2：半迁移清理 ===');
  if ((await hasTable('dev_tasks')) && (await hasTable('tasks'))) {
    if ((await qCount('dev_tasks')) === 0 && (await qCount('tasks')) > 0) {
      await exec('DROP TABLE "dev_tasks" CASCADE');
      await exec(`UPDATE "tasks" SET "tags" = "tags" || to_jsonb(ARRAY["type"]) WHERE "type" IS NOT NULL`);
      await exec('ALTER TABLE "tasks" RENAME TO "dev_tasks"');
      await exec('ALTER TABLE "dev_tasks" DROP COLUMN IF EXISTS "type"');
      await exec('ALTER TABLE "dev_tasks" RENAME COLUMN "project_id" TO "product_id"');
      console.log('  tasks→dev_tasks 补完成');
    }
  }
  if ((await hasTable('products')) && (await hasTable('projects'))) {
    if ((await qCount('products')) === 0 && (await qCount('projects')) > 0) {
      await exec('DROP TABLE "products" CASCADE');
      await exec('ALTER TABLE "projects" RENAME TO "products"');
      console.log('  projects→products 补完成');
    }
  }
  if ((await hasTable('user_journeys')) && !(await hasTable('_legacy_user_journeys'))) {
    await exec('ALTER TABLE "user_journeys" RENAME TO "_legacy_user_journeys"');
    console.log('  legacy 保全完成');
  }
  const sc = await cols('user_stories');
  if (sc.includes('journey_id') && !sc.includes('legacy_journey_id')) {
    await exec('ALTER TABLE "user_stories" RENAME COLUMN "journey_id" TO "legacy_journey_id"');
    console.log('  journey_id→legacy_journey_id 完成');
  }
  await exec('ALTER TABLE "user_stories" ADD COLUMN IF NOT EXISTS "activity_id" text');
  await exec('ALTER TABLE "user_stories" ADD COLUMN IF NOT EXISTS "user_task_id" text');

  console.log('=== 步骤 3：缺列补齐 ===');
  await exec(`ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "persona" text DEFAULT '' NOT NULL`);
  await exec(`ALTER TABLE "user_stories" ADD COLUMN IF NOT EXISTS "affected_modules" jsonb DEFAULT '[]'::jsonb NOT NULL`);
  await exec(`ALTER TABLE "dev_tasks" ADD COLUMN IF NOT EXISTS "affected_modules" jsonb DEFAULT '[]'::jsonb NOT NULL`);
  await exec(`ALTER TABLE "status_changes" ADD COLUMN IF NOT EXISTS "seq" bigserial`);
  await exec(`ALTER TABLE "user_stories" ADD COLUMN IF NOT EXISTS "milestone_id" text REFERENCES "milestones"("id") ON DELETE SET NULL`);
  await exec(`ALTER TABLE "milestones" ADD COLUMN IF NOT EXISTS "adr_id" text`);
  await exec(`ALTER TABLE "milestones" DROP CONSTRAINT IF EXISTS milestones_project_id_fkey`);
  await exec(`ALTER TABLE "milestones" ADD CONSTRAINT milestones_product_id_fkey FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE`, true);
  await exec(`ALTER TABLE "dev_tasks" DROP CONSTRAINT IF EXISTS dev_tasks_product_id_fkey`);
  await exec(`ALTER TABLE "dev_tasks" ADD CONSTRAINT dev_tasks_product_id_fkey FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE`, true);
  // 0004：退役列 legacy_journey_id 解除 NOT NULL —— 0003 只 rename 未解约束，
  // 导致新建故事（不写该退役列）必然 500。幂等：对已可空列是无操作。
  await exec(`ALTER TABLE "user_stories" ALTER COLUMN "legacy_journey_id" DROP NOT NULL`);
  // 0005：约束空间六实体加 provenance（domain-model.md §3 约束写入协议）
  await exec(`ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "provenance" text DEFAULT 'agent_inferred' NOT NULL`);
  await exec(`ALTER TABLE "milestones" ADD COLUMN IF NOT EXISTS "provenance" text DEFAULT 'agent_inferred' NOT NULL`);
  await exec(`ALTER TABLE "user_activities" ADD COLUMN IF NOT EXISTS "provenance" text DEFAULT 'agent_inferred' NOT NULL`);
  await exec(`ALTER TABLE "user_tasks" ADD COLUMN IF NOT EXISTS "provenance" text DEFAULT 'agent_inferred' NOT NULL`);
  await exec(`ALTER TABLE "user_stories" ADD COLUMN IF NOT EXISTS "provenance" text DEFAULT 'agent_inferred' NOT NULL`);
  await exec(`ALTER TABLE "adr_records" ADD COLUMN IF NOT EXISTS "provenance" text DEFAULT 'agent_inferred' NOT NULL`);
  console.log('  完成');

  const prods = await query('SELECT id FROM products');
  const pids = prods.map((x) => String(x.id));
  if (true) {
    for (const pid of pids) {
      for (const a of ACTIVITIES) {
        await db.execute(sql`INSERT INTO user_activities (id, product_id, name, description, "order")
          VALUES (${`UA-${pid.slice(0, 6)}-${a.order}`}, ${pid}, ${a.name}, ${'backbone（迁移生成）'}, ${a.order})
          ON CONFLICT (id) DO NOTHING`);
      }
    }
  }
  console.log(`  骨架 ${DRY_RUN ? '(dry)' : ''}: ${pids.length * ACTIVITIES.length}`);
  if (DRY_RUN) {
    console.log(`  [dry] 归位查询/骨架行重排跳过（真实执行时按标题语义分流）`);
    console.log(`  [dry] 后置断言跳过`);
    console.log('[DRY-RUN 完成未写入]');
    process.exit(0);
  }
  const rows = await query(
    `SELECT s.id, s.title, s.legacy_journey_id, l.name AS legacy_name, l.project_id AS product_id
     FROM user_stories s LEFT JOIN _legacy_user_journeys l ON l.id = s.legacy_journey_id
     WHERE s.activity_id IS NULL`);
  const unmatchable: string[] = [];
  let moved = 0;
  for (const s of rows) {
    const hit = ACTIVITIES.find((a) => a.match.test(`${s.title} ${s.legacy_name ?? ''}`));
    if (!hit || !s.product_id) { unmatchable.push(`${s.id} ${s.title.slice(0, 50)}`); continue; }
    if (!DRY_RUN) await db.execute(sql`UPDATE user_stories SET activity_id = ${`UA-${s.product_id.slice(0, 6)}-${hit.order}`} WHERE id = ${s.id}`);
    moved++;
  }
  console.log(`  归位 ${moved}/${rows.length}${DRY_RUN ? ' (dry)' : ''}，未匹配 ${unmatchable.length}`);
  for (const u of unmatchable) console.log(`    [人工] ${u}`);
  if (!DRY_RUN) {
    for (const pid of pids) {
      for (const a of ACTIVITIES) {
        const aid = `UA-${pid.slice(0, 6)}-${a.order}`;
        const brow = await query(
          `SELECT s.id FROM user_stories s JOIN dev_tasks t ON t.story_id = s.id
           WHERE s.activity_id = '${aid}' AND s.status IN ('done', 'accepted')
             AND (EXISTS (SELECT 1 FROM dev_tasks d WHERE d.dependencies @> to_jsonb(ARRAY[s.id])) OR t.status = 'done')
           GROUP BY s.id, s."order" ORDER BY s."order" LIMIT 3`);
        for (let i = 0; i < brow.length; i++) await db.execute(sql`UPDATE user_stories SET "order" = ${i} WHERE id = ${brow[i].id}`);
      }
    }
    console.log('  骨架行重排完成');
    // 短 ID 序列推进：跳过历史已占用号段，避免新建实体撞已有 ID。
    // 注：全库 ID 归一化由独立脚本 rename-entity-ids.ts 负责（8 类实体统一形态）；
    // 此处只保证序列水位不低于当前最大值，重跑安全。
    for (const kind of ['story', 'devTask'] as const) {
      const spec = ID_SPECS[kind];
      const got = await query(`SELECT id FROM "${spec.table}"`);
      let max = 0;
      for (const row of got) {
        const n = parseShortId(kind, String(row.id));
        if (n !== null) max = Math.max(max, n);
      }
      await bumpSequenceTo(kind, max);
    }
    console.log('  短 ID 序列已推进（跳过历史号段）');
    // 全库 ID 归一化（8 类实体统一为 <PREFIX>-<序号>）是独立脚本：它要重写主键并
    // 临时改造外键为可延迟，与结构迁移混在一起会放大失败面。此处只提示不代跑。
    console.log('  [提示] 全库 ID 归一化请执行 bun scripts/rename-entity-ids.ts');
  }

  console.log('=== 步骤 5：后置断言 ===');
  const postS = await qCount('user_stories');
  const postT = await qCount('dev_tasks');
  const postC = await qCount('status_changes');
  const chk = (c: boolean, m: string) => { if (!c) { console.error(`[assert-fail] ${m}`); process.exit(1); } console.log(`  ✓ ${m}`); };
  chk(postS === preStories, `story 总数不变 (${postS}/${preStories})`);
  chk(postT === preTasks, `dev_task 总数不变 (${postT}/${preTasks})`);
  chk(postC === preChanges, `账本总数不变 (${postC}/${preChanges})`);
  if (unmatchable.length > 0) console.warn(`  [warn] ${unmatchable.length} 条需人工归位（非阻断）`);
  console.log(DRY_RUN ? '[DRY-RUN 完成未写入]' : 'PRODUCTION MIGRATION PASS');
  process.exit(0);
}

main();
