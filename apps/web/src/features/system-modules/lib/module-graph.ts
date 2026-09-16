/**
 * 模块依赖图的图数据构建（纯函数，无 React / 无布局）
 *
 * 数据模型：`SystemModule.depends_on` 是「本模块依赖谁」的 id 列表。
 * 渲染成边时方向取 **依赖方 → 被依赖方**（A 依赖 B 即 A→B），与
 * `technical-constitution.md` §3.6 的字段语义一致；方向语义在图上必须写出来
 * （图视图标题 + 图例），否则「箭头指向谁」全靠猜。
 *
 * 两类脏数据必须优雅处理，不能崩：
 * - **悬空引用**：depends_on 指向已删除的模块。丢弃边等于抹掉「这里缺一块」的事实，
 *   故为其生成占位节点（`missing:<slug>`）保留悬念，UI 用虚线 + 红色区分。
 * - **自依赖 / 重复项**：服务端 schema 不拦（`depends_on: z.array(moduleIdSchema)`），
 *   但自环在分层布局里没有信息量，重复项会让 dagre 叠点，两者都在这里归一。
 *
 * 真实 slug 由服务端 regex 约束为 `[a-z0-9][a-z0-9-]*`，不含 `:`，
 * 所以 `missing:` 前缀的占位 id 不可能与真实模块 id 冲突。
 */

import type { SystemModule } from '@x-cartographer/shared';

/** 悬空依赖占位节点 id 前缀（见文件头：真实 slug 不含 `:`，不会撞 id） */
export const MISSING_NODE_PREFIX = 'missing:';

/** 悬空依赖目标 id → 占位节点 id */
export function missingNodeId(dependencyId: string): string {
  return `${MISSING_NODE_PREFIX}${dependencyId}`;
}

/** 图节点（模块本身，或悬空依赖的占位） */
export interface ModuleGraphNode {
  /** 模块 slug；占位节点为 `missing:<slug>` */
  id: string;
  /** 节点标题：模块名；占位节点是被引用却不存在的那串 slug */
  name: string;
  /** 代码库路径（占位节点为空串） */
  path: string;
  /** true = 悬空依赖占位节点（依赖目标已不在目录中） */
  missing: boolean;
}

/** 图边：source 依赖 target */
export interface ModuleGraphEdge {
  id: string;
  /** 依赖方 */
  source: string;
  /** 被依赖方（可能是 `missing:` 占位节点） */
  target: string;
  /** true = 指向悬空引用（虚线 + 标红） */
  missing: boolean;
}

export interface ModuleGraphData {
  nodes: ModuleGraphNode[];
  edges: ModuleGraphEdge[];
  /** 悬空引用目标 id（去重、升序）——UI 用于汇总提示 */
  missingIds: string[];
}

/**
 * `SystemModule[]` → `{nodes, edges}`。
 *
 * @param modules 模块目录（推荐已按 id 排序；节点顺序即入参顺序）
 * @returns 节点/边/悬空引用汇总；无模块时返回三者皆空的图
 */
export function buildModuleGraph(modules: readonly SystemModule[]): ModuleGraphData {
  const known = new Set(modules.map((m) => m.id));
  const nodes: ModuleGraphNode[] = modules.map((m) => ({
    id: m.id,
    name: m.name,
    path: m.path ?? '',
    missing: false,
  }));

  const edges: ModuleGraphEdge[] = [];
  const seen = new Set<string>();
  const missingIds = new Set<string>();

  for (const m of modules) {
    for (const dep of m.depends_on ?? []) {
      // 自依赖：一条指向自己的边在分层布局里没有信息量
      if (dep === m.id) continue;
      const dangling = !known.has(dep);
      if (dangling) missingIds.add(dep);
      const target = dangling ? missingNodeId(dep) : dep;
      const key = `${m.id}->${target}`;
      if (seen.has(key)) continue;
      seen.add(key);
      edges.push({ id: `e:${key}`, source: m.id, target, missing: dangling });
    }
  }

  // 同一个悬空 id 被多个模块依赖时共用同一个占位节点（"这些模块都缺同一块"）
  const sortedMissing = [...missingIds].sort();
  for (const id of sortedMissing) {
    nodes.push({ id: missingNodeId(id), name: id, path: '', missing: true });
  }

  return { nodes, edges, missingIds: sortedMissing };
}
