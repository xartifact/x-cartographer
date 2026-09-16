'use client';

/**
 * 模块依赖图（模块目录页的图视图）
 *
 * 与任务依赖图（features/task-graph）的分工：那边回答"谁阻塞谁"，这边回答
 * "谁依赖谁"——数据源是 `SystemModule.depends_on`，规模从不超过几十个节点，
 * 因此**不做范围限定**，一次渲染整个目录（与任务图必须限定邻域相反）。
 *
 * 方向语义（本视图存在的意义，必须画在图上，不能让人猜）：
 * 边由 **依赖方 → 被依赖方** 发出，A 依赖 B 即 A→B；dagre 分层 TB 下
 * 依赖方在上、被依赖方在下，箭头向下——"上层依赖下层"。
 * 画布上方的图例条逐字写出这条约定（不用浮层：浮层会盖住左上角节点）。
 *
 * 悬空引用（depends_on 指向已删模块）不丢弃也不崩：指向一个虚线红框占位节点
 * （见 lib/module-graph.ts），让"这里缺一块"在图上可见。
 */

import { useMemo } from 'react';
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Handle,
  MarkerType,
  Panel,
  Position,
  type Edge,
  type Node,
  type NodeProps,
  type NodeTypes,
} from '@xyflow/react';
import { Network } from 'lucide-react';
import type { SystemModule } from '@x-cartographer/shared';
import { cn } from '@/lib/utils';
import { ZoomControls } from '@/features/story-map/components/zoom-controls';
import { useDagreLayoutStatic } from '@/features/task-graph/use-dagre-layout';
import { buildModuleGraph, type ModuleGraphData } from '../lib/module-graph';

const NODE_W = 200;
const NODE_H = 64;

/** 节点渲染数据（对应 lib/module-graph.ts 的 ModuleGraphNode；slug 由 NodeProps.id 提供）
 * 用 type 而非 interface：xyflow 的 Node 约束 data 为 Record<string, unknown>，
 * 只有类型别名（非 interface）才带隐式索引签名。 */
type ModuleNodeData = {
  name: string;
  path: string;
  /** true = 悬空引用占位节点 */
  missing: boolean;
};

/**
 * 方向语义在代码里也留痕：source 是依赖方，target 是被依赖方。
 * 两个视觉标记（颜色 + 箭头）都用它，改动前先读 lib/module-graph.ts 的注释。
 */
const EDGE_COLOR = 'hsl(var(--muted-foreground))';
/** 悬空引用的标红：用 --destructive-strong 而非 --destructive——
 * 后者在暗色主题下对卡片只有 2:1 对比度，红线/红字实际看不见 */
const MISSING_EDGE_COLOR = 'hsl(var(--destructive-strong))';
const EDGE_STYLE = { stroke: EDGE_COLOR, strokeWidth: 1.5 } as const;
const MISSING_EDGE_STYLE = {
  stroke: MISSING_EDGE_COLOR,
  strokeWidth: 1.5,
  strokeDasharray: '4 3',
} as const;

/** 模块节点：name（主）+ slug（等宽）+ path；悬空占位节点虚线红框 */
function ModuleNode({ id, data, isConnectable }: NodeProps<Node<ModuleNodeData>>) {
  const { name, path, missing } = data;
  return (
    <>
      <Handle
        type="target"
        position={Position.Top}
        isConnectable={isConnectable}
        className="!h-1.5 !w-1.5 !border-0 !bg-transparent"
      />
      <div
        className={cn(
          'flex h-full w-full flex-col justify-center gap-0.5 rounded-lg border px-3 py-2 text-left',
          missing
            ? 'border-dashed border-destructive-strong/70 bg-destructive-strong/10'
            : 'border-border bg-background shadow-sm'
        )}
      >
        <p className={cn('truncate text-xs font-medium', missing && 'font-mono text-destructive-strong')}>
          {name}
        </p>
        {missing ? (
          <p className="truncate font-mono text-[10px] text-destructive-strong/90">不在目录中（可能已删除）</p>
        ) : (
          <>
            <p className="truncate font-mono text-[10px] text-muted-foreground">{id}</p>
            {path && (
              <p className="truncate font-mono text-[9px] text-muted-foreground/70">{path}</p>
            )}
          </>
        )}
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        isConnectable={isConnectable}
        className="!h-1.5 !w-1.5 !border-0 !bg-transparent"
      />
    </>
  );
}

const nodeTypes: NodeTypes = {
  moduleNode: ModuleNode as unknown as NodeTypes[string],
};

/** 图数据 → xyflow 元素（position 由 dagre 统一计算，这里一律先置零） */
function toFlowElements(graph: ModuleGraphData): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = graph.nodes.map((n) => ({
    id: n.id,
    type: 'moduleNode',
    position: { x: 0, y: 0 },
    data: { name: n.name, path: n.path, missing: n.missing } satisfies ModuleNodeData,
    style: { width: NODE_W, height: NODE_H },
  }));

  const edges: Edge[] = graph.edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    style: e.missing ? MISSING_EDGE_STYLE : EDGE_STYLE,
    markerEnd: {
      type: MarkerType.ArrowClosed,
      color: e.missing ? MISSING_EDGE_COLOR : EDGE_COLOR,
      width: 16,
      height: 16,
    },
  }));

  return { nodes, edges };
}

interface ModuleDependencyGraphProps {
  /** 模块目录（图视图不做搜索过滤：过滤掉中间节点会让依赖关系失真） */
  modules: readonly SystemModule[];
  className?: string;
}

export function ModuleDependencyGraph({ modules, className }: ModuleDependencyGraphProps) {
  const graph = useMemo(() => buildModuleGraph(modules), [modules]);
  const { nodes: graphNodes, edges: graphEdges } = useMemo(() => toFlowElements(graph), [graph]);
  const laidOut = useDagreLayoutStatic(graphNodes, graphEdges, {
    direction: 'TB',
    nodeWidth: NODE_W,
    nodeHeight: NODE_H,
  });

  return (
    <div className={cn('flex flex-col', className)}>
      {/* 图例做成画布上方的固定条，不用 Panel 浮层：
          浮层会盖住左上角的节点（模块少时恰好压在第一个节点上） */}
      <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1 border-b px-4 py-2 text-[11px]">
        <p className="font-medium">
          箭头 = 依赖方向：<span className="font-mono">A → B</span> 表示 A 依赖 B
        </p>
        <p className="text-muted-foreground">
          {graph.nodes.length - graph.missingIds.length} 个模块 · {graph.edges.length} 条依赖 ·
          依赖方在上、被依赖方在下
        </p>
        {graph.missingIds.length > 0 && (
          <p className="flex items-center gap-1 text-destructive-strong">
            <Network className="h-3 w-3 shrink-0" />
            <span>
              {graph.missingIds.length} 个悬空引用（
              <span className="font-mono">{graph.missingIds.join('、')}</span>
              ）：虚线红边指向占位节点，目标模块已不在目录中
            </span>
          </p>
        )}
      </div>
      <div className="min-h-0 flex-1">
        <ReactFlow
          nodes={laidOut}
          edges={graphEdges}
          nodeTypes={nodeTypes}
          minZoom={0.3}
          maxZoom={1.5}
          nodesConnectable={false}
          nodesDraggable={false}
          elementsSelectable={false}
          fitView
        >
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="hsl(var(--border))" />
          <Panel position="top-right">
            <ZoomControls />
          </Panel>
        </ReactFlow>
      </div>
    </div>
  );
}
