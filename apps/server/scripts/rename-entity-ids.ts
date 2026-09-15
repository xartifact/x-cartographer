/**
 * 存量实体 ID 归一化：`<PREFIX>-<序号>` 统一形态
 *
 * 背景：库里并存三种 ID 形态（早期人工 US-015 / 服务端 nanoid 21 字符 / ADR 的 UUID）。
 * 代码注释与文档大量引用 `TASK-xxx` 形态锚点，但另一部分实体（其他产品的全部数据、
 * 板产品内的后建数据）仍是随机串——画布窄列截断、不可读、无法人工引用。
 *
 * 策略（用户裁定）：
 *   1. 已被引用的号段原地保留（板产品的 US-000..047 / TASK-001..145 不动），
 *      代码注释里 100+ 处 `TASK-xxx` 引用继续有效；
 *   2. 仅对「非规范形态」的行分配新号（续发，从该实体历史最大规范号之后开始）；
 *   3. 8 类实体统一（products / user_activities / user_tasks / milestones /
 *      user_stories / dev_tasks / adr_records / status_changes）。
 *
 * 实现要点：
 *   - 主键重写会让子表旧引用瞬间悬空 → 先把相关外键改为 DEFERRABLE INITIALLY
 *     DEFERRED，在同一事务内批量重写，提交时统一校验。（验证见 spike-tx.mts：
 *     延迟约束仍在提交时真正校验孤儿，不是放行）
 *   - 幂等：只处理 `id !~ '^<PREFIX>-<数字>$'` 的行，重跑无操作。
 *   - 可回滚：`--dry-run` 只打印映射不写库；真实执行前需已备份数据目录。
 */
import { sql, type SQL } from 'drizzle-orm';
import { ensureDb } from '@x-cartographer/db';
import { ID_SPECS, formatShortId, parseShortId, type ShortIdKind } from '@x-cartographer/db';

const DRY_RUN = process.argv.includes('--dry-run');

/** 只用到 execute，声明最小契约即可（db 与事务对象都满足） */
interface QueryRunner {
  execute(query: SQL): Promise<unknown>;
}

/**
 * 当前执行器：进入事务后替换为 tx。
 * 用外层 db 执行会跑在事务之外，延迟约束的保护随之失效。
 */
let runner: QueryRunner = (await ensureDb()) as unknown as QueryRunner;

const rows = async (q: string): Promise<Array<Record<string, unknown>>> => {
  const r: unknown = await runner.execute(sql.raw(q));
  return (r as { rows: Array<Record<string, unknown>> }).rows;
};
const exec = async (q: string): Promise<void> => {
  await runner.execute(sql.raw(q));
};

/** 值走参数绑定（sql`` 模板），不拼字符串——旧 ID 来自库，属不可信输入 */
const execValues = async (q: SQL): Promise<void> => {
  await runner.execute(q);
};

interface Ref {
  table: string;
  column: string;
  kind: string;
  filter?: string;
}

/** 被引用的实体先处理（父 → 子），保证映射覆盖完整 */
const ORDER: ShortIdKind[] = [
  'product', 'adr', 'milestone', 'userActivity', 'userTask', 'story', 'devTask', 'statusChange',
];

/** 收集待重写行：非规范形态，序号续发（保留既有号段语义） */
async function collectTargets(kind: ShortIdKind): Promise<Array<{ old: string; new: string }>> {
  const spec = ID_SPECS[kind];
  const list = (await rows(`SELECT id FROM "${spec.table}" ORDER BY id`)).map((r) => String(r.id));
  const nonCanon = list.filter((id) => parseShortId(kind, id) === null);
  if (nonCanon.length === 0) return [];

  const canonNums = list
    .map((id) => parseShortId(kind, id))
    .filter((n): n is number => n !== null);
  let next = canonNums.length > 0 ? Math.max(...canonNums) + 1 : 1;

  return nonCanon.map((old) => ({ old, new: formatShortId(kind, next++) }));
}

