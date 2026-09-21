/**
 * 依赖图校验（apps/server/src/lib/dependency-graph.ts）
 *
 * 存在问题（docs/design/domain-model.md §2.4/§5）：`dev_tasks.dependencies` 是
 * 显式的 DAG 边，模型规定「工作 → 工作：允许，**必须无环**」且「无悬空：引用的
 * 实体必须存在」，但 create/patch 此前**没有任何校验**——悬空、自环、成环全部
 * 被接受。
 *
 * 悬空边最致命：`next` 的 completedIds 只收真实且 done/cancelled 的任务，悬空
 * 依赖永远不在其中，`deps.every(completed)` 恒为 false → 该任务**永久不出队**，
 * 且 `next` 返回 null 时不提供任何诊断。生产实测 11 条悬空边（2026-09-21）。
 *
 * 校验语义（**只判定、不裁决**，同层参考 `module-refs.ts`）：
 * - 悬空 / 自环 / 成环是**结构性事实**，可在写入前判定 → 拒绝写入（400）。
 *   这与"信息性告警不阻断"（§3.5 技术宪法、§6.4.2 模块引用）不同：那些是标注
 *   错了不影响系统运作；这里的错误会让任务**永久不可执行**，属结构性损坏。
 * - 成环**不自动修复**：环上删哪条边是业务决策（哪条依赖写错了只有人知道），
 *   服务端只拒绝新写入并指明环路径，存量环由审计脚本报告后人工裁定。
 */
import { sql } from 'drizzle-orm';
import { ensureDb, rowsOf } from '@x-cartographer/db';

export interface DependencyViolations {
  /** 引用了不存在的任务 ID（§5 无悬空） */
  dangling: string[];
  /** 依赖自身（成环的最简形式） */
  selfDep: string | null;
  /**
   * 若把 `taskId` 的依赖设为 `dependencies` 会形成的环路径
   * （从环上某个节点回到它自己，如 `A → B → A`）；无环为 null。
   */
  cycle: string[] | null;
}

/**
 * 校验一次依赖写入。`taskId` 为正在写入的任务（create 时尚无 id，传 null —— 此时
 * 不可能自环/成环，因为新任务还不被任何任务依赖，只需查悬空）。
 */
export async function validateDependencies(
  taskId: string | null,
  dependencies: string[]
): Promise<DependencyViolations> {
  const db = await ensureDb();
  const unique = [...new Set(dependencies)];

  // ── 1. 悬空：引用的任务必须存在（批量存在性检查）──
  let dangling: string[] = [];
  if (unique.length > 0) {
    const found = new Set(
      rowsOf(
        await db.execute(sql`
          SELECT id FROM dev_tasks
          WHERE id IN (${sql.join(unique.map((d) => sql`${d}`), sql`, `)})`)
      ).map((r) => String(r.id))
    );
    dangling = unique.filter((d) => !found.has(d));
  }

  // ── 2. 自环：不能依赖自己 ──
  const selfDep = taskId && unique.includes(taskId) ? taskId : null;

  // 无 id（create）或已有结构性问题时无需再查环：调用方会立即拒绝
  if (!taskId || dangling.length > 0 || selfDep) {
    return { dangling, selfDep, cycle: null };
  }

  // ── 3. 成环：从每个新依赖出发做可达性搜索，若能回到 taskId 则成环 ──
  // 只读全图（依赖边数量级小），避免递归 SQL 的复杂度与方言差异。
  const edges = new Map<string, string[]>();
  for (const row of rowsOf(await db.execute(sql`SELECT id, dependencies FROM dev_tasks`))) {
    edges.set(String(row.id), (row.dependencies as string[] | null) ?? []);
  }
  // 本次写入的边以「待写入状态」参与搜索——否则检测不到要通过新边才闭合的环
  edges.set(taskId, unique);

  const cycle = findCycleThrough(edges, taskId);
  return { dangling, selfDep, cycle };
}

/**
 * 从 `start` 出发深度优先，找一条回到 `start` 的路径（含首尾）。
 * 找到即返回路径（如 `['A','B','A']`），无环返回 null。
 */
function findCycleThrough(edges: Map<string, string[]>, start: string): string[] | null {
  const stack: string[] = [];
  const onPath = new Set<string>();
  const visited = new Set<string>();

  const dfs = (node: string): string[] | null => {
    stack.push(node);
    onPath.add(node);
    for (const next of edges.get(node) ?? []) {
      if (next === start) {
        return [...stack, start];
      }
      if (onPath.has(next) || visited.has(next)) continue;
      const found = dfs(next);
      if (found) return found;
    }
    stack.pop();
    onPath.delete(node);
    visited.add(node);
    return null;
  };

  return dfs(start);
}

/** 把违规转成 400 响应体（错误信息必须指明具体 ID，否则调用方无从修复） */
export function dependencyViolationResponse(
  v: DependencyViolations
): { error: string; detail: string } | null {
  if (v.dangling.length > 0) {
    return {
      error: 'dangling_dependency',
      detail:
        `依赖引用了不存在的任务：${v.dangling.join(', ')}。` +
        `domain-model §5「无悬空」：悬空依赖会让任务永久不可执行（next 永不出队）。`,
    };
  }
  if (v.selfDep) {
    return {
      error: 'self_dependency',
      detail: `任务 ${v.selfDep} 不能依赖自身（domain-model §2.4「必须无环」）。`,
    };
  }
  if (v.cycle) {
    return {
      error: 'dependency_cycle',
      detail:
        `该写入会形成依赖环：${v.cycle.join(' → ')}。` +
        `domain-model §2.4「工作 → 工作：必须无环」；请改为不构成环的依赖方向。`,
    };
  }
  return null;
}
