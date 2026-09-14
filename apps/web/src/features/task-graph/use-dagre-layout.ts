import { Graph, layout as dagreLayout } from '@dagrejs/dagre';
import type { Edge, Node } from '@xyflow/react';

/**
 * dagre 分层布局纯函数（任务依赖图）。
 *
 * 输入 xyflow 格式 {nodes, edges}，输出带 position 的 nodes（不触碰组件状态/DOM）。
 * dagre 3.x API：节点尺寸字段 width/height；edge 必须带 label {width,height}，否则 layout 抛错。
 * 方向从上到下（TB）——依赖链自上而下，与任务故事地图纵向重要性直觉一致。
 *
 * @param nodes 任务节点（含 data 任意内容；width/height 缺省用默认卡尺寸）
 * @param edges 依赖边（source→target = 前置→后继）
 * @returns 新 Node 数组，position 为 dagre 计算的中心坐标转 xyflow 左上角坐标
 */
export function useDagreLayoutStatic(
  nodes: Node[],
  edges: Edge[],
  options?: { direction?: 'TB' | 'LR'; nodeWidth?: number; nodeHeight?: number }
): Node[] {
  const direction = options?.direction ?? 'TB';
  const nodeWidth = options?.nodeWidth ?? 220;
  const nodeHeight = options?.nodeHeight ?? 64;

  const g = new Graph();
  g.setGraph({
    rankdir: direction,
    nodesep: 36,
    ranksep: 80,
    marginx: 20,
    marginy: 20,
  });
  g.setDefaultEdgeLabel(() => ({ width: 10, height: 10 }));

  for (const node of nodes) {
    g.setNode(node.id, {
      width: (node.measured?.width as number | undefined) ?? nodeWidth,
      height: (node.measured?.height as number | undefined) ?? nodeHeight,
    });
  }
  // 去重边（dagre 对重复 edge 会叠点）
  const seen = new Set<string>();
  for (const edge of edges) {
    const key = `${edge.source}->${edge.target}`;
    if (seen.has(key)) continue;
    if (!g.hasNode(edge.source) || !g.hasNode(edge.target)) continue;
    seen.add(key);
    g.setEdge(edge.source, edge.target);
  }

  dagreLayout(g);

  return nodes.map((node) => {
    const pos = g.node(node.id);
    return {
      ...node,
      position: {
        x: pos.x - ((node.measured?.width as number | undefined) ?? nodeWidth) / 2,
        y: pos.y - ((node.measured?.height as number | undefined) ?? nodeHeight) / 2,
      },
    };
  });
}