/**
 * 建临时映射表：重写时用 JOIN 批量更新，避免逐行拼 SQL。
 * 表名带实体前缀，且用 ON COMMIT DROP —— 事务提交即自动消失。
 */
async function buildMapTable(kind: string, pairs: Array<{ old: string; new: string }>): Promise<string> {
  // 表名只来自 ID_SPECS 的字面量键，不含外部输入
  const t = `_idmap_${kind}`;
  await exec(`DROP TABLE IF EXISTS ${t}`);
  await exec(`CREATE TEMP TABLE ${t} (old_id text PRIMARY KEY, new_id text NOT NULL) ON COMMIT DROP`);
  if (pairs.length > 0) {
    // 逐行参数化插入：p.old 是数据库里的既有 ID（可能含引号等字符），
    // 绝不能用模板字符串拼接（注入面 + 引号转义漏洞）
    for (const p of pairs) {
      await execValues(sql`INSERT INTO ${sql.raw(t)} (old_id, new_id) VALUES (${p.old}, ${p.new})`);
    }
  }
  return t;
}

/** 把引用 <kind> 的外键改为可延迟（事务内主键重写的前提） */
async function makeRefsDeferrable(kinds: ShortIdKind[]): Promise<string[]> {
  const changed: string[] = [];
  for (const kind of kinds) {
    for (const ref of ID_SPECS[kind].refs as readonly Ref[]) {
      if (ref.kind !== 'column') continue;
      const found = await rows(`SELECT c.conname FROM pg_constraint c
        JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
        WHERE c.contype='f' AND c.conrelid='${ref.table}'::regclass
          AND c.confrelid='${ID_SPECS[kind].table}'::regclass AND a.attname='${ref.column}'`);
      for (const f of found) {
        await exec(`ALTER TABLE "${ref.table}" ALTER CONSTRAINT "${f.conname}" DEFERRABLE INITIALLY DEFERRED`);
        changed.push(`${ref.table}\u0000${f.conname}`);
      }
    }
  }
  return changed;
}

async function restoreRefs(deferrable: string[]): Promise<void> {
  for (const fq of deferrable) {
    const [t, c] = fq.split('\u0000');
    await exec(`ALTER TABLE "${t}" ALTER CONSTRAINT "${c}" NOT DEFERRABLE`);
  }
}

/** 单实体全链重写：引用（列 / jsonb 数组）+ 主键本体 */
async function rewriteEntity(kind: ShortIdKind): Promise<number> {
  const spec = ID_SPECS[kind];
  const pairs = await collectTargets(kind);
  if (pairs.length === 0) {
    console.log(`  ${kind.padEnd(13)} 已是规范形态，跳过`);
    return 0;
  }
  console.log(`  ${kind.padEnd(13)} 重写 ${String(pairs.length).padStart(3)} 行：${pairs[0].old.slice(0, 24)} → ${pairs[0].new} … ${pairs[pairs.length - 1].new}`);
  if (DRY_RUN) return pairs.length;

  const map = await buildMapTable(kind, pairs);

  for (const ref of spec.refs as readonly Ref[]) {
    const where = ref.filter ? ` AND t.${ref.filter}` : '';
    if (ref.kind === 'column') {
      const n = await rows(`UPDATE "${ref.table}" t SET "${ref.column}" = m.new_id
        FROM ${map} m WHERE t."${ref.column}" = m.old_id${where} RETURNING 1`);
      console.log(`      ${ref.table}.${ref.column}: ${n.length}`);
    } else if (ref.kind === 'jsonbArray') {
      // 逐元素替换：依赖数组里存的是 ID 字符串，用映射表左连接后重组
      const n = await rows(`UPDATE "${ref.table}" t SET "${ref.column}" = sub.new_arr
        FROM (
          SELECT t2.id AS rid,
                 COALESCE(jsonb_agg(COALESCE(m.new_id, e.value) ORDER BY e.ord), '[]'::jsonb) AS new_arr
          FROM "${ref.table}" t2
          CROSS JOIN LATERAL jsonb_array_elements_text(t2."${ref.column}") WITH ORDINALITY AS e(value, ord)
          LEFT JOIN ${map} m ON m.old_id = e.value
          GROUP BY t2.id
        ) sub
        WHERE t.id = sub.rid RETURNING 1`);
      console.log(`      ${ref.table}.${ref.column} (jsonb): ${n.length}`);
    }
  }

  const n = await rows(`UPDATE "${spec.table}" t SET id = m.new_id FROM ${map} m
    WHERE t.id = m.old_id RETURNING 1`);
  console.log(`      ${spec.table}.id: ${n.length}`);
  return n.length;
}

