'use client';

/**
 * 并行工作台：跨项目查看全部任务
 *
 * 数据源：GET /api/tasks/all（跨项目任务聚合）。
 * 交互：任务列表 + 项目/状态/优先级筛选 + 多选批量状态更新。
 */

import { useMemo, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { ListTodo, Search, Layers, FolderKanban } from 'lucide-react';
import { Button, Input, Checkbox, Badge } from '@x-cartographer/ui';
import {
  useAllTasks,
  useProjects,
  useUpdateTaskStatus,
} from '@/lib/api/hooks';
import type { Task, TaskStatus, TaskPriority } from '@x-cartographer/shared';
import {
  TaskStatus as TaskStatusEnum,
  TaskPriority as TaskPriorityEnum,
} from '@x-cartographer/shared';
import {
  BulkActionToolbar,
  BulkUpdateConfirmDialog,
} from '@/features/tasks/components';
import { TASK_STATUS_LABEL, TASK_PRIORITY_CLS } from './components/card-meta';

interface AllTask extends Task {
  project: { id: string; name: string };
  story: { id: string; title: string };
}

const STATUS_OPTIONS: { value: TaskStatus; label: string }[] = [
  { value: TaskStatusEnum.BACKLOG, label: '待办池' },
  { value: TaskStatusEnum.TODO, label: '待执行' },
  { value: TaskStatusEnum.IN_PROGRESS, label: '进行中' },
  { value: TaskStatusEnum.IN_REVIEW, label: '评审中' },
  { value: TaskStatusEnum.TESTING, label: '测试中' },
  { value: TaskStatusEnum.DONE, label: '已完成' },
  { value: TaskStatusEnum.CANCELLED, label: '已取消' },
];

const PRIORITY_OPTIONS: { value: TaskPriority; label: string }[] = [
  { value: TaskPriorityEnum.P0, label: 'P0' },
  { value: TaskPriorityEnum.P1, label: 'P1' },
  { value: TaskPriorityEnum.P2, label: 'P2' },
  { value: TaskPriorityEnum.P3, label: 'P3' },
];

export function WorkbenchPage() {
  const { data: tasksData, isLoading: tasksLoading } = useAllTasks({});
  const { data: projects } = useProjects();
  const updateTaskStatus = useUpdateTaskStatus();

  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<TaskStatus | ''>('');
  const [priorityFilter, setPriorityFilter] = useState<TaskPriority | ''>('');
  const [projectFilter, setProjectFilter] = useState<string | ''>('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [bulkTargetStatus, setBulkTargetStatus] = useState<TaskStatus | null>(
    null
  );
  const [bulkReason, setBulkReason] = useState('');

  const allTasks = (tasksData ?? []) as AllTask[];

  const projectOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const task of allTasks) {
      map.set(task.project.id, task.project.name);
    }
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [allTasks]);

  const filteredTasks = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allTasks.filter((task) => {
      if (statusFilter && task.status !== statusFilter) return false;
      if (priorityFilter && task.priority !== priorityFilter) return false;
      if (projectFilter && task.project.id !== projectFilter) return false;
      if (q) {
        return (
          task.title.toLowerCase().includes(q) ||
          task.id.toLowerCase().includes(q) ||
          task.project.name.toLowerCase().includes(q) ||
          (task.story?.title.toLowerCase().includes(q) ?? false)
        );
      }
      return true;
    });
  }, [allTasks, statusFilter, priorityFilter, projectFilter, query]);

  const visibleIds = useMemo(
    () => new Set(filteredTasks.map((t) => t.id)),
    [filteredTasks]
  );

  const selectedVisibleIds = useMemo(
    () => selectedIds.filter((id) => visibleIds.has(id)),
    [selectedIds, visibleIds]
  );

  const isAllSelected =
    filteredTasks.length > 0 &&
    selectedVisibleIds.length === filteredTasks.length;

  const toggleSelect = (id: string, checked: boolean) => {
    setSelectedIds((prev) =>
      checked ? [...prev, id] : prev.filter((x) => x !== id)
    );
  };

  const toggleSelectAll = (checked: boolean) => {
    setSelectedIds(checked ? filteredTasks.map((t) => t.id) : []);
  };

  const handleBulkStatusChange = (status: TaskStatus) => {
    setBulkTargetStatus(status);
    setBulkDialogOpen(true);
  };

  const handleBulkConfirm = async () => {
    if (!bulkTargetStatus || selectedVisibleIds.length === 0) return;
    await Promise.all(
      selectedVisibleIds.map((id) =>
        updateTaskStatus.mutateAsync({
          id,
          status: bulkTargetStatus,
          reason: bulkReason || undefined,
        })
      )
    );
    setSelectedIds([]);
    setBulkReason('');
    setBulkTargetStatus(null);
  };

  const openTask = (task: AllTask) => {
    window.location.href = `/projects/${task.project.id}/tasks`;
  };

  if (tasksLoading) {
    return (
      <div className="flex h-full items-center justify-center rounded-xl border bg-muted/30 text-muted-foreground">
        加载中…
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4">
      {/* 标题 */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Layers className="h-5 w-5" />
            并行工作台
          </h2>
          <p className="text-sm text-muted-foreground">
            跨项目查看全部任务，批量更新状态
          </p>
        </div>
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <span className="flex items-center gap-1">
            <FolderKanban className="h-4 w-4" />
            {projectOptions.length} 个项目
          </span>
          <span className="flex items-center gap-1">
            <ListTodo className="h-4 w-4" />
            {filteredTasks.length} 条任务
          </span>
        </div>
      </div>

      {/* 筛选 */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索标题、ID、项目、故事…"
            className="h-9 w-64 pl-8"
          />
        </div>
        <select
          value={projectFilter}
          onChange={(e) => setProjectFilter(e.target.value)}
          className="h-9 rounded-md border bg-background px-2 text-sm"
        >
          <option value="">全部项目</option>
          {projectOptions.map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as TaskStatus | '')}
          className="h-9 rounded-md border bg-background px-2 text-sm"
        >
          <option value="">全部状态</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
        <select
          value={priorityFilter}
          onChange={(e) =>
            setPriorityFilter(e.target.value as TaskPriority | '')
          }
          className="h-9 rounded-md border bg-background px-2 text-sm"
        >
          <option value="">全部优先级</option>
          {PRIORITY_OPTIONS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
        {(statusFilter || priorityFilter || projectFilter || query) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setStatusFilter('');
              setPriorityFilter('');
              setProjectFilter('');
              setQuery('');
            }}
          >
            清除筛选
          </Button>
        )}
      </div>

      {/* 批量操作工具栏 */}
      <BulkActionToolbar
        selectedCount={{ tasks: selectedVisibleIds.length, stories: 0 }}
        onStatusChange={(status) =>
          handleBulkStatusChange(status as TaskStatus)
        }
        onClearSelection={() => setSelectedIds([])}
      />

      {/* 任务列表 */}
      <section className="rounded-xl border bg-muted/10 p-3">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold">
            <ListTodo className="h-4 w-4" />
            任务列表
            <span className="text-xs font-normal text-muted-foreground">
              {filteredTasks.length} 条
            </span>
          </h3>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={isAllSelected}
              onCheckedChange={(checked) =>
                toggleSelectAll(checked === true)
              }
            />
            全选
          </label>
        </div>

        {filteredTasks.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            暂无匹配任务
          </p>
        ) : (
          <div className="space-y-1.5">
            {filteredTasks.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                selected={selectedVisibleIds.includes(task.id)}
                onSelect={toggleSelect}
                onOpen={openTask}
              />
            ))}
          </div>
        )}
      </section>

      <BulkUpdateConfirmDialog
        open={bulkDialogOpen}
        onOpenChange={setBulkDialogOpen}
        selectedCount={{ tasks: selectedVisibleIds.length, stories: 0 }}
        currentStatus={
          (filteredTasks.find((t) => selectedVisibleIds.includes(t.id))?.status as TaskStatus) ??
          TaskStatusEnum.TODO
        }
        targetStatus={bulkTargetStatus ?? TaskStatusEnum.TODO}
        isTask={true}
        onConfirm={handleBulkConfirm}
        onCancel={() => setBulkDialogOpen(false)}
        reason={bulkReason}
        onReasonChange={setBulkReason}
      />
    </div>
  );
}

