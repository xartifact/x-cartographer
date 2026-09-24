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
  type NodeProps,
} from '@xyflow/react';
import { Badge, Button } from '@x-cartographer/ui';
import { ZoomControls } from '@/features/story-map/components/zoom-controls';
import { useDagreLayoutStatic } from '../use-dagre-layout';

/**
 * DevTask 依赖图：默认全量展示，点击节点后可逐级展开邻域。
 * 依赖方向固定为 source（前置）→ target（后继）。
 */

const DEFAULT_NODE_W = 240;
const DEFAULT_NODE_H = 92;

type GraphMode = 'all' | 'story' | 'neighborhood';

interface DepGraphTask {
  id: string;
  title: string;
  status: string;
  priority?: string;
  estimation?: number;
  story_id?: string | null;
  module_id?: string | null;
  dependencies?: string[];
}

interface TaskDependencyGraphProps {
  tasks: DepGraphTask[];
  filterStoryId?: string | null;
  focusTaskId?: string | null;
  selectedTaskId?: string | null;
  onTaskSelect?: (taskId: string) => void;
  className?: string;
}

interface TaskNodeData extends Record<string, unknown> {
  task: DepGraphTask;
  onSelect?: (taskId: string) => void;
}

interface TruncatedNodeData extends Record<string, unknown> {
  count: number;
  label: string;
}

export function graphScopeIds(
  tasks: DepGraphTask[],
  mode: GraphMode,
  filterStoryId: string | null | undefined,
  focusTaskId: string | null | undefined,
  hops: number,
): string[] {
  const depOf = dependencyMap(tasks);
  if (mode === 'story' && filterStoryId) {
    return tasks.filter((task) => task.story_id === filterStoryId).map((task) => task.id);
  }
  if (mode === 'neighborhood' && focusTaskId) {
    return [...expandNeighborhood(focusTaskId, hops, depOf)];
  }
  return tasks.map((task) => task.id);
}

function TruncatedNode({ data }: NodeProps<Node<TruncatedNodeData>>) {
  return (
    <div className="flex h-12 w-[190px] items-center justify-center rounded-lg border border-dashed border-border/70 bg-muted/40 px-2 text-center">
      <span className="text-[10px] italic text-muted-foreground">
        + {data.count} 个外部任务（{data.label}）
      </span>
    </div>
  );
}

function statusCls(status: string): string {
  if (status === 'done') return 'border-l-green-500';
  if (status === 'in_progress') return 'border-l-blue-500';
  if (status === 'in_review') return 'border-l-purple-500';
  if (status === 'testing') return 'border-l-violet-500';
  if (status === 'cancelled') return 'border-l-muted-foreground/30 opacity-60';
  return 'border-l-amber-500';
}

function TaskNode({ data, selected }: NodeProps<Node<TaskNodeData>>) {
  const { task, onSelect } = data;
  return (
    <button
      type="button"
      className={`block h-full w-full rounded-lg border border-border/70 border-l-4 bg-background px-3 py-2 text-left shadow-sm transition hover:border-primary/70 hover:shadow-md ${statusCls(task.status)} ${selected ? 'ring-2 ring-primary ring-offset-2 ring-offset-background' : ''}`}
      onClick={() => onSelect?.(task.id)}
    >
      <div className="flex items-start gap-2">
        <span className="min-w-0 flex-1 truncate text-xs font-semibold">{task.title}</span>
        {task.priority && <Badge variant="outline" className="shrink-0 px-1 text-[9px]">{task.priority}</Badge>}
      </div>
      <div className="mt-2 flex items-center gap-2 text-[10px] text-muted-foreground">
        <span className="font-mono">{task.id}</span>
        <span>{task.status}</span>
        {task.estimation ? <span>{task.estimation}h</span> : null}
      </div>
      {(task.module_id || task.story_id) && (
        <div className="mt-1 truncate text-[9px] text-muted-foreground">
          {task.module_id ? `模块 · ${task.module_id}` : `故事 · ${task.story_id}`}
        </div>
      )}
      <Handle type="target" position={Position.Top} className="!h-1.5 !w-1.5 !border-0 !bg-transparent" />
      <Handle type="source" position={Position.Bottom} className="!h-1.5 !w-1.5 !border-0 !bg-transparent" />
    </button>
  );
}

const nodeTypes: NodeTypes = {
  task: TaskNode,
  truncated: TruncatedNode,
};

function dependencyMap(tasks: DepGraphTask[]): Map<string, string[]> {
  const known = new Set(tasks.map((task) => task.id));
  return new Map(
    tasks.map((task) => [
      task.id,
      (task.dependencies ?? []).filter((dependencyId) => known.has(dependencyId)),
    ])
  );
}

function expandNeighborhood(
  focusTaskId: string,
  hops: number,
  depOf: Map<string, string[]>,
): Set<string> {
  const inScope = new Set([focusTaskId]);
  let frontier = new Set([focusTaskId]);
  for (let hop = 0; hop < hops; hop += 1) {
    const next = new Set<string>();
    for (const id of frontier) {
      for (const dependencyId of depOf.get(id) ?? []) {
        if (!inScope.has(dependencyId)) next.add(dependencyId);
      }
      for (const [taskId, dependencies] of depOf) {
        if (dependencies.includes(id) && !inScope.has(taskId)) next.add(taskId);
      }
    }
    for (const id of next) inScope.add(id);
    frontier = next;
  }
  return inScope;
}