/** 全部断言：数量守恒 + 无悬空引用（含 jsonb 依赖） */
async function assertAll(before: Record<string, number>, baselineDangling: number): Promise<boolean> {
  console.log('\n--- 后置断言 ---');
  let failed = false;
  const chk = (ok: boolean, msg: string): void => {
    if (!ok) { console.error(`  [assert-fail] ${msg}`); failed = true; } else console.log(`  ✓ ${msg}`);
  };

  for (const k of ORDER) {
    const spec = ID_SPECS[k];
    const r = await rows(`SELECT COUNT(*)::int AS n FROM "${spec.table}"`);
    chk(Number(r[0].n) === before[k], `${spec.table} 行数守恒 (${r[0].n}/${before[k]})`);
  }

  // 每个引用列都不得有悬空值
  for (const k of ORDER) {
    const spec = ID_SPECS[k];
    for (const ref of spec.refs as readonly Ref[]) {
      if (ref.kind !== 'column') continue;
      const where = ref.filter ? ` AND ${ref.filter}` : '';
      const r = await rows(`SELECT COUNT(*)::int AS n FROM "${ref.table}"
        WHERE "${ref.column}" IS NOT NULL${where}
          AND "${ref.column}" NOT IN (SELECT id FROM "${spec.table}")`);
      chk(Number(r[0].n) === 0, `${ref.table}.${ref.column} 无悬空引用 (${r[0].n})`);
    }
  }


  // 全部实体已是规范形态
  for (const k of ORDER) {
    const spec = ID_SPECS[k];
    const r = await rows(`SELECT id FROM "${spec.table}"`);
    const bad = r.filter((x) => parseShortId(k, String(x.id)) === null).length;
    chk(bad === 0, `${spec.table} 全部规范形态 (残留 ${bad})`);
  }

  // 主键唯一性（重写后不得出现重复）
  for (const k of ORDER) {
    const spec = ID_SPECS[k];
    const dup = await rows(`SELECT COUNT(*)::int AS n FROM (
      SELECT id FROM "${spec.table}" GROUP BY id HAVING COUNT(*) > 1) d`);
    chk(Number(dup[0].n) === 0, `${spec.table} 主键无重复 (${dup[0].n})`);
  }

  // jsonb 依赖边：悬空数不得因重写而增加
  // （库里存在历史脏数据——依赖指向已删除的任务，如 TASK-007；重写前即悬空，
  //  故断言比对基线而非要求绝对为零，否则会把历史问题误判为本次回归）
  const dangling = Number((await rows(`SELECT COUNT(*)::int AS n FROM dev_tasks t
    WHERE EXISTS (SELECT 1 FROM jsonb_array_elements_text(t.dependencies) AS d(id)
      WHERE NOT EXISTS (SELECT 1 FROM dev_tasks x WHERE x.id = d.id))`))[0].n);
  chk(dangling <= baselineDangling, `依赖悬空数未增加 (${dangling} ≤ 基线 ${baselineDangling})`);
  return !failed;
}

