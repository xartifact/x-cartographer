'use client';

/**
 * 故事地图画布组件
 */

import { useCallback, useMemo, useRef, useState } from 'react';
import ReactFlow, {
  Background,
  Controls,
  BackgroundVariant,
  Panel,
  Node,
  Edge,
  NodeTypes,
} from 'reactflow';
import 'reactflow/dist/style.css';
import {
  Filter,
  GripVertical,
  Loader2,
  Map,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react';
import { StoryNode } from './story-node';
import { StoryDetailPanel } from './story-detail-panel';
import { StoryEditDialog } from './story-edit-dialog';
import { JourneyCreateDialog } from './journey-create-dialog';
import { JourneyEditDialog } from './journey-edit-dialog';
import { StoryCreateDialog } from './story-create-dialog';
import { FilterPanel } from './filter-panel';
import { ZoomControls } from './zoom-controls';
import { useStoryMapStore, filterStories } from '../stores/story-map-store';
import { Priority } from '@/types';
import { UserJourney, UserStory } from '@/types';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useProjectStore } from '@/features/projects/stores';
import { createLogger } from '@/lib/logger';
import { useRouter } from 'next/navigation';
import { toast } from '@/hooks/use-toast';

interface StoryMapCanvasProps {
  /** 用户旅程列表 */
  journeys: UserJourney[];
  /** 当前项目 ID */
  projectId: string;
  className?: string;
}

// 列宽和行高配置
const COLUMN_WIDTH = 300;
const ROW_HEIGHT = 220;
const HEADER_HEIGHT = 120;
const COLUMN_GAP = 40;

const log = createLogger('storyMapCanvas');

// 自定义节点类型 - 使用类型断言
// TODO: 为 React Flow 节点添加正确的类型定义
const _nodeTypes: NodeTypes = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  story: StoryNode as any,
};

// 旅程头组件（带添加故事 + 编辑/删除菜单）
function JourneyHeader({
  data,
}: {
  data: {
    journeyName: string;
    journeyId: string;
    storyCount: number;
    onAddStory?: (journeyId: string, journeyName: string) => void;
    onEditJourney?: (journeyId: string) => void;
    onDeleteJourney?: (journeyId: string, journeyName: string) => void;
  };
}) {
  return (
    <div className="flex items-center justify-center">
      <div className="relative w-64 rounded-lg border border-primary/20 bg-primary/5 p-4 text-center">
        {/* 拖拽手柄 */}
        <div className="drag-handle absolute left-0.5 top-1/2 z-10 -translate-y-1/2 rounded-sm p-0.5 text-muted-foreground/30 transition-all hover:bg-muted hover:text-muted-foreground">
          <GripVertical className="h-4 w-4" />
        </div>
        {/* 右上角操作菜单 */}
        {(data.onEditJourney || data.onDeleteJourney) && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="absolute right-1.5 top-1.5 rounded-md p-1 text-muted-foreground/60 transition-colors hover:bg-muted hover:text-foreground"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreHorizontal className="h-3.5 w-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-36">
              {data.onEditJourney && (
                <DropdownMenuItem
                  onClick={() => data.onEditJourney!(data.journeyId)}
                >
                  <Pencil className="mr-2 h-3 w-3" />
                  编辑旅程
                </DropdownMenuItem>
              )}
              {data.onDeleteJourney && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={() =>
                      data.onDeleteJourney!(data.journeyId, data.journeyName)
                    }
                  >
                    <Trash2 className="mr-2 h-3 w-3" />
                    删除旅程
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        <h3 className="line-clamp-2 text-sm font-semibold">
          {data.journeyName}
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">
          {data.storyCount} 个故事
        </p>
        {data.onAddStory && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              data.onAddStory!(data.journeyId, data.journeyName);
            }}
            className="mt-2 inline-flex items-center gap-1 rounded-md border border-dashed border-primary/40 px-2 py-0.5 text-xs text-primary/70 transition-colors hover:border-primary hover:bg-primary/10 hover:text-primary"
          >
            <Plus className="h-3 w-3" />
            添加故事
          </button>
        )}
      </div>
    </div>
  );
}

// 空节点组件
function EmptyNode() {
  return (
    <div className="flex h-24 w-64 items-center justify-center">
      <p className="text-sm italic text-muted-foreground">暂无故事</p>
    </div>
  );
}

// 拖拽列高亮指示器节点（覆盖整列的半透明背景）
function DropColumnIndicator({ data }: { data: { columnHeight: number } }) {
  return (
    <div
      className="drag-column-highlight pointer-events-none rounded-xl border-2 border-dashed border-primary/40 bg-primary/5"
      style={{
        width: `${COLUMN_WIDTH + COLUMN_GAP}px`,
        height: `${Math.max(data.columnHeight, 300)}px`,
      }}
    />
  );
}

