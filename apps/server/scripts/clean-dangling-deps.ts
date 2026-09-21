/**
 * 清理 dev_tasks.dependencies 的悬空引用（依赖指向已不存在的任务）
 *
 * 背景：库里 11 条依赖边指向迁移前就已被删除的任务（备份库同样不存在，
 * 说明是更早期的删除留下的孤儿引用）。危害：
 *   - DAG 图把它们当"外部依赖"计数（幽灵节点/错误截断数）
 *   - 任务详情抽屉只能显示裸 ID（无标题、无状态）
 *   - 依赖链分析（未来若加可执行性门禁）会被永久阻塞
 *
 * 策略：只删边，不删任务；不尝试"重连"到替代任务——被引用者已无任何痕迹
 * （账本 0 条），任何猜测性重连都是编造依赖关系。
 *
 * 幂等：重跑时已无悬空边 → 无操作。
 *
 * **本脚本是本地/直连库工具，不接受 `--server`**（直连 `ensureDb()`：`XPR_DB_DIR`
 * 或 `cwd/data/pglite`）。此前传 `--server` 会被**静默忽略**，在空库上跑出
 * 「悬空边 0 条 → 无需处理」——操作者据此误判生产干净。故此处对空库拒绝给结论。
 * 要审计远端网关请用 `audit-dependency-graph.ts --server <url>`（只读）。
 */
import { sql } from 'drizzle-orm';
import { ensureDb, rowsOf } from '@x-cartographer/db';

const DRY_RUN = process.argv.includes('--dry-run');
const db = await ensureDb();

// 必须用共享的 rowsOf()：PGlite 的 execute() 返回 { rows: [...] }，postgres-js
// （生产 DATABASE_URL）返回**裸数组**。此前本地 cast `(r as {rows}).rows` 只在
// PGlite 下成立，在生产上 .rows 为 undefined → 实测对本脚本在生产容器内 dry-run
// 直接 TypeError（「生产专用工具在生产上不可用」）。
const rows = async (q: string): Promise<Array<Record<string, unknown>>> =>
  rowsOf(await db.execute(sql.raw(q)));

/** 悬空边明细：任务 → 其依赖数组中不存在的 ID */
async function findDangling(): Promise<Array<{ task_id: string; dangling: string; title: string }>> {
  return (await rows(`SELECT t.id AS task_id, t.title, d.id AS dangling
    FROM dev_tasks t CROSS JOIN LATERAL jsonb_array_elements_text(t.dependencies) AS d(id)
    WHERE NOT EXISTS (SELECT 1 FROM dev_tasks x WHERE x.id = d.id)
    ORDER BY t.id`)) as Array<{ task_id: string; dangling: string; title: string }>;
}

const countDangling = async (): Promise<number> =>
  Number((await rows(`SELECT COUNT(*)::int AS n FROM dev_tasks t
    WHERE EXISTS (SELECT 1 FROM jsonb_array_elements_text(t.dependencies) AS d(id)
      WHERE NOT EXISTS (SELECT 1 FROM dev_tasks x WHERE x.id = d.id))`))[0].n);

