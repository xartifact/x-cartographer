/**
 * 任务列表组件
 *
 * 显示任务列表，支持状态标签和状态筛选
 */

'use client';

import * as React from 'react';
import {
  Clock,
  Tag,
  MoreHorizontal,
  Calendar,
  Play,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { StatusFilterBar } from './status-filter';
import { StatusBadge, TASK_STATUS_OPTIONS } from './status-badge';
import type { Task, TaskStatus, TaskPriority, StoryStatus } from '@/types';

interface TaskListProps {
  /** 任务列表 */
  tasks: Task[];

  /** 任务状态变更回调 */
  onStatusChange?: (taskId: string, newStatus: TaskStatus) => void;

  /** 任务点击回调 */
  onTaskClick?: (task: Task) => void;

  /** 任务选择变更回调 */
  onSelectionChange?: (selectedIds: string[]) => void;

  /** 选中状态列表 */
  selectedIds?: string[];

  /** 是否显示状态筛选 */
  showStatusFilter?: boolean;

  /** 是否可编辑状态 */
  editableStatus?: boolean;

  /** 故事/旅程上下文映射 */
  storyContextMap?: Record<string, { storyTitle: string; journeyName: string }>;

  /** 触发 AI 执行回调 */
  onExecute?: (task: Task) => void;

  /** 正在执行中的任务 ID 列表 */
  isExecutingIds?: string[];

  /** 自定义类名 */
  className?: string;
}

const priorityConfig: Record<
  TaskPriority,
  { label: string; variant: 'destructive' | 'secondary' | 'default' }
> = {
  P0: { label: 'P0', variant: 'destructive' },
  P1: { label: 'P1', variant: 'default' },
  P2: { label: 'P2', variant: 'secondary' },
  P3: { label: 'P3', variant: 'secondary' },
};

const typeConfig: Record<string, { label: string; icon: string }> = {
  user_story: { label: '用户故事', icon: '📖' },
  technical_task: { label: '技术任务', icon: '⚙️' },
  bug_fix: { label: 'Bug 修复', icon: '🐛' },
  spike: { label: 'Spike', icon: '🔍' },
};

/**
 * 任务列表组件
 */
export function TaskList({
  tasks,
  onStatusChange,
  onTaskClick,
  onSelectionChange,
  selectedIds = [],
  showStatusFilter = true,
  editableStatus = false,
  storyContextMap,
  onExecute,
  isExecutingIds = [],
  className,
}: TaskListProps) {
  const [statusFilter, setStatusFilter] = React.useState<
    (TaskStatus | StoryStatus)[]
  >([]);
  const [localSelectedIds, setLocalSelectedIds] =
    React.useState<string[]>(selectedIds);

  // 根据状态筛选任务
  const filteredTasks = React.useMemo(() => {
    if (statusFilter.length === 0) return tasks;
    return tasks.filter((task) =>
      statusFilter.includes(task.status as TaskStatus | StoryStatus)
    );
  }, [tasks, statusFilter]);

  // 处理选择变更
  const handleSelectChange = (taskId: string, checked: boolean) => {
    const newSelectedIds = checked
      ? [...localSelectedIds, taskId]
      : localSelectedIds.filter((id) => id !== taskId);
    setLocalSelectedIds(newSelectedIds);
    onSelectionChange?.(newSelectedIds);
  };

  // 全选/取消全选
  const handleSelectAll = (checked: boolean) => {
    const newSelectedIds = checked ? filteredTasks.map((t) => t.id) : [];
    setLocalSelectedIds(newSelectedIds);
    onSelectionChange?.(newSelectedIds);
  };

  // 状态循环切换
  const handleStatusCycle = (task: Task) => {
    if (!onStatusChange || !editableStatus) return;
    const statuses = TASK_STATUS_OPTIONS.map((s) => s.value);
    const currentIndex = statuses.indexOf(task.status);
    const nextIndex = (currentIndex + 1) % statuses.length;
    onStatusChange(task.id, statuses[nextIndex] as TaskStatus);
  };

  const isAllSelected =
    filteredTasks.length > 0 &&
    localSelectedIds.length === filteredTasks.length;
  const hasSelection = localSelectedIds.length > 0;

  return (
    <div className={cn('space-y-4', className)}>
      {/* 筛选和操作栏 */}
      {showStatusFilter && (
        <div className="flex items-center justify-between gap-4">
          <StatusFilterBar
            selectedStatuses={statusFilter}
            onStatusChange={setStatusFilter}
            isTask={true}
            placeholder="筛选状态..."
          />
          {hasSelection && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                已选 {localSelectedIds.length} 项
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleSelectAll(false)}
              >
                取消全选
              </Button>
            </div>
          )}
        </div>
      )}

      {/* 任务列表 */}
      {filteredTasks.length === 0 ? (
        <div className="py-8 text-center">
          <p className="text-muted-foreground">暂无任务</p>
        </div>
      ) : (
        <div className="space-y-2">
          {/* 全选复选框 */}
          <div className="flex items-center gap-2 rounded-lg bg-muted/50 px-4 py-2">
            <Checkbox
              checked={isAllSelected}
              onCheckedChange={(checked) => handleSelectAll(checked === true)}
            />
            <span className="text-sm font-medium">全选</span>
            <span className="text-sm text-muted-foreground">
              ({filteredTasks.length} 个任务)
            </span>
          </div>

          {/* 任务卡片列表 */}
          {filteredTasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              isSelected={localSelectedIds.includes(task.id)}
              onSelect={(checked) => handleSelectChange(task.id, checked)}
              onStatusChange={onStatusChange}
              onClick={onTaskClick}
              editableStatus={editableStatus}
              onStatusCycle={handleStatusCycle}
              storyContext={storyContextMap?.[task.story_id]}
              onExecute={onExecute}
              isExecuting={isExecutingIds.includes(task.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * 任务卡片组件
 */
interface TaskCardProps {
  task: Task;
  isSelected: boolean;
  onSelect: (checked: boolean) => void;
  onStatusChange?: (taskId: string, newStatus: TaskStatus) => void;
  onClick?: (task: Task) => void;
  editableStatus?: boolean;
  onStatusCycle?: (task: Task) => void;
  storyContext?: { storyTitle: string; journeyName: string };
  onExecute?: (task: Task) => void;
  isExecuting?: boolean;
}

function TaskCard({
  task,
  isSelected,
  onSelect,
  onStatusChange,
  onClick,
  editableStatus,
  onStatusCycle,
  storyContext,
  onExecute,
  isExecuting = false,
}: TaskCardProps) {
  const priority = priorityConfig[task.priority];
  const typeInfo = typeConfig[task.type] || typeConfig.technical_task;

  return (
    <Card
      className={cn(
        'transition-all duration-200',
        isSelected && 'bg-primary/5 ring-2 ring-primary',
        isExecuting && 'border-blue-400/50 bg-blue-50/30 dark:bg-blue-950/20',
        onClick && 'cursor-pointer hover:shadow-md'
      )}
      onClick={() => onClick?.(task)}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          {/* 选择复选框 */}
          <Checkbox
            checked={isSelected}
            onCheckedChange={(checked) => onSelect(checked === true)}
            onClick={(e) => e.stopPropagation()}
          />

          {/* 任务内容 */}
          <div className="min-w-0 flex-1">
            {/* 标题行 */}
            <div className="mb-1 flex items-center gap-2">
              <span className="font-mono text-xs text-muted-foreground">
                {task.id}
              </span>
              <Badge variant={priority.variant} className="text-xs">
                {priority.label}
              </Badge>
              {isExecuting && (
                <Badge
                  variant="outline"
                  className="gap-1 border-blue-400 text-xs text-blue-600 dark:text-blue-400"
                >
                  <Loader2 className="h-3 w-3 animate-spin" />
                  AI 执行中
                </Badge>
              )}
              <span className="text-xs" title={typeInfo.label}>
                {typeInfo.icon}
              </span>
              <span className="truncate text-xs text-muted-foreground">
                {task.type === 'user_story' ? '用户故事' : task.type}
              </span>
            </div>

            {/* 任务标题 */}
            <h4 className="line-clamp-2 text-sm font-medium">{task.title}</h4>

            {/* 描述预览 */}
            {task.description && (
              <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
                {task.description}
              </p>
            )}

            {/* 底部信息 */}
            <div className="mt-3 flex items-center gap-4">
              {/* 状态标签 */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onStatusCycle?.(task);
                }}
                disabled={!editableStatus}
                className={cn(
                  'cursor-pointer border-0 bg-transparent p-0',
                  editableStatus && 'hover:opacity-80'
                )}
              >
                <StatusBadge status={task.status} isTask={true} size="sm" />
              </button>

              {/* 估算工时 */}
              {task.estimation > 0 && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  <span>{task.estimation}h</span>
                </div>
              )}

              {/* 依赖数量 */}
              {task.dependencies && task.dependencies.length > 0 && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Calendar className="h-3 w-3" />
                  <span>依赖: {task.dependencies.length}</span>
                </div>
              )}

              {/* 标签数量 */}
              {task.tags && task.tags.length > 0 && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Tag className="h-3 w-3" />
                  <span>{task.tags.length}</span>
                </div>
              )}

              {/* 所属故事/旅程 */}
              {storyContext ? (
                <span
                  className="ml-auto max-w-[140px] truncate text-xs text-muted-foreground"
                  title={`${storyContext.journeyName} › ${storyContext.storyTitle}`}
                >
                  {storyContext.journeyName} › {storyContext.storyTitle}
                </span>
              ) : task.story_id ? (
                <span className="ml-auto text-xs text-muted-foreground">
                  {task.story_id}
                </span>
              ) : null}
            </div>
          </div>

          {/* 操作按钮 */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onClick?.(task)}>
                查看详情
              </DropdownMenuItem>
              {onExecute && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      onExecute(task);
                    }}
                    disabled={isExecuting}
                  >
                    {isExecuting ? (
                      <>
                        <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                        AI 执行中…
                      </>
                    ) : (
                      <>
                        <Play className="mr-2 h-3 w-3" />
                        AI 执行任务
                      </>
                    )}
                  </DropdownMenuItem>
                </>
              )}
              {editableStatus && onStatusChange && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    disabled
                    className="text-xs text-muted-foreground"
                  >
                    更改状态
                  </DropdownMenuItem>
                  {TASK_STATUS_OPTIONS.map((option) => (
                    <DropdownMenuItem
                      key={option.value}
                      onClick={() => onStatusChange(task.id, option.value)}
                    >
                      <span
                        className="mr-2 h-2 w-2 rounded-full"
                        style={{
                          backgroundColor:
                            option.color === 'gray'
                              ? '#9ca3af'
                              : option.color === 'slate'
                                ? '#64748b'
                                : option.color === 'blue'
                                  ? '#3b82f6'
                                  : option.color === 'green'
                                    ? '#22c55e'
                                    : option.color === 'red'
                                      ? '#ef4444'
                                      : option.color === 'yellow'
                                        ? '#eab308'
                                        : option.color === 'purple'
                                          ? '#a855f7'
                                          : '#f97316',
                        }}
                      />
                      {option.label}
                    </DropdownMenuItem>
                  ))}
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * 任务列表空状态
 */
export function TaskListEmpty({ message = '暂无任务' }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="mb-4 text-4xl">📋</div>
      <p className="text-muted-foreground">{message}</p>
    </div>
  );
}