export function TaskDependencyGraph({
  tasks,
  filterStoryId,
  focusTaskId,
  selectedTaskId,
  onTaskSelect,
  className,
}: TaskDependencyGraphProps) {
  const [mode, setMode] = useState<GraphMode>('all');
  const [hops, setHops] = useState(1);
  const effectiveFocusTaskId = selectedTaskId ?? focusTaskId;

  const { graphNodes, graphEdges, visibleCount } = useMemo(() => {
    const depOf = dependencyMap(tasks);
    let inScope: Set<string>;
    if (mode === 'story' && filterStoryId) {
      inScope = new Set(tasks.filter((task) => task.story_id === filterStoryId).map((task) => task.id));
    } else if (mode === 'neighborhood' && effectiveFocusTaskId) {
      inScope = expandNeighborhood(effectiveFocusTaskId, hops, depOf);
    } else {
      inScope = new Set(tasks.map((task) => task.id));
    }

    const edges: Edge[] = [];
    const outsideIn = new Map<string, number>();
    const outsideOut = new Map<string, number>();
    for (const [taskId, dependencies] of depOf) {
      for (const dependencyId of dependencies) {
        if (inScope.has(taskId) && inScope.has(dependencyId)) {
          edges.push({
            id: `e-${dependencyId}-${taskId}`,
            source: dependencyId,
            target: taskId,
            style: { stroke: 'hsl(var(--border))', strokeWidth: 1.5 },
          });
        } else if (inScope.has(taskId)) {
          outsideIn.set(taskId, (outsideIn.get(taskId) ?? 0) + 1);
        } else if (inScope.has(dependencyId)) {
          outsideOut.set(dependencyId, (outsideOut.get(dependencyId) ?? 0) + 1);
        }
      }
    }

    const scopeTasks = tasks.filter((task) => inScope.has(task.id));
    const nodes: Node[] = scopeTasks.map((task) => ({
      id: task.id,
      type: 'task',
      position: { x: 0, y: 0 },
      data: { task, onSelect: onTaskSelect },
      style: { width: DEFAULT_NODE_W, height: DEFAULT_NODE_H },
      selected: task.id === selectedTaskId,
    }));

    for (const [taskId, count] of outsideIn) {
      const nodeId = `trunc-in-${taskId}`;
      nodes.push({
        id: nodeId,
        type: 'truncated',
        position: { x: 0, y: 0 },
        data: { count, label: '外部前置' },
        draggable: false,
        selectable: false,
      });
      edges.push({ id: `et-${nodeId}-${taskId}`, source: nodeId, target: taskId, style: { strokeDasharray: '4 3' } });
    }
    for (const [taskId, count] of outsideOut) {
      const nodeId = `trunc-out-${taskId}`;
      nodes.push({
        id: nodeId,
        type: 'truncated',
        position: { x: 0, y: 0 },
        data: { count, label: '外部后继' },
        draggable: false,
        selectable: false,
      });
      edges.push({ id: `et-${taskId}-${nodeId}`, source: taskId, target: nodeId, style: { strokeDasharray: '4 3' } });
    }

    return { graphNodes: nodes, graphEdges: edges, visibleCount: scopeTasks.length };
  }, [effectiveFocusTaskId, filterStoryId, hops, mode, onTaskSelect, selectedTaskId, tasks]);

  const laidOut = useDagreLayoutStatic(graphNodes, graphEdges, { direction: 'TB', nodeWidth: DEFAULT_NODE_W, nodeHeight: DEFAULT_NODE_H });

  return (
    <div data-fullscreen-target className={className}>
      <ReactFlow
        nodes={laidOut}
        edges={graphEdges}
        nodeTypes={nodeTypes}
        minZoom={0.2}
        maxZoom={1.8}
        nodesConnectable={false}
        fitView
        onNodeClick={(_event, node) => {
          if (node.type === 'task') onTaskSelect?.(node.id);
        }}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="hsl(var(--border))" />
        <Panel position="top-left">
          <div className="flex flex-wrap items-center gap-1 rounded-lg border bg-background/90 px-2 py-1 text-xs shadow-sm backdrop-blur-sm">
            <Button size="sm" variant={mode === 'all' ? 'default' : 'outline'} className="h-6 px-2 text-[11px]" onClick={() => setMode('all')}>
              全量
            </Button>
            <Button size="sm" variant={mode === 'story' ? 'default' : 'outline'} className="h-6 px-2 text-[11px]" onClick={() => setMode('story')} disabled={!filterStoryId}>
              按故事
            </Button>
            <Button size="sm" variant={mode === 'neighborhood' ? 'default' : 'outline'} className="h-6 px-2 text-[11px]" onClick={() => setMode('neighborhood')} disabled={!effectiveFocusTaskId}>
              逐级 {hops} 跳
            </Button>
            {mode === 'neighborhood' && (
              <>
                <Button size="sm" variant="outline" className="h-6 w-6 p-0 text-[11px]" onClick={() => setHops((value) => Math.max(1, value - 1))}>−</Button>
                <Button size="sm" variant="outline" className="h-6 w-6 p-0 text-[11px]" onClick={() => setHops((value) => Math.min(5, value + 1))}>+</Button>
              </>
            )}
            <span className="ml-1 text-[10px] text-muted-foreground">{visibleCount}/{tasks.length} 个任务</span>
          </div>
        </Panel>
        <Panel position="top-right">
          <ZoomControls />
        </Panel>
        <Panel position="bottom-left">
          <div className="rounded-lg border bg-background/90 px-2 py-1 text-[10px] text-muted-foreground shadow-sm">
            点击节点查看详情；“逐级”模式按上下游展开邻域
          </div>
        </Panel>
      </ReactFlow>
    </div>
  );
}

/** Handle 便捷导出（兼容既有节点扩展入口） */
export const DepHandles = () => (
  <>
    <Handle type="target" position={Position.Top} className="!h-1.5 !w-1.5 !bg-transparent !border-0" />
    <Handle type="source" position={Position.Bottom} className="!h-1.5 !w-1.5 !bg-transparent !border-0" />
  </>
);