interface TaskRowProps {
  task: AllTask;
  selected: boolean;
  onSelect: (id: string, checked: boolean) => void;
  onOpen: (task: AllTask) => void;
}

function TaskRow({ task, selected, onSelect, onOpen }: TaskRowProps) {
  return (
    <div
      className="flex items-start gap-3 rounded-lg border bg-background p-3 transition-colors hover:border-primary/50 hover:bg-accent/40"
    >
      <Checkbox
        checked={selected}
        onCheckedChange={(checked) => onSelect(task.id, checked === true)}
        className="mt-0.5"
      />
      <button
        type="button"
        onClick={() => onOpen(task)}
        className="min-w-0 flex-1 text-left text-sm"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="line-clamp-2 font-medium leading-snug">
              {task.title}
            </p>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs">
              <span className="text-muted-foreground">{task.id}</span>
              <span className={TASK_PRIORITY_CLS[task.priority] ?? ''}>
                {task.priority}
              </span>
              <span className="rounded bg-muted px-1 py-0.5 text-muted-foreground">
                {TASK_STATUS_LABEL[task.status] ?? task.status}
              </span>
              {task.assignee && (
                <span className="text-muted-foreground">
                  @{task.assignee}
                </span>
              )}
            </div>
            <p className="mt-1.5 line-clamp-1 text-xs text-muted-foreground">
              所属故事：{task.story?.title ?? '项目任务池'}
            </p>
          </div>
          <Link
            to="/projects/$projectId"
            params={{ projectId: task.project.id }}
            className="shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            <Badge variant="outline" className="text-xs">
              {task.project.name}
            </Badge>
          </Link>
        </div>
      </button>
    </div>
  );
}
