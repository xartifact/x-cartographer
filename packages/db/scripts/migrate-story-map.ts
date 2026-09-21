#!/usr/bin/env bun
/**
 * 数据迁移脚本：用户故事地图重设计（docs/design/story-map-redesign.md §4）
 *
 * 前置：已执行 0003_story_map_redesign.sql（结构迁移），本脚本做数据归位：
 *   1. 生成 5 个 UserActivity 骨架（每产品）
 *   2. 按 §4.2/§4.3 分流规则重挂 user_stories.activity_id（依据 legacy_journey_id 映射表）
 *   3. 骨架行判定（done 且被依赖的基础能力 → 深度序最前）
 *   4. 前置/后置断言（量级不符即中止）
 *
 * 回滚：本脚本只写 activity_id/order，不删任何行；回滚 = UPDATE user_stories SET activity_id = NULL。
 *
 * 用法：bun run packages/db/scripts/migrate-story-map.ts [--db-dir <pglite 目录>]
 */
import { ensureDb, rowsOf } from '../src/db/client';
import { sql, type SQL } from 'drizzle-orm';

const args = process.argv.slice(2);
const dbDirIdx = args.indexOf('--db-dir');
if (dbDirIdx >= 0) process.env.XPR_DB_DIR = args[dbDirIdx + 1];
const DRY_RUN = args.includes('--dry-run');

// ── Activity 骨架定义（§4.3 归位表）──────────────────────────────
const ACTIVITIES = [
  { order: 1, name: '管理产品', match: (t: string, j: string) =>
      /管理多个项目|切换当前项目|保存和加载|导入导出|持久化|数据管理/.test(t) },
  { order: 2, name: '组织故事地图', match: (t: string, j: string) =>
      /故事地图|故事列表|用户故事|旅程|关系可视化|依赖图|故事卡片|帮助|筛选|拖拽|批量编辑/.test(t + j) },
  { order: 3, name: '拆解任务', match: (t: string, j: string) =>
      /拆解|任务列表|任务依赖|Kanban|Markdown 序列化|任务按状态/.test(t + j) },
  { order: 4, name: '跟踪执行', match: (t: string, j: string) =>
      /任务管理|状态|乐观锁|认领|跟踪|基础设施|脚手架|错误边界|暗色|虚拟滚动|快捷键|CI|单元测试|技术宪法|ADR|架构|模块/.test(t + j) },
  { order: 5, name: '规划发布', match: (t: string, j: string) =>
      /排期|版本|里程碑|Roadmap|发布|容量/.test(t + j) },
];

// ── 连接（复用 client.ts 的健壮打开逻辑）─────────────────────────
let db: Awaited<ReturnType<typeof ensureDb>>;
// 必须走 rowsOf()：PGlite 的 execute() 返回 { rows: [...] }，postgres-js（生产
// DATABASE_URL）返回**裸数组**。本地 cast 只在 PGlite 下成立，生产上 .rows 为
// undefined（同类事故已在 client.ts:288 注释里记载过一次）。
const q = async <T>(query: SQL): Promise<T[]> =>
  rowsOf(await db.execute(query)) as T[];