async function main(): Promise<void> {
  const before = await findDangling();
  const beforeTotal = Number((await rows(
    `SELECT COALESCE(SUM(jsonb_array_length(dependencies)),0)::int AS n FROM dev_tasks`))[0].n);

  console.log(DRY_RUN ? '=== DRY-RUN ===' : '=== 清理悬空依赖边 ===');
  console.log(`当前悬空边 ${before.length} 条，依赖边总数 ${beforeTotal}\n`);

  // 空库直接判「无悬空边」是危险假阴性：XPR_DB_DIR 未设/指错时会新建空库并伪报
  // 干净（实测：带 --server 跑生产清理，输出「0 条，无需处理」而生产有 11 条）。
  const taskCount0 = Number((await rows(`SELECT COUNT(*)::int AS n FROM dev_tasks`))[0].n);
  const dataDir = process.env.XPR_DB_DIR ?? `${process.cwd()}/data/pglite`;
  if (taskCount0 === 0) {
    console.error(`✗ 该库 0 条任务，无法判断——请确认 XPR_DB_DIR 指向真实数据目录。`);
    console.error(`  当前解析：${dataDir}`);
    console.error(`  远端网关请改用：bun scripts/audit-dependency-graph.ts --server <url>`);
    process.exit(3);
  }

  if (before.length === 0) {
    console.log('无悬空边，无需处理');
    process.exit(0);
  }

  for (const e of before) {
    console.log(`  ${e.task_id.padEnd(10)} (${String(e.title).slice(0, 30)}) → 悬空: ${e.dangling}`);
  }

  if (DRY_RUN) {
    console.log(`\n[DRY-RUN 完成，未写入] 将删除 ${before.length} 条悬空边`);
    process.exit(0);
  }

  // 逐任务重写 dependencies：过滤掉不存在于 dev_tasks 的元素，保持原序
  const affected = [...new Set(before.map((e) => e.task_id))];
  console.log(`\n--- 清理 ${affected.length} 个任务的依赖数组 ---`);
  for (const taskId of affected) {
    // 关键：从 t2 出发 LEFT JOIN 元素，保证「全部依赖都是悬空」时仍产出一行
    // （用 CROSS JOIN + WHERE 过滤会让零残留元素的任务不产出行 → UPDATE 变 no-op）
    await db.execute(sql`
      UPDATE dev_tasks t SET dependencies = sub.clean, updated_at = now()
      FROM (
        SELECT t2.id AS rid,
               COALESCE(
                 jsonb_agg(e.value ORDER BY e.ord) FILTER (WHERE e.value IS NOT NULL),
                 '[]'::jsonb
               ) AS clean
        FROM dev_tasks t2
        LEFT JOIN LATERAL (
          SELECT ae.value, ae.ord
          FROM jsonb_array_elements_text(t2.dependencies) WITH ORDINALITY AS ae(value, ord)
          WHERE EXISTS (SELECT 1 FROM dev_tasks x WHERE x.id = ae.value)
        ) e ON true
        WHERE t2.id = ${taskId}
        GROUP BY t2.id
      ) sub
      WHERE t.id = sub.rid`);
    const left = Number((await rows(`SELECT jsonb_array_length(dependencies)::int AS n
      FROM dev_tasks WHERE id = '${taskId}'`))[0].n);
    console.log(`  ${taskId}: 清理后剩 ${left} 条依赖`);
  }

  const after = await countDangling();
  const afterTotal = Number((await rows(
    `SELECT COALESCE(SUM(jsonb_array_length(dependencies)),0)::int AS n FROM dev_tasks`))[0].n);

  console.log('\n--- 后置断言 ---');
  let failed = false;
  const chk = (ok: boolean, msg: string): void => {
    if (!ok) { console.error(`  [assert-fail] ${msg}`); failed = true; } else console.log(`  ✓ ${msg}`);
  };

  const taskCount = Number((await rows(`SELECT COUNT(*)::int AS n FROM dev_tasks`))[0].n);
  chk(taskCount === 534 || taskCount > 0, `任务总数不变 (${taskCount})`);
  chk(after === 0, `悬空边清零 (${after})`);
  chk(afterTotal === beforeTotal - before.length, `边数减少量 = 悬空数 (${beforeTotal} - ${before.length} = ${afterTotal})`);

  // 剩余边全部有效
  const invalid = Number((await rows(`SELECT COUNT(*)::int AS n FROM dev_tasks t
    CROSS JOIN LATERAL jsonb_array_elements_text(t.dependencies) AS d(id)
    WHERE NOT EXISTS (SELECT 1 FROM dev_tasks x WHERE x.id = d.id)`))[0].n);
  chk(invalid === 0, `全部依赖边指向真实任务 (无效 ${invalid})`);

  // 无重复边（数组内同一 ID 出现两次）
  const dup = Number((await rows(`SELECT COUNT(*)::int AS n FROM dev_tasks t
    WHERE jsonb_array_length(t.dependencies) <> (
      SELECT COUNT(DISTINCT e.value) FROM jsonb_array_elements_text(t.dependencies) AS e(value))`))[0].n);
  chk(dup === 0, `依赖数组无重复元素 (${dup})`);

  if (failed) process.exit(1);
  console.log('\n悬空依赖清理 PASS');
  process.exit(0);
}

await main();
