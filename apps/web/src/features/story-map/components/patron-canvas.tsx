'use client';

/**
 * PatronCanvas —— 经典用户故事地图布局（Patton 原典模式，AB 实验组件）
 *
 * 空间语义（与 story-map-canvas 的"活动=列"模式相对）：
 * - 横向：活动 = 横跨其任务列的宽头；列 = 用户任务（窄列，一卡宽）；位置即顺序，无箭头
 * - 纵向：重要性阶梯 —— 列内故事按 order 自上而下，头行横向连读 = walking skeleton
 * - 发布切片：横向全宽虚线切带（按 milestone 分带）+ 卡片版本徽章
 * - 拖拽：x → 落入任务列（改 user_task_id），y → 列内 order
 *
 * 见 docs/design/story-map-redesign.md §3.2 与 Patton《User Story Mapping》ch.3。
 */

import { useCallback, useMemo, useState } from 'react';
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Panel,
  Handle,
  Position,
  type Node,
  type NodeTypes,
  type Edge,
} from '@xyflow/react';
import { useQueryClient } from '@tanstack/react-query';
import { Plus, Map as MapIcon, MoreHorizontal, Pencil, Trash2, GripVertical, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent, Button, Input, DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@x-cartographer/ui';
import { createLogger } from '@/lib/logger';
import { toast } from 'sonner';
import { useStoryMapStore, filterStories } from '../stores/story-map-store';
import { useCreateStory, useUpdateStory, useUpdateStoryStatus, useDeleteStory, useCreateActivity, useUpdateActivity, useDeleteActivity, useUpdateUserTask, useCreateUserTask, useDeleteUserTask, useUpdateMilestone, useDeleteMilestone, useCreateMilestone, useMilestonesByProduct } from '@/lib/api/hooks';
import {
  computePatronLayout,
  resolveStoryDrop,
  TASK_COL_W,
  TASK_GAP,
  GROUP_GAP,
  BAND_TO_TASK_GAP,
  HEADER_H,
  COL_HEAD_H,
  STORY_TOP,
  CARD_GAP,
} from '../lib/patron-layout';
import { MilestoneDialog } from '@/features/roadmap/components/milestone-dialog';
import { StoryDetailPanel } from './story-detail-panel';
import { StoryEditDialog } from './story-edit-dialog';
import { ActivityCreateDialog } from './activity-create-dialog';
import { ActivityEditDialog } from './activity-edit-dialog';
import { UserTaskDialog, type UserTaskFormData } from './user-task-dialog';
import { StoryCreateDialog } from './story-create-dialog';
import { FilterPanel } from './filter-panel';
import { StoryBulkBar } from './story-bulk-bar';
import { priorityLeftBorderCls } from '@/components/common/priority-badge';
import { StoryCardBody } from '@/components/common/story-card-body';
import type { UserActivity, UserStory, UserTask, Priority, MilestoneStatus } from '@/types';
import type { StoryStatus } from '@x-cartographer/shared';

const log = createLogger('patronCanvas');


interface PatronCanvasProps {
  activities: UserActivity[];
  productId: string;
  className?: string;
}

// ── 节点组件 ──

/** 活动宽头：横跨其全部任务列 */
function ActivityBandHeader({ data }: { data: {
  activityName: string;
  activityId: string;
  width: number;
  storyCount: number;
  taskCount: number;
  onAddStory?: (activityId: string, activityName: string) => void;
  onAddTaskColumn?: (activityId: string, activityName: string) => void;
  onEditActivity?: (activityId: string) => void;
  onDeleteActivity?: (activityId: string, activityName: string) => void;
} }) {
  return (
    <div
      className="relative flex h-full flex-col justify-between rounded-lg border border-primary/30 bg-gradient-to-b from-primary/12 to-primary/5 px-3 py-2 shadow-sm"
      style={{ width: data.width }}
    >
      <div className="drag-handle absolute left-1 top-1/2 z-10 -translate-y-1/2 cursor-grab rounded-sm p-0.5 text-muted-foreground/40 hover:bg-muted">
        <GripVertical className="h-4 w-4" />
      </div>
      {/* 行 1：活动名 + 操作 */}
      <div className="flex items-center gap-1 pl-4">
        <h3 className="min-w-0 flex-1 truncate text-sm font-semibold tracking-wide">
          {data.activityName}
        </h3>
        <div className="flex shrink-0 items-center gap-0.5">
          {data.onAddStory && (
            <button type="button" title="添加故事"
              className="rounded-md p-1 text-primary/70 hover:bg-primary/10 hover:text-primary"
              onClick={(e) => { e.stopPropagation(); data.onAddStory!(data.activityId, data.activityName); }}>
              <Plus className="h-3.5 w-3.5" />
            </button>
          )}
          {(data.onEditActivity || data.onDeleteActivity) && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button type="button" className="rounded-md p-1 text-muted-foreground/60 hover:bg-muted"
                  onClick={(e) => e.stopPropagation()}>
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-36">
                {data.onEditActivity && (
                  <DropdownMenuItem onClick={() => data.onEditActivity!(data.activityId)}>
                    <Pencil className="mr-2 h-3 w-3" /> 编辑活动
                  </DropdownMenuItem>
                )}
                {data.onDeleteActivity && (
                  <DropdownMenuItem className="text-destructive focus:text-destructive"
                    onClick={() => data.onDeleteActivity!(data.activityId, data.activityName)}>
                    <Trash2 className="mr-2 h-3 w-3" /> 删除活动
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
      {/* 行 2：统计条（故事/任务 计数）+ 新建任务列（虚线框 = 空列占位语义） */}
      <div className="flex items-center gap-2 pl-4 text-[10px] text-muted-foreground">
        <span className="rounded-full bg-background/70 px-1.5 py-0.5">
          {data.storyCount} 故事
        </span>
        <span className="rounded-full bg-background/70 px-1.5 py-0.5">
          {data.taskCount} 任务
        </span>
        {data.onAddTaskColumn && (
          <button type="button" title="新建任务列" aria-label="新建任务列"
            className="flex h-5 w-5 shrink-0 items-center justify-center rounded border border-dashed border-primary/40 text-primary/70 hover:border-primary/60 hover:bg-primary/10 hover:text-primary"
            onClick={(e) => { e.stopPropagation(); data.onAddTaskColumn!(data.activityId, data.activityName); }}>
            <Plus className="h-3 w-3" />
          </button>
        )}
      </div>
    </div>
  );
}

/** 用户任务便签卡（骨架结构元素：虚线边 + muted 底，与故事卡形态区分） */
function TaskColHeader({ data }: { data: {
  name: string;
  description?: string;
  storyCount: number;
  unassigned?: boolean;
  onMove?: (dir: -1 | 1) => void;
  onEdit?: () => void;
  onDelete?: () => void;
} }) {
  if (data.unassigned) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-0.5 rounded-lg border border-dashed border-border/70 bg-muted/30">
        <span className="text-[11px] italic text-muted-foreground/60">未分配</span>
        <span className="text-[9px] text-muted-foreground/50">{data.storyCount} 个故事</span>
      </div>
    );
  }
  return (
    <div className="group relative flex h-full flex-col justify-center gap-0.5 rounded-lg border border-border/80 bg-muted/50 px-2 py-1.5 shadow-sm">
      {/* 左右移（悬停显示） */}
      <div className="absolute inset-y-0 left-0 flex items-center opacity-0 transition-opacity group-hover:opacity-100">
        <button type="button" title="左移"
          className="col-drag-handle rounded-r-md bg-background/80 p-0.5 text-muted-foreground/60 hover:text-foreground"
          onClick={(e) => { e.stopPropagation(); data.onMove!(-1); }}>
          <ChevronLeft className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="absolute inset-y-0 right-0 flex items-center opacity-0 transition-opacity group-hover:opacity-100">
        <button type="button" title="右移"
          className="rounded-l-md bg-background/80 p-0.5 text-muted-foreground/60 hover:text-foreground"
          onClick={(e) => { e.stopPropagation(); data.onMove!(1); }}>
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
      {/* 编辑/删除（悬停显示，右上角） */}
      {(data.onEdit || data.onDelete) && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" title="任务列操作"
              className="absolute right-0.5 top-0.5 rounded-md p-0.5 text-muted-foreground/60 opacity-0 transition-opacity hover:bg-muted group-hover:opacity-100"
              onClick={(e) => e.stopPropagation()}>
              <MoreHorizontal className="h-3.5 w-3.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-32">
            {data.onEdit && (
              <DropdownMenuItem onClick={data.onEdit}>
                <Pencil className="mr-2 h-3 w-3" /> 编辑任务列
              </DropdownMenuItem>
            )}
            {data.onDelete && (
              <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={data.onDelete}>
                <Trash2 className="mr-2 h-3 w-3" /> 删除任务列
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      {/* 任务名 + 描述 */}
      <p className="col-drag-handle cursor-grab truncate text-center text-[11px] font-semibold text-foreground/85" title={data.description || data.name}>
        {data.name}
      </p>
      {data.description ? (
        <p className="line-clamp-1 text-center text-[9px] leading-tight text-muted-foreground/70">{data.description}</p>
      ) : (
        <p className="text-center text-[9px] leading-tight text-muted-foreground/50">{data.storyCount} 个故事</p>
      )}
    </div>
  );
}

/** 故事卡（经典模式：变高——卡高由布局预算，标题不截断；版本徽章、任务从属即位置） */
function PatronStoryNode({ data }: { data: {
  story: UserStory;
  milestoneName?: string;
  isSelected: boolean;
  /** 批量模式下是否被勾选（US-006） */
  isBulkSelected?: boolean;
  unassigned?: boolean;
  /** 预计算卡高（px）——来自布局，勿在组件内再测 */
  height: number;
} }) {
  const { story, milestoneName, isSelected, isBulkSelected, unassigned, height } = data;
  return (
    <>
      <Handle type="target" position={Position.Top} className="!h-1.5 !w-1.5 !bg-transparent !border-0" />
      <div className="drag-handle absolute left-0 top-1/2 z-10 -translate-y-1/2 rounded-sm p-0.5 text-muted-foreground/25 hover:bg-muted hover:text-muted-foreground">
        <GripVertical className="h-3.5 w-3.5" />
      </div>
      <Card
        // 点击由 React Flow 的 onNodeClick 统一处理（卡片自带 onClick 会与它
        // 双重触发：批量模式下 toggle 两次 = 取消选择）
        className={cn(
          'w-full cursor-pointer bg-background transition-all duration-150',
          'hover:-translate-y-0.5 hover:shadow-md',
          isBulkSelected
            ? 'shadow-md ring-2 ring-blue-500 bg-blue-500/5'
            : isSelected
              ? 'shadow-md ring-2 ring-primary'
              : story.status === 'cancelled'
                ? 'border-dashed opacity-60 shadow-none'
                : unassigned
                  ? 'border-dashed shadow-none opacity-75'
                  : 'shadow-sm',
          priorityLeftBorderCls(story.priority),
          'border-l-4 pl-5'
        )}
        style={{ height }}
      >
        <CardContent className="flex h-full flex-col p-2.5">
          <StoryCardBody story={story} clampTitle={false} />
          {milestoneName && (
            <p className="mt-1 shrink-0 truncate rounded bg-amber-500/10 px-1 py-0.5 text-center text-[9px] font-medium text-amber-700 dark:text-amber-400">
              ⚑ {milestoneName}
            </p>
          )}
        </CardContent>
      </Card>
      <Handle type="source" position={Position.Bottom} className="!h-1.5 !w-1.5 !bg-transparent !border-0" />
    </>
  );
}

/** 发布切片带（整宽横向分隔）；带标签可点击编辑（重命名/删除） */
function ReleaseBand({ data }: { data: { width: number; label: string; milestoneId: string | null; onEdit?: () => void } }) {
  return (
    <div className="relative flex items-center" style={{ width: data.width }}>
      <div className="h-px w-full border-t-2 border-dashed border-amber-500/50" />
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); data.onEdit?.(); }}
        className={cn(
          'absolute left-2 -top-3 flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-400',
          data.onEdit ? 'cursor-pointer hover:bg-amber-500/30' : 'cursor-default'
        )}
        title={data.onEdit ? '点击编辑切片' : undefined}
      >
        {data.label}
        {data.onEdit && <Pencil className="h-2.5 w-2.5 opacity-60" />}
      </button>
    </div>
  );
}

const nodeTypes: NodeTypes = {
  activityBand: ActivityBandHeader as unknown as NodeTypes[string],
  taskColHeader: TaskColHeader as unknown as NodeTypes[string],
  patronStory: PatronStoryNode as unknown as NodeTypes[string],
  releaseBand: ReleaseBand as unknown as NodeTypes[string],
};

// ── 主组件 ──
export function PatronCanvas({ activities, productId, className }: PatronCanvasProps) {
  const navigate = useNavigateSafe();
  const queryClient = useQueryClient();
  const { selectedStory, setSelectedStory, filter } = useStoryMapStore();
  const { data: milestones = [] } = useMilestonesByProduct(productId);

  const createStoryMutation = useCreateStory();
  const updateStoryMutation = useUpdateStory();
  const updateStoryStatusMutation = useUpdateStoryStatus();
  const deleteStoryMutation = useDeleteStory();
  const createActivityMutation = useCreateActivity();
  const updateActivityMutation = useUpdateActivity();
  const deleteActivityMutation = useDeleteActivity();
  const updateUserTaskMutation = useUpdateUserTask();
  const createUserTaskMutation = useCreateUserTask();
  const deleteUserTaskMutation = useDeleteUserTask();
  const updateMilestoneMutation = useUpdateMilestone();
  const createMilestoneMutation = useCreateMilestone();
  const deleteMilestoneMutation = useDeleteMilestone();

  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingStory, setEditingStory] = useState<UserStory | null>(null);
  const [activityCreateOpen, setActivityCreateOpen] = useState(false);
  const [activityEditOpen, setActivityEditOpen] = useState(false);
  const [editingActivity, setEditingActivity] = useState<UserActivity | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: 'activity' | 'story' | 'userTask'; id: string; name: string } | null>(null);
  const [storyCreateOpen, setStoryCreateOpen] = useState(false);
  const [storyCreateTarget, setStoryCreateTarget] = useState<{ activityId: string; activityName: string }>({ activityId: '', activityName: '' });
  // 任务列（UserTask）创建/编辑对话框。seed 在**打开时定格**：若改为渲染中现算对象，
  // 父组件每次 re-render（后台 refetch 换 activities 身份）都会重置表单、清掉正在输入的内容。
  const [taskDialog, setTaskDialog] = useState<
    { activityId: string; activityName: string; taskId: string | null; seed: UserTaskFormData } | null
  >(null);
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  // US-006 批量编辑模式（cutover 时从旧画布迁移补回）
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkSelectedIds, setBulkSelectedIds] = useState<string[]>([]);
  // 切片线编辑（重命名 / 删除 = 编辑 milestone）
  const [editingMilestone, setEditingMilestone] = useState<{ id: string; name: string } | null>(null);
  const [msNameDraft, setMsNameDraft] = useState('');
  // 新建切片
  const [sliceCreateOpen, setSliceCreateOpen] = useState(false);

  const filteredActivities = useMemo(
    () => filterStories(activities, filter).sort((a, b) => a.order - b.order),
    [activities, filter]
  );

  const project = useMemo(
    () => ({
      id: productId,
      name: '',
      metadata: { tech_stack: [], version: '', tags: [] },
      settings: {
        auto_save: true,
        display_preferences: { show_priority_colors: true, show_estimation: true, default_view: 'map' as const },
        workspace_dir: undefined,
      },
      user_activities: activities,
    }),
    [productId, activities]
  );

  const selectedStoryLive = useMemo(() => {
    if (!selectedStory) return selectedStory;
    for (const activity of activities) {
      const found = activity.stories?.find((s) => s.id === selectedStory.id);
      if (found) return found;
    }
    return selectedStory;
  }, [activities, selectedStory]);

  const selectedActivityName = useMemo(() => {
    if (!selectedStoryLive) return '';
    for (const a of activities) {
      if (a.stories?.some((s) => s.id === selectedStoryLive.id)) return a.name;
    }
    return '';
  }, [activities, selectedStoryLive]);

  const msName = useMemo(() => {
    const m = new Map<string, string>();
    for (const x of milestones) m.set(x.id, x.name);
    return m;
  }, [milestones]);

  /** 用户任务列左/右移（order 重排） */
  const handleMoveTask = useCallback(
    async (activityId: string, taskKey: string | null, dir: -1 | 1) => {
      if (!taskKey) return;
      const activity = filteredActivities.find((a) => a.id === activityId);
      if (!activity) return;
      const utSorted = [...(activity.user_tasks ?? [])].sort((a, b) => a.order - b.order);
      const fromIdx = utSorted.findIndex((t) => t.id === taskKey);
      const toIdx = fromIdx + dir;
      if (fromIdx === -1 || toIdx < 0 || toIdx >= utSorted.length) return;
      const reordered = [...utSorted];
      const [moved] = reordered.splice(fromIdx, 1);
      reordered.splice(toIdx, 0, moved);
      await Promise.all(
        reordered.map((t, idx) => updateUserTaskMutation.mutateAsync({ id: t.id, order: idx }))
      );
    },
    [filteredActivities, updateUserTaskMutation]
  );

  // ── US-006 批量编辑（cutover 迁移补回）──
  /** 当前批量选中的故事对象 */
  const bulkSelectedStories = useMemo(() => {
    const all: UserStory[] = [];
    for (const activity of activities) {
      for (const story of activity.stories ?? []) {
        if (bulkSelectedIds.includes(story.id)) all.push(story);
      }
    }
    return all;
  }, [activities, bulkSelectedIds]);

  const toggleBulkSelect = useCallback((storyId: string) => {
    setBulkSelectedIds((prev) =>
      prev.includes(storyId) ? prev.filter((id) => id !== storyId) : [...prev, storyId]
    );
  }, []);

  const applyBulkPriority = useCallback(
    async (storyIds: string[], priority: string) => {
      await Promise.all(
        storyIds.map((id) => updateStoryMutation.mutateAsync({ id, priority: priority as Priority }))
      );
      toast.success('批量修改完成', { description: `已更新 ${storyIds.length} 个故事优先级` });
    },
    [updateStoryMutation]
  );

  const applyBulkTags = useCallback(
    async (storyIds: string[], tags: string[]) => {
      await Promise.all(
        storyIds.map((id) => {
          const story = bulkSelectedStories.find((s) => s.id === id);
          const merged = [...new Set([...(story?.tags ?? []), ...tags])];
          return updateStoryMutation.mutateAsync({ id, tags: merged });
        })
      );
      toast.success('批量添加完成', { description: `已为 ${storyIds.length} 个故事添加标签` });
    },
    [updateStoryMutation, bulkSelectedStories]
  );

  const applyBulkStatus = useCallback(
    async (storyIds: string[], status: StoryStatus) => {
      await Promise.all(storyIds.map((id) => updateStoryStatusMutation.mutateAsync({ id, status })));
      toast.success('批量状态更新完成', { description: `已更新 ${storyIds.length} 个故事状态` });
    },
    [updateStoryStatusMutation]
  );

  /** 节点点击：批量模式切换选择，否则打开详情 */
  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      if (node.type === 'patronStory') {
        const story = (node.data as { story?: UserStory }).story;
        if (!story) return;
        if (bulkMode) toggleBulkSelect(story.id);
        else setSelectedStory(story);
      }
    },
    [bulkMode, toggleBulkSelect, setSelectedStory]
  );

  /** 画布点击：批量模式保留选择，普通模式清空 */
  const onPaneClick = useCallback(() => {
    if (!bulkMode) setSelectedStory(null);
  }, [bulkMode, setSelectedStory]);

  // ── 布局（经典模式核心） ──
  // 变高卡片：卡高由文本测量预算（computePatronLayout → storyCardHeight），
  // 堆叠/带边界为纯算术；切片带底 = 该版本最深卡底边（px 前缀单调）。
  const layout = useMemo(
    () =>
      computePatronLayout({
        activities: filteredActivities,
        milestones,
      }),
    [filteredActivities, milestones]
  );

  const { nodes, edges, totalWidth, totalHeight } = useMemo(() => {
    const ns: Node[] = [];
    const es: Edge[] = [];
    // 节点 = 布局结果的直接投影（几何全部来自 computePatronLayout，此处只包 React Flow 壳）
    for (const band of layout.activityBands) {
      const activity = filteredActivities.find((a) => a.id === band.activityId);
      if (!activity) continue;
      ns.push({
        id: `band-${activity.id}`,
        type: 'activityBand',
        position: { x: band.x, y: 0 },
        style: { width: band.width, height: HEADER_H },
        data: {
          activityName: activity.name,
          activityId: activity.id,
          width: band.width,
          storyCount: activity.stories?.length ?? 0,
          taskCount: activity.user_tasks?.length ?? 0,
          onAddStory: (aid: string, aname: string) => { setStoryCreateTarget({ activityId: aid, activityName: aname }); setStoryCreateOpen(true); },
          onAddTaskColumn: (aid: string, aname: string) => setTaskDialog({
            activityId: aid,
            activityName: aname,
            taskId: null,
            seed: { name: '', description: '', order: nextTaskOrder(filteredActivities, aid) },
          }),
          onEditActivity: (aid: string) => {
            const a = (project?.user_activities ?? []).find((x) => x.id === aid);
            if (a) { setEditingActivity(a); setActivityEditOpen(true); }
          },
          onDeleteActivity: (aid: string, aname: string) => setDeleteConfirm({ type: 'activity', id: aid, name: aname }),
        },
        draggable: true,
        dragHandle: '.drag-handle',
      });
    }

    for (const ch of layout.colHeads) {
      const activity = filteredActivities.find((a) => a.id === ch.activityId);
      const colStoryCount = layout.stories.filter((p) => p.activityId === ch.activityId && p.colKey === ch.key).length;
      ns.push({
        id: ch.id,
        type: 'taskColHeader',
        position: { x: ch.x, y: HEADER_H + BAND_TO_TASK_GAP },
        style: { width: TASK_COL_W, height: COL_HEAD_H },
        data: {
          name: ch.name,
          storyCount: colStoryCount,
          unassigned: ch.unassigned,
          activityId: ch.activityId,
          taskKey: ch.key === '__unassigned__' ? null : ch.key,
          order: ch.order,
          onMove: ch.unassigned || !activity ? undefined : (dir: -1 | 1) => {
            void handleMoveTask(ch.activityId, ch.key === '__unassigned__' ? null : ch.key, dir);
          },
          onEdit: ch.unassigned || !activity ? undefined : () => {
            const ut = (activity.user_tasks ?? []).find((t) => t.id === ch.key);
            if (ut) setTaskDialog({
              activityId: activity.id,
              activityName: activity.name,
              taskId: ut.id,
              seed: { name: ut.name, description: ut.description, order: ut.order },
            });
          },
          onDelete: ch.unassigned || !activity ? undefined : () =>
            setDeleteConfirm({ type: 'userTask', id: ch.key, name: ch.name }),
        },
        draggable: !ch.unassigned,
        dragHandle: '.col-drag-handle',
        selectable: false,
      });
    }

    for (const p of layout.stories) {
      ns.push({
        id: `story-${p.story.id}`,
        type: 'patronStory',
        position: { x: p.x, y: p.y },
        style: { width: TASK_COL_W, height: p.height },
        data: {
          story: p.story,
          milestoneName: p.story.milestone_id ? msName.get(p.story.milestone_id) : undefined,
          isSelected: selectedStory?.id === p.story.id,
          isBulkSelected: bulkMode && bulkSelectedIds.includes(p.story.id),
          unassigned: p.colKey === '__unassigned__',
          height: p.height,
        },
        draggable: true,
        dragHandle: '.drag-handle',
      });
    }

    // 切片线：每带底边一条（bandBottoms 前缀单调，线落在带间通道）
    for (let bi = 0; bi < milestones.length; bi++) {
      const ms = milestones[bi];
      const bottomY = layout.bandBottomByIndex[bi] ?? STORY_TOP;
      const prevY = bi === 0 ? STORY_TOP : (layout.bandBottomByIndex[bi - 1] ?? STORY_TOP);
      if (bottomY <= prevY + 1) continue; // 该带无更深的卡，线由更深的带承担
      ns.push({
        id: `slice-${ms.id}`,
        type: 'releaseBand',
        position: { x: 0, y: bottomY + CARD_GAP / 2 },
        data: {
          width: layout.totalWidth,
          label: `⚑ ${ms.name}`,
          milestoneId: ms.id,
          onEdit: () => { setEditingMilestone(ms); setMsNameDraft(ms.name); },
        },
        draggable: false,
        selectable: false,
        zIndex: 5,
      });
    }
    // 未排期带线（有未排期故事且其带深于最后一个版本带）
    const unschedBottom = layout.bandBottomByIndex[milestones.length] ?? STORY_TOP;
    const lastMsBottom = layout.bandBottomByIndex[milestones.length - 1] ?? STORY_TOP;
    if (unschedBottom > lastMsBottom + 1) {
      ns.push({
        id: 'slice-unscheduled',
        type: 'releaseBand',
        position: { x: 0, y: unschedBottom + CARD_GAP / 2 },
        data: { width: layout.totalWidth, label: '⚑ 未排期', milestoneId: null, onEdit: undefined },
        draggable: false,
        selectable: false,
        zIndex: 5,
      });
    }

    return { nodes: ns, edges: es, totalWidth: layout.totalWidth, totalHeight: layout.totalHeight };
  }, [layout, filteredActivities, selectedStory?.id, setSelectedStory, msName, milestones, project, handleMoveTask]);

  // ── 拖拽：x → 任务列（userTaskId），y → 列内 order ──
  const onNodeDragStop = useCallback(
    (_e: MouseEvent | TouchEvent, node: Node) => {
      void (async () => {
      if (node.type === 'activityBand') {
        // 活动重排（按 x 中心判定目标组序）
        const groups = filteredActivities.map((activity) => {
          const cols = (activity.user_tasks?.length ?? 0) + 1;
          return { id: activity.id, w: cols * TASK_COL_W + cols * TASK_GAP };
        });
        let acc = 24;
        const centers = groups.map((g) => { const c = acc + g.w / 2; acc += g.w + GROUP_GAP; return { id: g.id, c }; });
        const nx = node.position.x + 100;
        let target = centers.findIndex((c) => nx < c.c);
        if (target === -1) target = centers.length - 1;
        const from = centers.findIndex((c) => c.id === node.id.replace('band-', ''));
        if (from === -1 || target === from) return;
        const reordered = [...centers.map((c) => c.id)];
        const [moved] = reordered.splice(from, 1);
        reordered.splice(target, 0, moved);
        await Promise.all(reordered.map((id, idx) => updateActivityMutation.mutateAsync({ id, order: idx })));
        return;
      }
      if (node.type === 'taskColHeader') {
        // 用户任务列重排：x → 活动内新序
        const [, activityId, taskKey] = node.id.replace('colhead-', '').split(/-(?=[^-]*$)/);
        if (taskKey === '__unassigned__') return;
        const targetActivity = filteredActivities.find((a) => a.id === activityId);
        if (!targetActivity) return;
        const utSorted = [...(targetActivity.user_tasks ?? [])].sort((a, b) => a.order - b.order);
        const groupLeft = node.position.x; // 拖动后的世界 x 近似
        // 找该活动最左列头 x（活动组起点）
        const colHeadsX = nodes
          .filter((n) => n.type === 'taskColHeader' && n.id.startsWith(`colhead-${activityId}-`))
          .map((n) => n.position.x)
          .sort((a, b) => a - b);
        const originX = colHeadsX[0] ?? 0;
        // 目标序：按拖动列中心相对各列中心的投影
        const center = groupLeft + TASK_COL_W / 2;
        let targetIdx = 0;
        for (let i = 0; i < utSorted.length; i++) {
          const cX = originX + i * (TASK_COL_W + TASK_GAP) + TASK_COL_W / 2;
          if (center > cX) targetIdx = i + 1;
        }
        const fromIdx = utSorted.findIndex((t) => t.id === taskKey);
        if (fromIdx === -1 || targetIdx === fromIdx || targetIdx === fromIdx + 1) return;
        const reordered = [...utSorted];
        const [moved] = reordered.splice(fromIdx, 1);
        reordered.splice(targetIdx > fromIdx ? targetIdx - 1 : targetIdx, 0, moved);
        await Promise.all(
          reordered.map((t, idx) =>
            updateUserTaskMutation.mutateAsync({ id: t.id, order: idx })
          )
        );
        return;
      }
      if (node.type !== 'patronStory') return;
      const storyId = node.id.replace('story-', '');
      // 落点判定复用布局几何（resolveStoryDrop），与渲染严格一致，不再同构重算
      const drop = resolveStoryDrop(layout, milestones, storyId, node.position.x, node.position.y);
      if (!drop) return;
      const targetActivity = filteredActivities.find((a) => a.id === drop.activityId);
      if (!targetActivity) return;
      const sourceStory = (project?.user_activities ?? []).flatMap((a) => a.stories ?? []).find((s) => s.id === storyId);
      if (!sourceStory) return;

      // 目标列·目标带内现有故事（与布局 bucketStoriesIntoCols 同构）
      const bandIdxByMs = new Map<string, number>();
      milestones.forEach((m, i) => bandIdxByMs.set(m.id, i));
      const UNSCHED = bandIdxByMs.size;
      const biOf = (st: UserStory): number => (st.milestone_id ? (bandIdxByMs.get(st.milestone_id) ?? UNSCHED) : UNSCHED);
      const targetBand = drop.milestoneId ? (bandIdxByMs.get(drop.milestoneId) ?? UNSCHED) : UNSCHED;
      const colStories = (drop.colKey === null
        ? (targetActivity.stories ?? []).filter((s) => !s.user_task_id || !targetActivity.user_tasks?.some((t) => t.id === s.user_task_id))
        : (targetActivity.stories ?? []).filter((s) => s.user_task_id === drop.colKey)
      ).filter((s) => biOf(s) === targetBand)
        .sort((a, b) => a.order - b.order);

      const isSameCol = sourceStory.user_task_id === (drop.colKey ?? null) || (drop.colKey === null && !sourceStory.user_task_id);
      const sourceActivity = (project?.user_activities ?? []).find((a) => a.stories?.some((s) => s.id === storyId));
      if (!sourceActivity) return;

      interface StoryUpdate { id: string; order?: number; userTaskId?: string | null; activityId?: string; milestoneId?: string | null }
      const updates: StoryUpdate[] = [];
      if (isSameCol && sourceActivity.id === drop.activityId && (sourceStory.milestone_id ?? null) === (drop.milestoneId ?? null)) {
        const arr = [...colStories];
        const fi = arr.findIndex((s) => s.id === storyId);
        if (fi !== -1) {
          const [m] = arr.splice(fi, 1);
          arr.splice(Math.min(drop.indexInBand, arr.length), 0, m);
        }
        arr.forEach((s, idx) => { if (s.order !== idx) updates.push({ id: s.id, order: idx }); });
      } else {
        // 源列重排（源带内剩余故事保持相对序）
        const srcBand = sourceStory.milestone_id ? (bandIdxByMs.get(sourceStory.milestone_id) ?? bandIdxByMs.size) : bandIdxByMs.size;
        const srcColStories = (sourceActivity.stories ?? [])
          .filter((s) => s.id !== storyId && ((drop.colKey ?? null) === null
            ? !s.user_task_id || !sourceActivity.user_tasks?.some((t) => t.id === s.user_task_id)
            : s.user_task_id === drop.colKey && sourceActivity.stories?.includes(s)))
          .filter((s) => {
            const bi = s.milestone_id ? (bandIdxByMs.get(s.milestone_id) ?? bandIdxByMs.size) : bandIdxByMs.size;
            return bi === srcBand;
          })
          .sort((a, b) => a.order - b.order);
        srcColStories.forEach((s, idx) => { if (s.order !== idx) updates.push({ id: s.id, order: idx }); });
        // 目标列插入（写 userTaskId + milestoneId = 落带）
        const dst = [...colStories];
        dst.splice(Math.min(drop.indexInBand, dst.length), 0, sourceStory);
        dst.forEach((s, idx) => updates.push({ id: s.id, order: idx, userTaskId: drop.colKey, activityId: drop.activityId, milestoneId: drop.milestoneId }));
      }
      if (updates.length === 0) return;
      await Promise.all(updates.map((u) => updateStoryMutation.mutateAsync(u)));
      })();
    },
    [layout, filteredActivities, project, updateActivityMutation, updateStoryMutation, milestones]
  );

  const handleCreateStory = useCallback(
    async (input: {
      activityId: string;
      title: string;
      description: string;
      priority: Priority;
      estimation: number;
      acceptance_criteria: string[];
      tags: string[];
    }) => {
      try {
        await createStoryMutation.mutateAsync({
          activityId: input.activityId,
          title: input.title,
          description: input.description,
          priority: input.priority,
          estimation: input.estimation,
          acceptanceCriteria: input.acceptance_criteria,
          tags: input.tags,
        });
        setStoryCreateOpen(false);
      } catch (err) {
        log.error('create.failed', { err });
      }
    },
    [createStoryMutation]
  );
  const handleSaveStory = useCallback(
    async (story: Partial<UserStory> & { id: string }) => {
      await updateStoryMutation.mutateAsync({
        id: story.id,
        title: story.title,
        description: story.description,
        priority: story.priority,
        estimation: story.estimation,
        acceptanceCriteria: story.acceptance_criteria,
        tags: story.tags,
        milestoneId: story.milestone_id ?? null,
      });
      setEditDialogOpen(false);
      setSelectedStory(null);
    },
    [updateStoryMutation, setSelectedStory]
  );

  const handleCreateActivity = useCallback(
    async (input: { name: string; description?: string }) => {
      await createActivityMutation.mutateAsync({ ...input, productId });
      setActivityCreateOpen(false);
    },
    [createActivityMutation, productId]
  );

  const handleSaveActivity = useCallback(
    async (input: { id: string; name: string; description?: string }) => {
      const { id, ...dto } = input;
      await updateActivityMutation.mutateAsync({ id, ...dto });
      setActivityEditOpen(false);
    },
    [updateActivityMutation]
  );

  /** 新建/编辑任务列（taskId 有值即编辑） */
  const handleSaveUserTask = useCallback(
    async (input: UserTaskFormData) => {
      if (!taskDialog) return;
      const isEdit = taskDialog.taskId !== null;
      try {
        if (isEdit) {
          await updateUserTaskMutation.mutateAsync({
            id: taskDialog.taskId!,
            activityId: taskDialog.activityId,
            name: input.name,
            description: input.description,
            order: input.order,
          });
        } else {
          await createUserTaskMutation.mutateAsync({
            activity_id: taskDialog.activityId,
            name: input.name,
            description: input.description,
            order: input.order,
          });
        }
        setTaskDialog(null);
      } catch (err) {
        log.error('userTask.save.failed', { err });
        toast.error(isEdit ? '更新任务列失败' : '创建任务列失败', {
          description: err instanceof Error ? err.message : '未知错误',
        });
        throw err;
      }
    },
    [taskDialog, createUserTaskMutation, updateUserTaskMutation]
  );

  const handleDeleteStory = useCallback(
    (id: string, title: string) => setDeleteConfirm({ type: 'story', id, name: title }),
    []
  );

  const handleConfirmDelete = useCallback(async () => {
    if (!project || !deleteConfirm) return;
    try {
      if (deleteConfirm.type === 'activity') {
        await deleteActivityMutation.mutateAsync({ id: deleteConfirm.id });
        if (selectedStory && selectedStory.activity_id === deleteConfirm.id) setSelectedStory(null);
      } else if (deleteConfirm.type === 'userTask') {
        await deleteUserTaskMutation.mutateAsync({ id: deleteConfirm.id });
      } else {
        await deleteStoryMutation.mutateAsync({ id: deleteConfirm.id });
        if (selectedStory?.id === deleteConfirm.id) setSelectedStory(null);
      }
      setDeleteConfirm(null);
    } catch (err) {
      log.error('delete.failed', { err, type: deleteConfirm.type });
      toast.error('删除失败', { description: err instanceof Error ? err.message : '未知错误' });
    }
  }, [project, deleteConfirm, deleteActivityMutation, deleteUserTaskMutation, deleteStoryMutation, selectedStory, setSelectedStory]);

  async function handleCreateSlice(data: { name: string; goal: string; target_date?: string; status?: MilestoneStatus }) {
    await createMilestoneMutation.mutateAsync({
      product_id: productId,
      name: data.name,
      goal: data.goal,
      target_date: data.target_date,
      status: data.status ?? 'planned',
    });
    setSliceCreateOpen(false);
  }

  async function handleSaveMilestone() {
    if (!editingMilestone || !msNameDraft.trim()) return;
    await updateMilestoneMutation.mutateAsync({ id: editingMilestone.id, productId, name: msNameDraft.trim() });
    setEditingMilestone(null);
  }

  async function handleDeleteMilestone() {
    if (!editingMilestone) return;
    if (!window.confirm(`确定删除切片「${editingMilestone.name}」吗？已排入的故事将变为未排期。`)) return;
    await deleteMilestoneMutation.mutateAsync({ id: editingMilestone.id, productId });
    setEditingMilestone(null);
  }

  if (activities.length === 0) {
    return (
      <div className={cn('flex h-96 items-center justify-center rounded-lg border', className)}>
        <div className="text-center">
          <MapIcon className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
          <h3 className="mb-2 text-lg font-medium">暂无用户活动</h3>
          <p className="mb-4 text-sm text-muted-foreground">创建第一个用户活动来开始规划产品</p>
          <Button size="sm" onClick={() => setActivityCreateOpen(true)}>
            <Plus className="mr-1.5 h-4 w-4" /> 添加活动
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div data-patron-canvas className={cn('relative h-full', className)}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodeDragStop={onNodeDragStop}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        minZoom={0.2}
        maxZoom={2}
        panOnScroll
        zoomOnPinch
        fitView={false}
        nodesConnectable={false}
        nodeDragThreshold={2}
        className="bg-background"
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="hsl(var(--border))" />
        <Panel position="top-right">
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" className="h-7 gap-1 text-xs bg-background/80 backdrop-blur-sm" onClick={() => setSliceCreateOpen(true)}>
              <Plus className="h-3 w-3" /> 新建切片
            </Button>
            <div className="rounded-lg border bg-background/80 px-3 py-1.5 text-xs text-muted-foreground backdrop-blur-sm">
            经典模式（Patton）· <span className="font-medium text-foreground">{filteredActivities.length}</span> 活动 ·{' '}
            <span className="font-medium text-foreground">
              {filteredActivities.reduce((acc, j) => acc + (j.stories?.length || 0), 0)}
            </span>{' '}
            故事
          </div>
          </div>
        </Panel>
        <Panel position="top-left">
          <div className="flex items-center gap-1">
            <Button size="sm" variant="outline" className="h-8 gap-1 bg-background/80" onClick={() => setFilterPanelOpen((v) => !v)}>
              筛选
            </Button>
            <Button
              size="sm"
              variant={bulkMode ? 'default' : 'outline'}
              className="h-8 gap-1 bg-background/80"
              onClick={() => {
                setBulkMode((v) => !v);
                setBulkSelectedIds([]);
              }}
              title="批量编辑：点击卡片多选后批量改优先级/标签/状态"
            >
              {bulkMode ? `批量中（${bulkSelectedIds.length}）` : '批量编辑'}
            </Button>
          </div>
        </Panel>
      </ReactFlow>

      {/* US-006 批量编辑工具栏（批量模式且有选中时出现） */}
      {bulkMode && bulkSelectedStories.length > 0 && (
        <div className="absolute bottom-4 left-1/2 z-20 -translate-x-1/2">
          <StoryBulkBar
            selectedStories={bulkSelectedStories}
            onClearSelection={() => setBulkSelectedIds([])}
            onUpdatePriority={applyBulkPriority}
            onAddTags={applyBulkTags}
            onUpdateStatus={applyBulkStatus}
          />
        </div>
      )}

      {filterPanelOpen && (
        <div className="absolute bottom-4 left-4 top-4 z-10 overflow-y-auto rounded-lg shadow-lg">
          <FilterPanel activities={activities} milestones={milestones} />
        </div>
      )}

      {project && selectedStoryLive && (
        <div className="absolute bottom-4 right-4 top-4 z-10 w-96 overflow-y-auto rounded-lg border bg-background p-4 shadow-lg">
          <StoryDetailPanel
            story={selectedStoryLive}
            activityName={selectedActivityName}
            project={project}
            onClose={() => setSelectedStory(null)}
            onEdit={(s) => { setEditingStory(s); setEditDialogOpen(true); }}
            onDelete={(s) => handleDeleteStory(s.id, s.title)}
          />
        </div>
      )}

      <StoryEditDialog open={editDialogOpen} story={editingStory} onOpenChange={setEditDialogOpen} onSave={handleSaveStory} />
      <ActivityCreateDialog open={activityCreateOpen} onOpenChange={setActivityCreateOpen} onSave={handleCreateActivity} />
      <StoryCreateDialog
        open={storyCreateOpen}
        onOpenChange={setStoryCreateOpen}
        activityId={storyCreateTarget.activityId}
        activities={activities.map((j) => ({ id: j.id, name: j.name }))}
        activityName={storyCreateTarget.activityName}
        onSave={handleCreateStory}
      />
      <ActivityEditDialog open={activityEditOpen} activity={editingActivity} onOpenChange={setActivityEditOpen} onSave={handleSaveActivity} />
      <UserTaskDialog
        open={taskDialog !== null}
        onOpenChange={(open) => { if (!open) setTaskDialog(null); }}
        seed={taskDialog?.seed ?? EMPTY_TASK_SEED}
        mode={taskDialog?.taskId ? 'edit' : 'create'}
        activityName={taskDialog?.activityName}
        onSave={handleSaveUserTask}
      />

      {/* 新建切片对话框 */}
      <MilestoneDialog
        open={sliceCreateOpen}
        onOpenChange={setSliceCreateOpen}
        initial={null}
        onSave={handleCreateSlice}
      />

      {/* 切片线编辑对话框 */}
      <Dialog open={!!editingMilestone} onOpenChange={(open) => { if (!open) setEditingMilestone(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>编辑切片</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              value={msNameDraft}
              onChange={(e) => setMsNameDraft(e.target.value)}
              placeholder="切片名称（版本/里程碑名）"
              onKeyDown={(e) => { if (e.key === 'Enter') void handleSaveMilestone(); }}
            />
            <p className="text-xs text-muted-foreground">
              修改名称将同步到版本里程碑；删除切片后其故事变为未排期。
            </p>
          </div>
          <DialogFooter>
            <Button variant="destructive" className="mr-auto" onClick={() => void handleDeleteMilestone()}>
              删除切片
            </Button>
            <Button variant="outline" onClick={() => setEditingMilestone(null)}>取消</Button>
            <Button onClick={() => void handleSaveMilestone()} disabled={!msNameDraft.trim()}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteConfirm !== null} onOpenChange={(open) => { if (!open) setDeleteConfirm(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              确认删除{deleteConfirm?.type === 'activity' ? '活动' : deleteConfirm?.type === 'userTask' ? '任务列' : '故事'}
            </DialogTitle>
            <DialogDescription>
              {deleteConfirm?.type === 'activity'
                ? `确定要删除活动「${deleteConfirm?.name}」及其所有故事吗？此操作不可撤销。`
                : deleteConfirm?.type === 'userTask'
                  ? `确定要删除任务列「${deleteConfirm?.name}」吗？该列下的故事将变为未分配。`
                  : `确定要删除故事「${deleteConfirm?.name}」吗？此操作不可撤销。`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>取消</Button>
            <Button variant="destructive" onClick={handleConfirmDelete}>删除</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function useNavigateSafe() {
  // 经典模式画布内暂无路由跳转需求；保留钩位
  return null;
}

/** 对话框关闭时的占位种子（模块级常量 → 引用稳定，不会触发重置 effect） */
const EMPTY_TASK_SEED: UserTaskFormData = { name: '', description: '', order: 0 };

/**
 * 新任务列的默认 order —— 该活动现有 order 的最大值 + 1。
 * 不用 length：order 允许稀疏（CLI `--order` 可跳号），length 会与既有列撞序。
 */
function nextTaskOrder(activities: UserActivity[], activityId: string): number {
  const tasks = activities.find((a) => a.id === activityId)?.user_tasks ?? [];
  return tasks.reduce((max, t) => Math.max(max, t.order + 1), 0);
}
