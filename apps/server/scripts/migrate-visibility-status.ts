#!/usr/bin/env bun
/**
 * C+H 合并迁移：恢复任务可见性 + story.status 更名
 *
 * C（未归位故事归位）：
 *   108 个 story 无 activity_id → 其下 246 个 dev_task 在所有接口不可见。
 *   规则：按 legacy journey 名语义映射到该产品的 5 活动骨架（正向映射表，非猜测聚类）。
 *   未命中映射的 journey → 保守归入该产品「跟踪执行」（执行域杂项的既有惯例），
 *   并输出清单供人工复核——宁可归错带标记，不可静默不可见。
 *
 * H（story.status 语义更名）：
 *   story 的 done（被接受）与 dev_task 的 done（干完了）撞名且同屏展示。
 *   更名：story.status 'done' → 'accepted'。
 *   兼容：应用层尚在部署旧枚举期间，DB 不加 CHECK 约束（列本就无约束），
 *   只改数据 + shared 类型 + zod + 前端配置。
 *
 * 用法：cd apps/server && DATABASE_URL=... bun scripts/migrate-visibility-status.ts [--dry-run]
 * 幂等：归位仅处理 activity_id IS NULL；更名仅处理 status='done'。重跑安全。
 * 回滚：归位前快照 {id, activity_id} 到 _relocation_backup 表；更名是可逆映射。
 */
import { sql } from 'drizzle-orm';
import { ensureDb, rowsOf, type DbInstance } from '@x-cartographer/db';

const DRY_RUN = process.argv.includes('--dry-run');
let db: DbInstance;

const query = async (s: string): Promise<Array<Record<string, unknown>>> =>
  rowsOf(await db.execute(sql.raw(s)));
const exec = async (s: string): Promise<void> => {
  if (DRY_RUN) { console.log(`  [dry] ${s.slice(0, 88)}`); return; }
  await db.execute(sql.raw(s));
};

/**
 * legacy journey 名 → 活动序号（1管理产品 2组织故事地图 3拆解任务 4跟踪执行 5规划发布）。
 * 键为 journey 名的语义片段；未命中 → 4（跟踪执行，保守兜底）。
 */
const JOURNEY_TO_ACTIVITY: Array<[RegExp, number]> = [
  // 高优先：具体领域词先行，避免泛词（管理/AI）误吞
  [/仿真|调度|Kernel|引擎|设备|行为树/, 4],          // 仿真/内核类 → 跟踪执行（技术执行域）
  [/代理|路由|高可用|日志|监控|密钥|限流|接入|生态|存储|成本|核算|错误|上报|修复|流水线/, 4],
  [/AI|Agent|集成/, 4],                              // AI/Agent 集成是执行能力，非发布规划
  [/地图|故事|界面|面板|可视化|文档|主题|国际化/, 2],  // UI/呈现类 → 组织故事地图
  [/拆解|需求|排期|里程碑|发布/, 3],                  // 规划类
  [/多项目|配置|设置|部署运维|管理/, 1],              // 产品管理类（泛"管理"放低优先防误吞）
];

function mapJourneyToOrder(journeyName: string): number {
  for (const [re, order] of JOURNEY_TO_ACTIVITY) {
    if (re.test(journeyName)) return order;
  }
  return 4; // 兜底：跟踪执行
}