async function main() {
  db = await ensureDb();
  // ── 前置断言 ──
  const [{ n: storyN }] = await q<{ n: number }>(sql`SELECT count(*)::int AS n FROM user_stories`);
  const [{ n: taskN }] = await q<{ n: number }>(sql`SELECT count(*)::int AS n FROM dev_tasks`);
  const [{ n: changeN }] = await q<{ n: number }>(sql`SELECT count(*)::int AS n FROM status_changes`);
  const [{ n: legacyN }] = await q<{ n: number }>(sql`SELECT count(*)::int AS n FROM _legacy_user_journeys`);
  console.log(`[pre] stories=${storyN} dev_tasks=${taskN} status_changes=${changeN} legacy_journeys=${legacyN}`);
  if (storyN === 0) {
    console.error('[abort] stories=0，疑似连错库或未执行 0003 结构迁移');
    process.exit(1);
  }
  if (taskN === 0) console.warn('[warn] dev_tasks=0（数据少的开发库可正常）');
  const [{ n: unassigned }] = await q<{ n: number }>(
    sql`SELECT count(*)::int AS n FROM user_stories WHERE activity_id IS NULL`
  );
  if (unassigned === 0) {
    console.log('[skip] 所有 story 已有 activity_id（迁移已完成）');
    process.exit(0);
  }

  // ── 1. 生成 Activity 骨架（每产品）───────────────────────────
  const products = await q<{ id: string; name: string }>('SELECT id, name FROM products');
  const activityIdByKey = new Map<string, string>();
  if (!DRY_RUN) {
    for (const p of products) {
      for (const a of ACTIVITIES) {
        const id = `UA-${p.id.slice(0, 6)}-${a.order}`;
        await db.execute(
          sql`INSERT INTO user_activities (id, product_id, name, description, "order")
           VALUES (${id}, ${p.id}, ${a.name}, ${'用户故事地图 backbone 活动（迁移生成）'}, ${a.order})
           ON CONFLICT (id) DO NOTHING`
        );
        activityIdByKey.set(`${p.id}:${a.order}`, id);
      }
    }
  }
  console.log(`[activities] ${DRY_RUN ? '(dry-run)' : ''} 生成 ${products.length * ACTIVITIES.length} 个骨架`);

  // ── 2. story 归位 ────────────────────────────────────────────
  const stories = await q<{ id: string; title: string; legacy_journey_id: string | null; legacy_name: string | null; product_id: string }>(
    sql`SELECT s.id, s.title, s.journey_id AS legacy_journey_id,
            l.name AS legacy_name, l.project_id AS product_id
     FROM user_stories s
     LEFT JOIN _legacy_user_journeys l ON l.id = s.journey_id
     WHERE s.activity_id IS NULL`
  );
  const unmatchable: Array<{ id: string; title: string }> = [];
  let moved = 0;
  for (const s of stories) {
    const hay = `${s.title} ${s.legacy_name ?? ''}`;
    const hit = ACTIVITIES.find((a) => a.match(s.title, s.legacy_name ?? ''));
    if (!hit) {
      unmatchable.push({ id: s.id, title: s.title });
      continue;
    }
    const activityId = activityIdByKey.get(`${s.product_id}:${hit.order}`);
    if (!activityId || DRY_RUN) continue;
    await db.execute(sql`UPDATE user_stories SET activity_id = ${activityId} WHERE id = ${s.id}`);
    moved++;
  }
  console.log(`[stories] 归位 ${moved}/${stories.length}${DRY_RUN ? ' (dry-run，未写)' : ''}`);
  if (unmatchable.length > 0) {
    console.warn('[unmatchable] 未匹配（需人工归位）：');
    for (const u of unmatchable) console.warn(`  ${u.id} ${u.title.slice(0, 50)}`);
  }

  // ── 3. 骨架行判定（done 且被依赖 → order 提到最前）────────────
  if (!DRY_RUN) {
    for (const p of products) {
      const acts = await q<{ id: string }>(
        sql`SELECT id FROM user_activities WHERE product_id = ${p.id} ORDER BY "order"`
      );
      for (const a of acts) {
        // 被依赖的 done story：其 id 出现在其他 dev_task 的 dependencies 里，或自身 done 且有 dev_task
        const backbone = await q<{ id: string }>(
          sql`SELECT s.id FROM user_stories s
           JOIN dev_tasks t ON t.story_id = s.id
           WHERE s.activity_id = ${a.id} AND s.status = 'done'
             AND (
               EXISTS (SELECT 1 FROM dev_tasks d WHERE d.dependencies @> to_jsonb(ARRAY[s.id]))
               OR t.status = 'done'
             )
           GROUP BY s.id, s."order"
           ORDER BY s."order" LIMIT 3`
        );
        for (let i = 0; i < backbone.length; i++) {
          await db.execute(sql`UPDATE user_stories SET "order" = ${i} WHERE id = ${backbone[i].id}`);
        }
      }
    }
    console.log('[skeleton] 骨架行 order 重排完成');
  }

  // ── 后置断言 ──
  const [{ n: storyAfter }] = await q<{ n: number }>(sql`SELECT count(*)::int AS n FROM user_stories`);
  const [{ n: taskAfter }] = await q<{ n: number }>(sql`SELECT count(*)::int AS n FROM dev_tasks`);
  const [{ n: changeAfter }] = await q<{ n: number }>(sql`SELECT count(*)::int AS n FROM status_changes`);
  const [{ n: stillNull }] = await q<{ n: number }>(
    sql`SELECT count(*)::int AS n FROM user_stories WHERE activity_id IS NULL`
  );
  assert(storyAfter === storyN, `story 总数不变 (${storyAfter}/${storyN})`);
  assert(taskAfter === taskN, `dev_task 总数不变 (${taskAfter}/${taskN})`);
  assert(changeAfter === changeN, `账本总数不变 (${changeAfter}/${changeN})`);
  console.log(`[post] 未归位 story：${stillNull}${unmatchable.length ? `（含 ${unmatchable.length} 条需人工判定）` : ''}`);
  console.log('MIGRATION DATA PASS');
  process.exit(0);
}

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error(`[assert-fail] ${msg}`);
    process.exit(1);
  }
  console.log(`✓ ${msg}`);
}

main();
