/**
 * 图论原语（apps/server/src/lib/graph.ts）
 *
 * 环检测在两处被需要，且语义完全一致——故抽到此处，避免第二份实现漂移：
 * - `dependency-graph.ts`：DevTask 依赖 DAG（domain-model §2.4「工作 → 工作：必须无环」）
 * - `module-refs.ts`：SystemModule.depends_on（§2.4「约束 → 约束：允许，但不得成环」）
 *
 * 纯函数、零副作用、无 DB 依赖——调用方负责取边集与判定域界。
 */

/**
 * 从 `start` 出发深度优先，找一条回到 `start` 的路径（含首尾）。
 *
 * 找到即返回路径（如 `['A','B','A']`），无环返回 null。
 * `edges` 须已是「本次写入生效后」的图——即待写入的边要预先覆盖进去，
 * 否则检测不到「只有通过新边才闭合」的环。
 */
export function findCycleThrough(
  edges: Map<string, string[]>,
  start: string
): string[] | null {
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