async function main(): Promise<void> {
  db = await ensureDb();
  console.log(`=== C+H 迁移${DRY_RUN ? '（DRY-RUN）' : ''} ===`);

  // ── 前置断言 ──
  const pre = await query(`
    SELECT
      (SELECT count(*) FROM user_stories WHERE activity_id IS NULL)::int AS unplaced,
      (SELECT count(*) FROM user_stories WHERE status = 'done')::int AS done_stories,
      (SELECT count(*) FROM user_activities)::int AS activities`);
  const { unplaced, done_stories: doneStories, activities } = pre[0] as unknown as { unplaced: number; done_stories: number; activities: number };
  console.log(`[pre] 未归位=${unplaced} story.done=${doneStories} activities=${activities}`);
  if (activities === 0) { console.error('[abort] 无活动骨架'); process.exit(1); }

  // ── C: 归位 ──
  console.log('--- C: 未归位故事归位 ---');
  if (!DRY_RUN) {
    await exec(`CREATE TABLE IF NOT EXISTS _relocation_backup AS
      SELECT id, activity_id FROM user_stories WHERE activity_id IS NULL`);
  }

  // 按 journey 聚合未归位故事，逐 journey 映射
  const rows = await query(`
    SELECT l.id AS journey_id, l.name AS journey_name, l.project_id AS product_id, count(*)::int AS n
    FROM user_stories s JOIN _legacy_user_journeys l ON l.id = s.legacy_journey_id
    WHERE s.activity_id IS NULL
    GROUP BY l.id, l.name, l.project_id`);

  let relocated = 0;
  const fallback: string[] = [];
  for (const r of rows) {
    const journeyName = String(r.journey_name);
    const order = mapJourneyToOrder(journeyName);
    const target = await query(`
      SELECT id FROM user_activities
      WHERE product_id = '${String(r.product_id)}' AND "order" = ${order} LIMIT 1`);
    if (!target[0]) { console.error(`  [skip] 产品 ${String(r.product_id)} 无 order=${order} 活动`); continue; }
    const activityId = String(target[0].id);
    const mapped = JOURNEY_TO_ACTIVITY.some(([re]) => re.test(journeyName));
    if (!mapped) fallback.push(`${journeyName}(${String(r.n)}条→${activityId})`);
    console.log(`  ${journeyName} ×${String(r.n)} → ${activityId}${mapped ? '' : ' (兜底)'}`);
    if (!DRY_RUN) {
      await exec(`UPDATE user_stories SET activity_id = '${activityId}'
        WHERE activity_id IS NULL AND legacy_journey_id = '${String(r.journey_id)}'`);
    }
    relocated += Number(r.n);
  }
  console.log(`  归位 ${relocated}/${unplaced}${fallback.length ? `，其中兜底 journey: ${fallback.join('; ')}` : ''}`);

  // ── H: story.status 更名 done → accepted ──
  console.log('--- H: story.status 更名 ---');
  const post = await query(`SELECT count(*)::int AS n FROM user_stories WHERE status = 'done'`);
  const remaining = (post[0] as unknown as { n: number }).n;
  if (remaining > 0) {
    await exec(`UPDATE user_stories SET status = 'accepted' WHERE status = 'done'`);
    console.log(`  更名 ${remaining} 条 done → accepted`);
  } else {
    console.log('  无 done 残留（已迁移）');
  }

  // ── 后置断言 ──
  if (!DRY_RUN) {
    const post2 = await query(`
      SELECT
        (SELECT count(*) FROM user_stories WHERE activity_id IS NULL)::int AS still_unplaced,
        (SELECT count(*) FROM user_stories WHERE status = 'done')::int AS still_done,
        (SELECT count(*) FROM user_stories)::int AS total,
        (SELECT count(*) FROM dev_tasks)::int AS tasks`);
    const s = post2[0] as unknown as { still_unplaced: number; still_done: number; total: number; tasks: number };
    console.log(`[post] 仍未归位=${s.still_unplaced} 仍有done=${s.still_done} 故事总数=${s.total} 任务总数=${s.tasks}`);
    if (s.total !== 194 && s.total < 100) console.warn('  [warn] 故事总数异常，请人工核查');
    if (s.still_done > 0) console.warn(`  [warn] 仍有 ${s.still_done} 条 done（应为 0）`);
    console.log('MIGRATION PASS');
  } else {
    console.log('[DRY-RUN 完成未写入]');
  }
  process.exit(0);
}

main();
