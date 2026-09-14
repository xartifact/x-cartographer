import { useMemo, useState } from 'react';
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Panel,
  Handle,
  Position,
  type Node,
  type Edge,
  type NodeTypes,
} from '@xyflow/react';
import { Button } from '@x-cartographer/ui';
import { ZoomControls } from '@/features/story-map/components/zoom-controls';
import { useDagreLayoutStatic } from '../use-dagre-layout';

/**
 * 任务依赖图（docs/design/relationship-visualization.md §3.2）。
 * 范围限定二选一：按故事限定 / 以选中任务为中心 N 跳邻域（默认 1 跳）。
 * 跨范围依赖用截断节点（"+ N 个外部依赖"）表示，不渲染全项目图。
 */

const DEFAULT_NODE_W = 220;
const DEFAULT_NODE_H = 64;

interface DepGraphTask {
  id: string;
  title: string;
  status: string;
  story_id?: string | null;
}

interface TaskDependencyGraphProps {
  /** 范围内全部任务（当前故事的任务池或全量任务） */
  tasks: DepGraphTask[];
  /** 范围限定：仅渲染该故事的任务 */
  filterStoryId?: string | null;
  /** 中心任务（邻域模式） */
  focusTaskId?: string | null;
  className?: string;
}

/** 截断节点：跨范围依赖占位 */
function TruncatedNode({ data }: { data: { count: number; label: string } }) {
  return (
    <div className="flex h-12 w-[180px] items-center justify-center rounded-lg border border-dashed border-border/70 bg-muted/40 px-2 text-center">
      <span className="text-[10px] italic text-muted-foreground">
        + {data.count} 个外部依赖（{data.label}）
      </span>
    </div>
  );
}

const nodeTypes: NodeTypes = {
  truncated: TruncatedNode as unknown as NodeTypes[string],
};

/** 状态色（依赖任务视觉权重） */
function statusCls(status: string): string {
  if (status === 'done') return 'border-l-green-500';
  if (status === 'in_progress') return 'border-l-blue-500';
  if (status === 'cancelled') return 'border-l-muted-foreground/30 opacity-60';
  return 'border-l-amber-500';
}