// 拖拽插入位置指示线节点（水平线 + 两端圆点）
function DropInsertLine() {
  return (
    <div
      className="drag-insert-line pointer-events-none"
      style={{ width: `${COLUMN_WIDTH - 16}px` }}
    >
      <div className="flex items-center">
        <div className="h-2.5 w-2.5 shrink-0 rounded-full bg-primary shadow-sm shadow-primary/50" />
        <div className="h-0.5 flex-1 bg-primary shadow-sm shadow-primary/50" />
        <div className="h-2.5 w-2.5 shrink-0 rounded-full bg-primary shadow-sm shadow-primary/50" />
      </div>
    </div>
  );
}

// 合并节点类型
// TODO: 为 React Flow 节点添加正确的类型定义
const allNodeTypes: NodeTypes = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  story: StoryNode as any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  journeyHeader: JourneyHeader as any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  empty: EmptyNode as any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  dropColumnIndicator: DropColumnIndicator as any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  dropInsertLine: DropInsertLine as any,
};

export function StoryMapCanvas({
  journeys,
  projectId,
  className,
}: StoryMapCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingStory, setEditingStory] = useState<UserStory | null>(null);

  // 新建旅程对话框
  const [journeyCreateOpen, setJourneyCreateOpen] = useState(false);

  // 编辑旅程对话框
  const [journeyEditOpen, setJourneyEditOpen] = useState(false);
  const [editingJourney, setEditingJourney] = useState<UserJourney | null>(
    null
  );

  // 删除确认对话框（旅程/故事复用）
  const [deleteConfirm, setDeleteConfirm] = useState<{
    type: 'journey' | 'story';
    id: string;
    name: string;
  } | null>(null);

  // 新建故事对话框
  const [storyCreateOpen, setStoryCreateOpen] = useState(false);
  const [storyCreateTarget, setStoryCreateTarget] = useState<{
    journeyId: string;
    journeyName: string;
  }>({ journeyId: '', journeyName: '' });

  // 拖拽状态
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [draggingNodeType, setDraggingNodeType] = useState<string | null>(null);
  const [dragOverJourneyIndex, setDragOverJourneyIndex] = useState<
    number | null
  >(null);
  const [dragOverRowIndex, setDragOverRowIndex] = useState<number | null>(null);

  // 筛选面板可见性
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);

  // 从 store 获取状态
  const { selectedStory, setSelectedStory, filter } = useStoryMapStore();

  const { projects, modifyProject } = useProjectStore();
  const project = useMemo(
    () => projects.find((p) => p.id === projectId),
    [projects, projectId]
  );

  // 从响应式 project 中推导当前选中故事，确保 modifyProject 后数据是最新的
  const selectedStoryLive = useMemo(() => {
    if (!selectedStory || !project) return selectedStory;
    for (const journey of project.user_journeys) {
      const found = journey.stories?.find((s) => s.id === selectedStory.id);
      if (found) return found;
    }
    return selectedStory;
  }, [project, selectedStory]);

  // 筛选后的旅程（按 order 排序，支持拖拽重排）
  const filteredJourneys = useMemo(
    () => filterStories(journeys, filter).sort((a, b) => a.order - b.order),
    [journeys, filter]
  );

  // ---------- 拖拽事件处理 ----------

  /** 拖拽开始 - 记录正在拖拽的节点 ID 和类型 */
  const onNodeDragStart = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (_: React.MouseEvent, node: Node<any>) => {
      log.info('drag.start', { nodeId: node.id, type: node.type });
      setDraggingNodeId(node.id);
      setDraggingNodeType(node.type ?? null);
      setDragOverJourneyIndex(null);
      setDragOverRowIndex(null);
    },
    []
  );

  /** 拖拽中 - 计算当前悬停的列索引和行位置，用于视觉反馈 */
  const onNodeDrag = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (_: React.MouseEvent, node: Node<any>) => {
      if (filteredJourneys.length === 0) return;
      // 根据节点 x 坐标计算目标列索引
      const targetIndex = Math.round(
        (node.position.x - COLUMN_GAP) / (COLUMN_WIDTH + COLUMN_GAP)
      );
      // 限制在有效范围内
      const clampedIndex = Math.max(
        0,
        Math.min(targetIndex, filteredJourneys.length - 1)
      );
      setDragOverJourneyIndex(clampedIndex);

      // 计算目标行位置（仅故事节点需要插入线指示器）
      if (node.type === 'story') {
        const targetRow = Math.round(
          (node.position.y - HEADER_HEIGHT) / ROW_HEIGHT
        );
        const targetJourney = filteredJourneys[clampedIndex];
        const maxRow = targetJourney?.stories?.length ?? 0;
        const clampedRow = Math.max(0, Math.min(targetRow, maxRow));
        setDragOverRowIndex(clampedRow);
      } else {
        setDragOverRowIndex(null);
      }
    },
    [filteredJourneys]
  );

  /** 拖拽结束 - 计算新位置并持久化 */
  const onNodeDragStop = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async (_: React.MouseEvent, node: Node<any>) => {
      log.info('drag.stop.start', {
        nodeId: node.id,
        type: node.type,
        position: node.position,
      });
      setDraggingNodeId(null);
      setDraggingNodeType(null);
      setDragOverJourneyIndex(null);
      setDragOverRowIndex(null);

      if (!project) {
        log.warn('drag.stop.aborted', { reason: 'project is undefined' });
        return;
      }

      try {
        // 处理旅程头节点拖拽
        if (node.type === 'journeyHeader') {
          const journeyId = node.id.replace('journey-header-', '');
          const sourceIndex = filteredJourneys.findIndex(
            (j) => j.id === journeyId
          );
          if (sourceIndex === -1) return;

          // 计算目标列索引
          const targetIndex = Math.round(
            (node.position.x - COLUMN_GAP) / (COLUMN_WIDTH + COLUMN_GAP)
          );
          const clampedTarget = Math.max(
            0,
            Math.min(targetIndex, filteredJourneys.length - 1)
          );

          log.info('drag.stop.journey', {
            journeyId,
            fromIndex: sourceIndex,
            toIndex: clampedTarget,
          });

          if (clampedTarget === sourceIndex) {
            log.info('drag.stop.journey.noChange', { journeyId });
            return;
          }

          // 重新排序旅程数组
          const reordered = [...filteredJourneys];
          const [moved] = reordered.splice(sourceIndex, 1);
          reordered.splice(clampedTarget, 0, moved);

          // 更新所有旅程的 order 字段
          const updatedJourneys = reordered.map((j, idx) => ({
            ...j,
            order: idx,
          }));

          await modifyProject(project.id, { user_journeys: updatedJourneys });
          log.info('drag.stop.journey.success', {
            journeyId,
            newOrder: clampedTarget,
          });
          toast({
            title: '旅程已重排',
            description: `「${moved.name}」已移至第 ${clampedTarget + 1} 位`,
          });
          return;
        }

        // 处理故事节点拖拽
        if (node.type === 'story') {
          const storyId = node.id.replace('story-', '');
          const sourceJourney = project.user_journeys.find((j) =>
            j.stories?.some((s) => s.id === storyId)
          );
          if (!sourceJourney) return;

          const sourceStory = sourceJourney.stories?.find(
            (s) => s.id === storyId
          );
          if (!sourceStory) return;

          const sourceIndex = sourceJourney.stories.findIndex(
            (s) => s.id === storyId
          );

          // 计算目标旅程索引
          const targetJourneyIndex = Math.round(
            (node.position.x - COLUMN_GAP) / (COLUMN_WIDTH + COLUMN_GAP)
          );
          const clampedTargetJourney = Math.max(
            0,
            Math.min(targetJourneyIndex, filteredJourneys.length - 1)
          );
          const targetJourney = filteredJourneys[clampedTargetJourney];
          if (!targetJourney) return;

          // 计算目标行位置（order）
          const targetOrder = Math.round(
            (node.position.y - HEADER_HEIGHT) / ROW_HEIGHT
          );
          const maxOrder =
            (targetJourney.stories?.length || 0) +
            (sourceJourney.id === targetJourney.id ? -1 : 0);
          const clampedOrder = Math.max(
            0,
            Math.min(targetOrder, Math.max(0, maxOrder))
          );

          const isSameJourney = sourceJourney.id === targetJourney.id;

          log.info('drag.stop.story', {
            storyId,
            sourceJourneyId: sourceJourney.id,
            targetJourneyId: targetJourney.id,
            sourceIndex,
            targetOrder: clampedOrder,
            isSameJourney,
          });

          let updatedJourneys: typeof project.user_journeys;

          if (isSameJourney) {
            // 同旅程内重排：移动故事
            const stories = [...(sourceJourney.stories || [])];
            const [moved] = stories.splice(sourceIndex, 1);
            stories.splice(clampedOrder, 0, moved);
            // 更新 order 字段
            const reorderedStories = stories.map((s, idx) => ({
              ...s,
              order: idx,
            }));
            updatedJourneys = project.user_journeys.map((j) =>
              j.id === sourceJourney.id
                ? { ...j, stories: reorderedStories }
                : j
            );
          } else {
            // 跨旅程移动
            const sourceStories = (sourceJourney.stories || []).filter(
              (s) => s.id !== storyId
            );
            const targetStories = [...(targetJourney.stories || [])];
            const movedStory = { ...sourceStory, journey_id: targetJourney.id };
            targetStories.splice(clampedOrder, 0, movedStory);

            // 更新 order 字段
            const reorderedSource = sourceStories.map((s, idx) => ({
              ...s,
              order: idx,
            }));
            const reorderedTarget = targetStories.map((s, idx) => ({
              ...s,
              order: idx,
            }));

            updatedJourneys = project.user_journeys.map((j) => {
              if (j.id === sourceJourney.id)
                return { ...j, stories: reorderedSource };
              if (j.id === targetJourney.id)
                return { ...j, stories: reorderedTarget };
              return j;
            });
          }

          await modifyProject(project.id, { user_journeys: updatedJourneys });
          log.info('drag.stop.story.success', {
            storyId,
            newJourneyId: targetJourney.id,
            newOrder: clampedOrder,
          });
          toast({
            title: '故事已重排',
            description: isSameJourney
              ? `「${sourceStory.title}」已移至第 ${clampedOrder + 1} 位`
              : `「${sourceStory.title}」已移至「${targetJourney.name}」`,
          });
        }
      } catch (err) {
        log.error('drag.stop.failed', { nodeId: node.id, error: err });
        toast({
          title: '重排失败',
          description: err instanceof Error ? err.message : '未知错误',
          variant: 'destructive',
        });
      }
    },
    [project, filteredJourneys, modifyProject]
  );

  /** 触发"添加故事"对话框（从旅程头节点调用） */
  const handleOpenStoryCreate = useCallback(
    (journeyId: string, journeyName: string) => {
      setStoryCreateTarget({ journeyId, journeyName });
      setStoryCreateOpen(true);
    },
    []
  );

  /** 打开编辑旅程对话框 */
  const handleEditJourney = useCallback(
    (journeyId: string) => {
      const journey = (project?.user_journeys ?? []).find(
        (j) => j.id === journeyId
      );
      if (journey) {
        log.info('journey.editOpen', { id: journeyId, name: journey.name });
        setEditingJourney(journey);
        setJourneyEditOpen(true);
      }
    },
    [project]
  );

  /** 打开删除旅程确认对话框 */
  const handleDeleteJourney = useCallback(
    (journeyId: string, journeyName: string) => {
      log.info('journey.deleteConfirmOpen', {
        id: journeyId,
        name: journeyName,
      });
      setDeleteConfirm({ type: 'journey', id: journeyId, name: journeyName });
    },
    []
  );

  // 计算节点和边
  const { nodes, edges } = useMemo(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const newNodes: Node<any>[] = [];
    const newEdges: Edge[] = [];

    let currentX = COLUMN_GAP;

    filteredJourneys.forEach((journey) => {
      // 添加旅程头节点
      newNodes.push({
        id: `journey-header-${journey.id}`,
        type: 'journeyHeader',
        position: { x: currentX, y: 0 },
        data: {
          journeyName: journey.name,
          journeyId: journey.id,
          storyCount: journey.stories?.length || 0,
          onAddStory: handleOpenStoryCreate,
          onEditJourney: handleEditJourney,
          onDeleteJourney: handleDeleteJourney,
        },
        draggable: true,
        dragHandle: '.drag-handle',
      });

      // 按 order 字段排序故事（支持拖拽重排）
      const sortedStories = [...(journey.stories || [])].sort(
        (a, b) => a.order - b.order
      );

      // 添加故事节点
      sortedStories.forEach((story, storyIndex) => {
        const nodeId = `story-${story.id}`;
        const nodeY = HEADER_HEIGHT + storyIndex * ROW_HEIGHT;

        newNodes.push({
          id: nodeId,
          type: 'story',
          position: { x: currentX, y: nodeY },
          data: {
            story,
            journeyName: journey.name,
            isSelected: selectedStory?.id === story.id,
            onSelect: (s: UserStory) => setSelectedStory(s),
          },
          draggable: true,
          dragHandle: '.drag-handle',
        });

        // 创建连接线
        if (storyIndex === 0) {
          newEdges.push({
            id: `edge-${journey.id}-${story.id}`,
            source: `journey-header-${journey.id}`,
            target: nodeId,
            type: 'smoothstep',
            animated: false,
            style: { stroke: 'hsl(var(--border))', strokeWidth: 1 },
          });
        } else {
          const prevStory = sortedStories[storyIndex - 1];
          newEdges.push({
            id: `edge-${journey.id}-${story.id}`,
            source: `story-${prevStory.id}`,
            target: nodeId,
            type: 'smoothstep',
            animated: false,
            style: { stroke: 'hsl(var(--border))', strokeWidth: 1 },
          });
        }
      });

      // 添加空节点占位
      if (sortedStories.length === 0) {
        newNodes.push({
          id: `empty-${journey.id}`,
          type: 'empty',
          position: { x: currentX, y: HEADER_HEIGHT },
          data: {},
          draggable: false,
        });
      }

      currentX += COLUMN_WIDTH + COLUMN_GAP;
    });

    return { nodes: newNodes, edges: newEdges };
  }, [
    filteredJourneys,
    selectedStory,
    setSelectedStory,
    handleOpenStoryCreate,
    handleEditJourney,
    handleDeleteJourney,
  ]);

  // 合并拖拽指示器节点（作为 React Flow 节点，自动跟随画布缩放/平移）
  const nodesWithIndicators = useMemo(() => {
    if (!draggingNodeId || dragOverJourneyIndex === null) return nodes;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const indicatorNodes: Node<any>[] = [];

    // 列高亮指示器
    const targetJourney = filteredJourneys[dragOverJourneyIndex];
    const columnStoryCount = targetJourney?.stories?.length ?? 0;
    const columnHeight =
      HEADER_HEIGHT + Math.max(columnStoryCount, 1) * ROW_HEIGHT + 40;
    indicatorNodes.push({
      id: '__drop-column-indicator__',
      type: 'dropColumnIndicator',
      position: {
        x: dragOverJourneyIndex * (COLUMN_WIDTH + COLUMN_GAP) + COLUMN_GAP / 2,
        y: -20,
      },
      data: { columnHeight },
      draggable: false,
      selectable: false,
      zIndex: -1,
    });

    // 插入位置指示线（仅故事拖拽时显示）
    if (draggingNodeType === 'story' && dragOverRowIndex !== null) {
      indicatorNodes.push({
        id: '__drop-insert-line__',
        type: 'dropInsertLine',
        position: {
          x:
            dragOverJourneyIndex * (COLUMN_WIDTH + COLUMN_GAP) + COLUMN_GAP + 8,
          y: HEADER_HEIGHT + dragOverRowIndex * ROW_HEIGHT - 6,
        },
        data: {},
        draggable: false,
        selectable: false,
        zIndex: 999,
      });
    }

    return [...nodes, ...indicatorNodes];
  }, [
    nodes,
    draggingNodeId,
    draggingNodeType,
    dragOverJourneyIndex,
    dragOverRowIndex,
    filteredJourneys,
  ]);

  // 处理节点点击
  const onNodeClick = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (_: React.MouseEvent, node: Node<any>) => {
      if (node.type === 'story' && node.data.story) {
        setSelectedStory(node.data.story);
      }
    },
    [setSelectedStory]
  );

  // 处理画布点击
  const onPaneClick = useCallback(() => {
    setSelectedStory(null);
  }, [setSelectedStory]);

  // 保存故事编辑
  const handleSaveStory = useCallback(
    async (updated: UserStory) => {
      if (!project) {
        log.warn('story.save.aborted', { reason: 'project is undefined' });
        toast({
          title: '操作失败',
          description: '项目数据未加载',
          variant: 'destructive',
        });
        return;
      }
      try {
        log.info('story.save', { id: updated.id, title: updated.title });
        const updatedJourneys = project.user_journeys.map((journey) => ({
          ...journey,
          stories: journey.stories?.map((s) =>
            s.id === updated.id ? updated : s
          ),
        }));
        await modifyProject(project.id, { user_journeys: updatedJourneys });
        // 如果当前选中的就是被编辑的故事，更新选中状态
        if (selectedStory?.id === updated.id) {
          setSelectedStory(updated);
        }
        toast({
          title: '故事已更新',
          description: `「${updated.title}」保存成功`,
        });
      } catch (err) {
        log.error('story.save.failed', { error: err });
        toast({
          title: '保存故事失败',
          description: err instanceof Error ? err.message : '未知错误',
          variant: 'destructive',
        });
        throw err;
      }
    },
    [project, modifyProject, selectedStory, setSelectedStory]
  );

  // 查找选中故事对应的旅程名称
  const selectedJourneyName = useMemo(() => {
    if (!selectedStoryLive) return undefined;
    const journey = journeys.find((j) => j.id === selectedStoryLive.journey_id);
    return journey?.name;
  }, [selectedStoryLive, journeys]);

  // ---------- 新建旅程 ----------

  /** 创建新用户旅程 */
  const handleCreateJourney = useCallback(
    async (data: { name: string; description: string; persona: string }) => {
      log.info('journey.create.start', {
        projectId,
        hasProject: !!project,
        data,
      });
      if (!project) {
        log.warn('journey.create.aborted', {
          reason: 'project is undefined',
          projectId,
        });
        toast({
          title: '操作失败',
          description: '项目数据未加载，请刷新页面后重试',
          variant: 'destructive',
        });
        return;
      }

      try {
        const existingJourneys = project.user_journeys ?? [];
        // 生成下一个 UJ ID
        const maxIndex = existingJourneys.reduce((max, j) => {
          const match = j.id.match(/UJ-(\d+)/);
          return match ? Math.max(max, parseInt(match[1], 10)) : max;
        }, 0);
        const newId = `UJ-${String(maxIndex + 1).padStart(3, '0')}`;
        const now = new Date().toISOString();

        const newJourney: UserJourney = {
          id: newId,
          name: data.name,
          description: data.description,
          persona: data.persona,
          project_id: projectId,
          stories: [],
          order: existingJourneys.length,
          created_at: now,
          updated_at: now,
        };

        log.info('journey.create', { id: newId, name: data.name });

        const updatedJourneys = [...existingJourneys, newJourney];
        await modifyProject(project.id, { user_journeys: updatedJourneys });
        log.info('journey.create.success', { id: newId });
        toast({ title: '旅程已创建', description: `「${data.name}」创建成功` });
      } catch (err) {
        log.error('journey.create.failed', { error: err });
        toast({
          title: '创建旅程失败',
          description: err instanceof Error ? err.message : '未知错误',
          variant: 'destructive',
        });
        throw err; // re-throw so the dialog knows save failed
      }
    },
    [project, projectId, modifyProject]
  );

  /** 创建新用户故事 */
  const handleCreateStory = useCallback(
    async (data: {
      journeyId: string;
      title: string;
      description: string;
      priority: Priority;
      estimation: number;
      acceptance_criteria: string[];
      tags: string[];
    }) => {
      log.info('story.create.start', {
        projectId,
        hasProject: !!project,
        journeyId: data.journeyId,
      });
      if (!project) {
        log.warn('story.create.aborted', {
          reason: 'project is undefined',
          projectId,
        });
        toast({
          title: '操作失败',
          description: '项目数据未加载，请刷新页面后重试',
          variant: 'destructive',
        });
        return;
      }

      try {
        // 收集所有已存在的故事 ID 中的最大序号
        const allStories = (project.user_journeys ?? []).flatMap(
          (j) => j.stories ?? []
        );
        const maxIndex = allStories.reduce((max, s) => {
          const match = s.id.match(/US-(\d+)/);
          return match ? Math.max(max, parseInt(match[1], 10)) : max;
        }, 0);
        const newId = `US-${String(maxIndex + 1).padStart(3, '0')}`;
        const now = new Date().toISOString();

        const newStory: UserStory = {
          id: newId,
          title: data.title,
          description: data.description,
          priority: data.priority,
          estimation: data.estimation,
          acceptance_criteria: data.acceptance_criteria,
          tags: data.tags,
          journey_id: data.journeyId,
          tasks: [],
          order: allStories.filter((s) => s.journey_id === data.journeyId)
            .length,
          status: 'backlog',
          created_at: now,
          updated_at: now,
        };

        log.info('story.create', {
          id: newId,
          title: data.title,
          journeyId: data.journeyId,
        });

        const updatedJourneys = (project.user_journeys ?? []).map((j) =>
          j.id === data.journeyId
            ? { ...j, stories: [...(j.stories ?? []), newStory] }
            : j
        );
        await modifyProject(project.id, { user_journeys: updatedJourneys });
        log.info('story.create.success', { id: newId });
        toast({
          title: '故事已创建',
          description: `「${data.title}」创建成功`,
        });
      } catch (err) {
        log.error('story.create.failed', { error: err });
        toast({
          title: '创建故事失败',
          description: err instanceof Error ? err.message : '未知错误',
          variant: 'destructive',
        });
        throw err;
      }
    },
    [project, projectId, modifyProject]
  );

  // ---------- 编辑旅程 ----------

  /** 保存旅程编辑 */
  const handleSaveJourney = useCallback(
    async (updated: UserJourney) => {
      if (!project) {
        log.warn('journey.save.aborted', { reason: 'project is undefined' });
        toast({
          title: '操作失败',
          description: '项目数据未加载',
          variant: 'destructive',
        });
        return;
      }
      try {
        log.info('journey.save', { id: updated.id, name: updated.name });
        const updatedJourneys = project.user_journeys.map((j) =>
          j.id === updated.id ? updated : j
        );
        await modifyProject(project.id, { user_journeys: updatedJourneys });
        toast({
          title: '旅程已更新',
          description: `「${updated.name}」保存成功`,
        });
      } catch (err) {
        log.error('journey.save.failed', { error: err });
        toast({
          title: '保存旅程失败',
          description: err instanceof Error ? err.message : '未知错误',
          variant: 'destructive',
        });
        throw err;
      }
    },
    [project, modifyProject]
  );

  // ---------- 删除故事 ----------

  /** 打开删除故事确认对话框 */
  const handleDeleteStory = useCallback(
    (storyId: string, storyTitle: string) => {
      log.info('story.deleteConfirmOpen', { id: storyId, title: storyTitle });
      setDeleteConfirm({ type: 'story', id: storyId, name: storyTitle });
    },
    []
  );

  // ---------- 确认删除（旅程/故事通用） ----------

  /** 执行确认删除操作 */
  const handleConfirmDelete = useCallback(async () => {
    if (!project || !deleteConfirm) return;

    log.info('delete.confirm', {
      type: deleteConfirm.type,
      id: deleteConfirm.id,
    });

    try {
      if (deleteConfirm.type === 'journey') {
        // 删除旅程
        const updatedJourneys = project.user_journeys.filter(
          (j) => j.id !== deleteConfirm.id
        );
        await modifyProject(project.id, { user_journeys: updatedJourneys });
        log.info('journey.deleted', { id: deleteConfirm.id });
        toast({
          title: '旅程已删除',
          description: `「${deleteConfirm.name}」已删除`,
        });
      } else {
        // 删除故事
        const updatedJourneys = project.user_journeys.map((j) => ({
          ...j,
          stories: (j.stories ?? []).filter((s) => s.id !== deleteConfirm.id),
        }));
        await modifyProject(project.id, { user_journeys: updatedJourneys });
        // 如果删除的是当前选中故事，清空选中
        if (selectedStory?.id === deleteConfirm.id) {
          setSelectedStory(null);
        }
        log.info('story.deleted', { id: deleteConfirm.id });
        toast({
          title: '故事已删除',
          description: `「${deleteConfirm.name}」已删除`,
        });
      }
    } catch (err) {
      log.error('delete.failed', {
        type: deleteConfirm.type,
        id: deleteConfirm.id,
        error: err,
      });
      toast({
        title: '删除失败',
        description: err instanceof Error ? err.message : '未知错误',
        variant: 'destructive',
      });
    }

    setDeleteConfirm(null);
  }, [project, deleteConfirm, modifyProject, selectedStory, setSelectedStory]);

  // 空状态
  if (journeys.length === 0) {
    return (
      <>
        <div
          className={cn(
            'flex h-96 items-center justify-center rounded-lg border',
            className
          )}
        >
          <div className="text-center">
            <Map className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
            <h3 className="mb-2 text-lg font-medium">暂无用户旅程</h3>
            <p className="mb-4 text-sm text-muted-foreground">
              创建第一个用户旅程来开始规划产品
            </p>
            <div className="flex items-center justify-center gap-2">
              <Button size="sm" onClick={() => setJourneyCreateOpen(true)}>
                <Plus className="mr-1.5 h-4 w-4" />
                添加旅程
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  router.push(`/projects/${projectId}/requirements`)
                }
              >
                前往需求分析
              </Button>
            </div>
          </div>
        </div>

        {/* 新建旅程对话框 */}
        <JourneyCreateDialog
          open={journeyCreateOpen}
          onOpenChange={setJourneyCreateOpen}
          onSave={handleCreateJourney}
        />
      </>
    );
  }

  // 空筛选结果
  if (filteredJourneys.length === 0) {
    return (
      <div
        className={cn(
          'flex h-96 items-center justify-center rounded-lg border',
          className
        )}
      >
        <div className="text-center">
          <Loader2 className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
          <h3 className="mb-2 text-lg font-medium">无匹配的故事</h3>
          <p className="text-sm text-muted-foreground">尝试调整筛选条件</p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      data-story-map-canvas
      className={cn('relative h-full', className)}
    >
      {/* React Flow 画布 */}
      <ReactFlow
        nodes={nodesWithIndicators}
        edges={edges}
        nodeTypes={allNodeTypes}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        onNodeDragStart={onNodeDragStart}
        onNodeDrag={onNodeDrag}
        onNodeDragStop={onNodeDragStop}
        minZoom={0.25}
        maxZoom={2}
        zoomOnScroll={true}
        zoomOnPinch={true}
        panOnScroll={true}
        panOnDrag={true}
        fitView={false}
        nodesDraggable={true}
        nodesConnectable={false}
        className="bg-background"
      >
        {/* 背景网格 */}
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1}
          color="hsl(var(--border))"
        />

        {/* 缩放控制 */}
        <Panel position="top-right">
          <ZoomControls />
        </Panel>

        {/* 旅程统计 + 添加按钮 */}
        <Panel position="top-left">
          <div className="flex items-center gap-2">
            <div className="rounded-lg border bg-background/80 px-3 py-1.5 text-sm text-muted-foreground backdrop-blur-sm">
              <span className="font-medium">{filteredJourneys.length}</span>{' '}
              个旅程，
              <span className="ml-1 font-medium">
                {filteredJourneys.reduce(
                  (acc, j) => acc + (j.stories?.length || 0),
                  0
                )}
              </span>{' '}
              个故事
            </div>
            <Button
              size="sm"
              variant="outline"
              className="h-8 gap-1 bg-background/80 backdrop-blur-sm"
              onClick={() => setJourneyCreateOpen(true)}
            >
              <Plus className="h-3.5 w-3.5" />
              添加旅程
            </Button>
            <Button
              size="sm"
              variant={filterPanelOpen ? 'default' : 'outline'}
              className="h-8 gap-1 bg-background/80 backdrop-blur-sm"
              onClick={() => setFilterPanelOpen((v) => !v)}
            >
              <Filter className="h-3.5 w-3.5" />
              筛选
            </Button>
          </div>
        </Panel>

        {/* 控制按钮 */}
        <Controls
          className="rounded-lg border bg-background shadow-sm"
          showZoom={false}
          showFitView={true}
          showInteractive={false}
        />
      </ReactFlow>

      {/* 筛选面板 — 浮层，左侧 */}
      {filterPanelOpen && (
        <div className="absolute bottom-4 left-4 top-4 z-10 overflow-y-auto rounded-lg shadow-lg">
          <FilterPanel journeys={journeys} />
        </div>
      )}

      {/* 详情面板 — 浮层，右侧 */}
      {project && selectedStoryLive && (
        <div className="absolute bottom-4 right-4 top-4 z-10 overflow-y-auto rounded-lg shadow-lg">
          <StoryDetailPanel
            story={selectedStoryLive}
            journeyName={selectedJourneyName}
            project={project}
            onClose={() => setSelectedStory(null)}
            onEdit={(s) => {
              setEditingStory(s);
              setEditDialogOpen(true);
            }}
            onDelete={(s) => handleDeleteStory(s.id, s.title)}
          />
        </div>
      )}

      {/* 故事编辑对话框 */}
      <StoryEditDialog
        open={editDialogOpen}
        story={editingStory}
        onOpenChange={setEditDialogOpen}
        onSave={handleSaveStory}
      />

      {/* 新建旅程对话框 */}
      <JourneyCreateDialog
        open={journeyCreateOpen}
        onOpenChange={setJourneyCreateOpen}
        onSave={handleCreateJourney}
      />

      {/* 新建故事对话框 */}
      <StoryCreateDialog
        open={storyCreateOpen}
        onOpenChange={setStoryCreateOpen}
        journeyId={storyCreateTarget.journeyId}
        journeyName={storyCreateTarget.journeyName}
        onSave={handleCreateStory}
      />

      {/* 编辑旅程对话框 */}
      <JourneyEditDialog
        open={journeyEditOpen}
        journey={editingJourney}
        onOpenChange={setJourneyEditOpen}
        onSave={handleSaveJourney}
      />

      {/* 删除确认对话框 */}
      <Dialog
        open={deleteConfirm !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteConfirm(null);
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              确认删除{deleteConfirm?.type === 'journey' ? '旅程' : '故事'}
            </DialogTitle>
            <DialogDescription>
              {deleteConfirm?.type === 'journey'
                ? `确定要删除旅程「${deleteConfirm?.name}」及其所有故事吗？此操作不可撤销。`
                : `确定要删除故事「${deleteConfirm?.name}」吗？此操作不可撤销。`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>
              取消
            </Button>
            <Button variant="destructive" onClick={handleConfirmDelete}>
              删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