/** 推进全部序列越过新号段，避免后续新建撞 ID */
async function bumpAllSequences(): Promise<void> {
  console.log('\n--- 推进序列 ---');
  for (const k of ORDER) {
    const spec = ID_SPECS[k];
    const list = await rows(`SELECT id FROM "${spec.table}"`);
    const nums = list.map((r) => parseShortId(k, String(r.id))).filter((n): n is number => n !== null);
    const max = nums.length > 0 ? Math.max(...nums) : 0;
    await exec(`CREATE SEQUENCE IF NOT EXISTS ${spec.sequence}`);
    await exec(`SELECT setval('${spec.sequence}', GREATEST((SELECT last_value FROM ${spec.sequence}), ${max}))`);
    console.log(`  ${spec.sequence.padEnd(24)} ${max}`);
  }
}

async function main(): Promise<void> {
  console.log(DRY_RUN ? '=== DRY-RUN（不写入）===' : '=== 执行实体 ID 归一化 ===');

  const before: Record<string, number> = {};
  for (const k of ORDER) {
    const r = await rows(`SELECT COUNT(*)::int AS n FROM "${ID_SPECS[k].table}"`);
    before[k] = Number(r[0].n);
  }
  const beforeDeps = Number((await rows(
    `SELECT COALESCE(SUM(jsonb_array_length(dependencies)),0)::int AS n FROM dev_tasks`))[0].n);
  // 悬空依赖基线：库里历史脏数据（依赖指向已删任务）重写前后应保持一致
  const baselineDangling = Number((await rows(`SELECT COUNT(*)::int AS n FROM dev_tasks t
    WHERE EXISTS (SELECT 1 FROM jsonb_array_elements_text(t.dependencies) AS d(id)
      WHERE NOT EXISTS (SELECT 1 FROM dev_tasks x WHERE x.id = d.id))`))[0].n);

  // 外键可延迟改造必须在事务外（DDL 与数据改动分开，失败时便于单独还原）
  let deferrable: string[] = [];
  if (!DRY_RUN) {
    console.log('\n--- 外键改为可延迟 ---');
    deferrable = await makeRefsDeferrable(ORDER);
    console.log(`  ${deferrable.length} 个约束已改为 DEFERRABLE INITIALLY DEFERRED`);
  } else {
    console.log('\n[dry] 跳过外键改造');
  }

  console.log('\n--- 重写 ---');
  try {
    const db = (await ensureDb()) as unknown as {
      transaction: (fn: (tx: QueryRunner) => Promise<void>) => Promise<void>;
    };
    await db.transaction(async (tx) => {
      runner = tx; // 事务内所有语句走 tx，延迟约束才生效
      for (const k of ORDER) await rewriteEntity(k);
    });
  } catch (e) {
    console.error('\n[失败] 事务已回滚:', String(e).slice(0, 500));
    if (!DRY_RUN) await restoreRefs(deferrable);
    process.exit(1);
  }
  runner = (await ensureDb()) as unknown as QueryRunner;

  if (!DRY_RUN) {
    console.log('\n--- 还原外键约束 ---');
    await restoreRefs(deferrable);
    console.log(`  ${deferrable.length} 个约束已还原为 NOT DEFERRABLE`);
    await bumpAllSequences();
  }

  const afterDeps = Number((await rows(
    `SELECT COALESCE(SUM(jsonb_array_length(dependencies)),0)::int AS n FROM dev_tasks`))[0].n);
  if (afterDeps !== beforeDeps) {
    console.error(`  [assert-fail] 依赖边数变化 (${afterDeps}/${beforeDeps})`);
    process.exit(1);
  }

  const ok = await assertAll(before, baselineDangling);
  if (!ok) process.exit(1);
  console.log(DRY_RUN ? '\n[DRY-RUN 完成，未写入]' : '\nID 归一化 PASS');
  process.exit(0);
}

await main();