export function TaskDependencyGraph({
  tasks,
  filterStoryId,
  focusTaskId,
  className,
}: TaskDependencyGraphProps) {
  const [mode, setMode] = useState<'story' | 'neighborhood'>('story');
  const [hops, setHops] = useState(1);

  const { graphNodes, graphEdges } = useMemo(() => {
    const byId = new Map(tasks.map((t) => [t.id, t]));
    const depOf = new Map<string, string[]>(); // taskId → 前置依赖 ids
    for (const t of tasks) {
      for (const d of (t as unknown as { dependencies?: string[] }).dependencies ?? []) {
        depOf.set(t.id, [...(depOf.get(t.id) ?? []), d]);
      }
    }

    let inScope: Set<string>;
    let truncations: Array<{ id: string; count: number; label: string; attachTo: string; dir: 'in' | 'out' }> = [];

    if (mode === 'story' && filterStoryId) {
      inScope = new Set(tasks.filter((t) => t.story_id === filterStoryId).map((t) => t.id));
    } else if (focusTaskId) {
      // N 跳邻域（前置方向 + 后继方向）
      inScope = new Set([focusTaskId]);
      let frontier = new Set([focusTaskId]);
      for (let h = 0; h < hops; h++) {
        const next = new Set<string>();
        for (const id of frontier) {
          // 前置
          for (const dep of depOf.get(id) ?? []) {
            if (!inScope.has(dep)) next.add(dep);
          }
          // 后继
          for (const [tid, deps] of depOf) {
            if (deps.includes(id) && !inScope.has(tid)) next.add(tid);
          }
        }
        for (const id of next) inScope.add(id);
        frontier = next;
      }
    } else {
      inScope = new Set(tasks.map((t) => t.id));
    }

    // 范围内边 + 范围外截断计数
    const edges: Edge[] = [];
    const outsideIn = new Map<string, number>(); // scopeNode ← 外部来源计数
    const outsideOut = new Map<string, number>(); // scopeNode → 外部后继计数
    for (const [tid, deps] of depOf) {
      for (const dep of deps) {
        const bothIn = inScope.has(tid) && inScope.has(dep);
        if (bothIn) {
          edges.push({
            id: `e-${dep}-${tid}`,
            source: dep,
            target: tid,
            animated: false,
            style: { stroke: 'hsl(var(--border))', strokeWidth: 1.5 },
          });
        } else if (inScope.has(tid)) {
          outsideIn.set(tid, (outsideIn.get(tid) ?? 0) + 1);
        } else if (inScope.has(dep)) {
          outsideOut.set(dep, (outsideOut.get(dep) ?? 0) + 1);
        }
      }
    }

    const scopeTasks = tasks.filter((t) => inScope.has(t.id));
    const ns: Node[] = scopeTasks.map((t) => ({
      id: t.id,
      type: 'default',
      position: { x: 0, y: 0 },
      data: {
        label: (
          <div className="px-1 text-left">
            <p className="truncate text-[11px] font-medium">{t.title}</p>
            <p className="text-[9px] text-muted-foreground">{t.id} · {t.status}</p>
          </div>
        ),
      },
      style: {
        width: DEFAULT_NODE_W,
        height: DEFAULT_NODE_H,
        borderLeft: '3px solid',
      },
      className: statusCls(t.status),
    }));

    // 截断节点（每个 scope 节点的外部依赖聚合为一个）
    for (const [tid, count] of outsideIn) {
      const tidTrunc = `trunc-in-${tid}`;
      ns.push({
        id: tidTrunc,
        type: 'truncated',
        position: { x: 0, y: 0 },
        data: { count, label: '外部前置' },
        draggable: false,
        selectable: false,
      });
      edges.push({ id: `et-${tidTrunc}-${tid}`, source: tidTrunc, target: tid, style: { strokeDasharray: '4 3' } });
    }
    for (const [tid, count] of outsideOut) {
      const tidTrunc = `trunc-out-${tid}`;
      ns.push({
        id: tidTrunc,
        type: 'truncated',
        position: { x: 0, y: 0 },
        data: { count, label: '外部后继' },
        draggable: false,
        selectable: false,
      });
      edges.push({ id: `et-${tid}-${tidTrunc}`, source: tid, target: tidTrunc, style: { strokeDasharray: '4 3' } });
    }
    void truncations;

    return { graphNodes: ns, graphEdges: edges };
  }, [tasks, mode, filterStoryId, focusTaskId, hops]);

  const laidOut = useDagreLayoutStatic(graphNodes, graphEdges, { direction: 'TB' });

  return (
    <div className={className}>
      <ReactFlow
        nodes={laidOut}
        edges={graphEdges}
        nodeTypes={nodeTypes}
        minZoom={0.3}
        maxZoom={1.5}
        nodesConnectable={false}
        fitView
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="hsl(var(--border))" />
        <Panel position="top-right">
          <ZoomControls />
        </Panel>
        <Panel position="top-left">
          <div className="flex items-center gap-1 rounded-lg border bg-background/80 px-2 py-1 text-xs backdrop-blur-sm">
            <Button
              size="sm"
              variant={mode === 'story' ? 'default' : 'outline'}
              className="h-6 px-2 text-[11px]"
              onClick={() => setMode('story')}
              disabled={!filterStoryId}
            >
              按故事
            </Button>
            <Button
              size="sm"
              variant={mode === 'neighborhood' ? 'default' : 'outline'}
              className="h-6 px-2 text-[11px]"
              onClick={() => setMode('neighborhood')}
              disabled={!focusTaskId}
            >
              邻域 {hops} 跳
            </Button>
            {mode === 'neighborhood' && (
              <>
                <Button size="sm" variant="outline" className="h-6 w-6 p-0 text-[11px]" onClick={() => setHops((h) => Math.max(1, h - 1))}>−</Button>
                <Button size="sm" variant="outline" className="h-6 w-6 p-0 text-[11px]" onClick={() => setHops((h) => Math.min(3, h + 1))}>+</Button>
              </>
            )}
          </div>
        </Panel>
      </ReactFlow>
    </div>
  );
}

/** Handle 便捷导出（任务节点默认类型需要） */
export const DepHandles = () => (
  <>
    <Handle type="target" position={Position.Top} className="!h-1.5 !w-1.5 !bg-transparent !border-0" />
    <Handle type="source" position={Position.Bottom} className="!h-1.5 !w-1.5 !bg-transparent !border-0" />
  </>
);
