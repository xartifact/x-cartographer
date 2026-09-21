#!/usr/bin/env bun
/**
 * 依赖图只读审计：报告三类结构性问题（悬空 / 自环 / 成环）
 *
 * 背景（docs/design/domain-model.md §2.4/§5）：`dev_tasks.dependencies` 必须无环、
 * 不得悬空。写入侧已在 `apps/server/src/lib/dependency-graph.ts` 拦截**新**问题，
 * 但存量数据可能已经损坏（生产实测 11 条悬空边，2026-09-21）。
 *
 * **本脚本只报告，不修改**——环上该删哪条边是业务决策（哪条依赖写错了只有人
 * 知道），自动重连/自动删边都是编造事实。悬空边的清理见 `clean-dangling-deps.ts`
 * （只删边、不猜重连）。
 *
 * 用法：
 *   bun scripts/audit-dependency-graph.ts [--server <url>]
 *   bun scripts/audit-dependency-graph.ts --db        # 直连本地库（需先停 gateway）
 *
 * 退出码：0 = 无问题；1 = 有悬空或自环；2 = 有环（需人工裁定）
 */
import { ensureDb, rowsOf } from '@x-cartographer/db';
import { sql } from 'drizzle-orm';

const args = process.argv.slice(2);
const USE_DB = args.includes('--db');
const serverIdx = args.indexOf('--server');
const SERVER =
  serverIdx >= 0 ? (args[serverIdx + 1] ?? 'http://localhost:8787') : 'http://localhost:8787';

interface TaskRow {
  id: string;
  title: string;
  status: string;
  dependencies: string[];
}

async function loadTasks(): Promise<TaskRow[]> {
  if (USE_DB) {
    const db = await ensureDb();
    return rowsOf(
      await db.execute(sql`SELECT id, title, status, dependencies FROM dev_tasks`)
    ).map((r) => ({
      id: String(r.id),
      title: String(r.title),
      status: String(r.status),
      dependencies: (r.dependencies as string[] | null) ?? [],
    }));
  }
  const res = await fetch(`${SERVER}/api/dev-tasks/all`);
  if (!res.ok) throw new Error(`GET ${SERVER}/api/dev-tasks/all → ${res.status}`);
  const rows = (await res.json()) as Array<Partial<TaskRow>>;
  return rows.map((r) => ({
    id: String(r.id),
    title: String(r.title ?? ''),
    status: String(r.status ?? ''),
    dependencies: r.dependencies ?? [],
  }));
}

const tasks = await loadTasks();
const byId = new Map(tasks.map((t) => [t.id, t]));
const edges = new Map(tasks.map((t) => [t.id, t.dependencies]));

// ── 1. 悬空边 ──
const dangling: Array<{ task: TaskRow; missing: string }> = [];
for (const t of tasks) {
  for (const d of t.dependencies) {
    if (!byId.has(d)) dangling.push({ task: t, missing: d });
  }
}

// ── 2. 自环 ──
const selfDeps = tasks.filter((t) => t.dependencies.includes(t.id));

// ── 3. 成环（DFS 染色，报告环路径）──
const WHITE = 0, GRAY = 1, BLACK = 2;
const color = new Map(tasks.map((t) => [t.id, WHITE]));
const stack: string[] = [];
const cycles: string[][] = [];

const dfs = (id: string): void => {
  color.set(id, GRAY);
  stack.push(id);
  for (const next of edges.get(id) ?? []) {
    if (!byId.has(next)) continue; // 悬空单独报告
    const c = color.get(next);
    if (c === GRAY) {
      cycles.push([...stack.slice(stack.indexOf(next)), next]);
    } else if (c === WHITE) {
      dfs(next);
    }
  }
  stack.pop();
  color.set(id, BLACK);
};

for (const t of tasks) {
  if (color.get(t.id) === WHITE) dfs(t.id);
}

const totalEdges = [...edges.values()].reduce((n, d) => n + d.length, 0);
const dataDir = process.env.XPR_DB_DIR ?? `${process.cwd()}/data/pglite`;
console.log(`依赖图审计（${USE_DB ? `本地库 ${dataDir}` : SERVER}）`);
console.log(`  任务 ${tasks.length} 条，依赖边 ${totalEdges} 条\n`);

// 空库直接判定为"无问题"是危险假阴性：XPR_DB_DIR 指错（或未设）时，client 会按
// 默认路径新建一个空库，然后忠实报告"✓ 无结构性问题"——审计者会以为生产干净。
// 故 0 任务时拒绝给结论，显式退出码 3 提示先确认库。
if (tasks.length === 0) {
  console.log(`✗ 该库 0 条任务，无法审计——请确认 XPR_DB_DIR 指向真实数据目录。`);
  console.log(`  当前解析：${dataDir}`);
  process.exit(3);
}

console.log(`[1] 悬空边：${dangling.length} 条`);
for (const d of dangling.slice(0, 20)) {
  console.log(
    `    ${d.task.id.padEnd(10)} [${d.task.status}] ${d.task.title.slice(0, 28).padEnd(30)} → ${d.missing}（不存在）`
  );
}
if (dangling.length > 20) console.log(`    …另有 ${dangling.length - 20} 条`);
if (dangling.length > 0) {
  console.log('    影响：next 的 completedIds 永不含该 ID → 这些任务永久不出队');
  console.log('    处置：bun scripts/clean-dangling-deps.ts --dry-run 后正式执行');
}

console.log(`\n[2] 自环：${selfDeps.length} 条`);
for (const t of selfDeps) console.log(`    ${t.id} (${t.title.slice(0, 30)})`);

console.log(`\n[3] 环：${cycles.length} 处`);
for (const c of cycles.slice(0, 10)) {
  console.log(`    ${c.join(' → ')}`);
  for (const id of c.slice(0, -1)) {
    const t = byId.get(id)!;
    console.log(`      ${id.padEnd(10)} [${t.status}] ${t.title.slice(0, 40)}`);
  }
}
if (cycles.length > 0) {
  console.log('    处置：**需人工裁定**删哪条边（环上哪条依赖写错了只有人知道）；');
  console.log('    服务端只拒绝新写入，不自动改写存量。');
}

const exitCode = cycles.length > 0 ? 2 : dangling.length > 0 || selfDeps.length > 0 ? 1 : 0;
console.log(`\n${exitCode === 0 ? '✓ 无结构性问题' : `✗ 存在结构性问题（退出码 ${exitCode}）`}`);
process.exit(exitCode);
