'use client';

/**
 * 故事任务拆解面板
 *
 * 支持手动新增任务、删除任务、切换任务状态（任务拆解由外部 Agent 通过 xcart CLI 完成）。
 */

import { useState, useRef } from 'react';
import { Plus, Trash2, Loader2, Clock } from 'lucide-react';
import { Button, Input, Badge, Separator } from '@x-cartographer/ui';
import { StatusBadge } from '@/features/tasks/components/status-badge';
import { useCreateTask, useUpdateTaskStatus, useDeleteTask } from '@/lib/api/hooks';
import { useVirtualList } from '@/lib/hooks/use-virtual-list';
import type { Task, TaskType, TaskPriority, UserStory } from '@/types';
import { TaskType as TaskTypeEnum, TaskPriority as TaskPriorityEnum, TaskStatus } from '@/types';
import { cn } from '@/lib/utils';

/** 虚拟滚动行高（TaskRow 高度 + 间距） */
const TASK_ROW_HEIGHT = 64;

interface StoryTaskPanelProps {
  story: UserStory;
}
/** 任务类型选项 */
const TASK_TYPE_OPTIONS: { value: TaskType; label: string }[] = [
  { value: TaskTypeEnum.TECHNICAL_TASK, label: '技术任务' },
  { value: TaskTypeEnum.USER_STORY, label: '功能实现' },
  { value: TaskTypeEnum.BUG_FIX, label: 'Bug 修复' },
  { value: TaskTypeEnum.SPIKE, label: '技术探索' },
];

/** 任务优先级选项 */
const TASK_PRIORITY_OPTIONS: { value: TaskPriority; label: string; cls: string }[] = [
  { value: TaskPriorityEnum.P0, label: 'P0', cls: 'text-red-600' },
  { value: TaskPriorityEnum.P1, label: 'P1', cls: 'text-orange-500' },
  { value: TaskPriorityEnum.P2, label: 'P2', cls: 'text-blue-500' },
  { value: TaskPriorityEnum.P3, label: 'P3', cls: 'text-gray-500' },
];

/** 空白新增任务表单初始值 */
const EMPTY_FORM = {
  title: '',
  type: TaskTypeEnum.TECHNICAL_TASK as TaskType,
  priority: TaskPriorityEnum.P1 as TaskPriority,
  estimation: 2,
};

function priorityCls(p: TaskPriority) {
  return TASK_PRIORITY_OPTIONS.find((o) => o.value === p)?.cls ?? '';
}

function typeLabelOf(t: TaskType) {
  return TASK_TYPE_OPTIONS.find((o) => o.value === t)?.label ?? t;
}


export function StoryTaskPanel({ story }: StoryTaskPanelProps) {
  const createTask = useCreateTask();
  const updateTaskStatus = useUpdateTaskStatus();
  const deleteTask = useDeleteTask();
  const tasks = story.tasks ?? [];

  // TASK-089：虚拟滚动容器与窗口
  const taskListRef = useRef<HTMLDivElement>(null);
  const { start, end, totalHeight, offsetY } = useVirtualList(
    tasks.length,
    taskListRef,
    TASK_ROW_HEIGHT
  );

  const [isAddingTask, setIsAddingTask] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  /** 手动新增任务 */
  async function handleAddTask() {
    if (!form.title.trim()) return;

    setSaving(true);
    try {
      await createTask.mutateAsync({
        storyId: story.id,
        title: form.title.trim(),
        description: '',
        type: form.type,
        priority: form.priority,
        estimation: form.estimation,
        dependencies: [],
        tags: [],
      });
      setForm(EMPTY_FORM);
      setIsAddingTask(false);
    } finally {
      setSaving(false);
    }
  }

  /** 删除任务 */
  async function handleDeleteTask(taskId: string) {
    setSaving(true);
    try {
      await deleteTask.mutateAsync({ id: taskId });
    } finally {
      setSaving(false);
    }
  }

  /** 切换任务状态 */
  async function handleStatusChange(taskId: string, newStatus: TaskStatus) {
    setSaving(true);
    try {
      await updateTaskStatus.mutateAsync({ id: taskId, status: newStatus });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      {/* 操作按钮行 */}
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          className="flex-1"
          onClick={() => setIsAddingTask(true)}
          disabled={isAddingTask || saving}
        >
          <Plus className="h-3.5 w-3.5 mr-1" />
          新增任务
        </Button>
      </div>

      {/* 手动新增表单 */}
      {isAddingTask && (
        <div className="border rounded-md p-3 space-y-2 bg-muted/30">
          <Input
            placeholder="任务标题"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAddTask();
              if (e.key === 'Escape') setIsAddingTask(false);
            }}
            autoFocus
            className="text-sm h-8"
          />
          <div className="flex gap-2">
            {/* 类型 */}
            <select
              value={form.type}
              onChange={(e) =>
                setForm((f) => ({ ...f, type: e.target.value as TaskType }))
              }
              className="flex-1 text-xs h-7 rounded border bg-background px-2"
            >
              {TASK_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            {/* 优先级 */}
            <select
              value={form.priority}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  priority: e.target.value as TaskPriority,
                }))
              }
              className="w-16 text-xs h-7 rounded border bg-background px-2"
            >
              {TASK_PRIORITY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            {/* 工时 */}
            <input
              type="number"
              min={0.5}
              max={24}
              step={0.5}
              value={form.estimation}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  estimation: parseFloat(e.target.value) || 1,
                }))
              }
              className="w-16 text-xs h-7 rounded border bg-background px-2"
            />
          </div>
          <div className="flex gap-2 justify-end">
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs"
              onClick={() => setIsAddingTask(false)}
            >
              取消
            </Button>
            <Button
              size="sm"
              className="h-7 text-xs"
              onClick={handleAddTask}
              disabled={!form.title.trim() || saving}
            >
              {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : '添加'}
            </Button>
          </div>
        </div>
      )}

      {/* 任务列表 */}
      {tasks.length > 0 ? (
        <div className="space-y-2">
          <Separator />
          <p className="text-xs text-muted-foreground">{tasks.length} 个任务</p>
          {/* 虚拟滚动容器（TASK-089） */}
          <div
            ref={taskListRef}
            className="overflow-y-auto"
            style={{ maxHeight: Math.min(tasks.length * TASK_ROW_HEIGHT, 320) }}
          >
            <div style={{ height: totalHeight, position: 'relative' }}>
              <div
                style={{
                  transform: `translateY(${offsetY}px)`,
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                }}
              >
                {tasks.slice(start, end).map((task) => (
                  <div key={task.id} style={{ height: TASK_ROW_HEIGHT }}>
                    <TaskRow
                      task={task}
                      onDelete={handleDeleteTask}
                      onStatusChange={handleStatusChange}
                      disabled={saving}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : !isAddingTask ? (
        <p className="text-xs text-muted-foreground text-center py-4">
          暂无任务，点击「新增任务」或由外部 Agent 通过 xcart CLI 拆解
        </p>
      ) : null}
    </div>
  );
}

const STATUS_CYCLE: TaskStatus[] = [
  TaskStatus.BACKLOG,
  TaskStatus.TODO,
  TaskStatus.IN_PROGRESS,
  TaskStatus.DONE,
];

/** 单条任务行 */
function TaskRow({
  task,
  onDelete,
  onStatusChange,
  disabled,
}: {
  task: Task;
  onDelete: (id: string) => void;
  onStatusChange: (taskId: string, newStatus: TaskStatus) => void;
  disabled?: boolean;
}) {
  function handleStatusClick(e: React.MouseEvent) {
    e.stopPropagation();
    const idx = STATUS_CYCLE.indexOf(task.status as TaskStatus);
    const next = STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length];
    onStatusChange(task.id, next);
  }

  return (
    <div className="flex items-start gap-2 p-2 rounded-md border bg-background text-sm group">
      <div className="flex-1 min-w-0 space-y-1">
        <p className="leading-snug line-clamp-2">{task.title}</p>
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={handleStatusClick}
            disabled={disabled}
            className="border-0 p-0 bg-transparent cursor-pointer hover:opacity-80 disabled:cursor-default"
            title="点击切换状态"
          >
            <StatusBadge status={task.status} isTask size="sm" />
          </button>
          <span
            className={cn('text-[10px] font-semibold', priorityCls(task.priority))}
          >
            {task.priority}
          </span>
          <Badge variant="outline" className="text-[10px] px-1 py-0">
            {typeLabelOf(task.type)}
          </Badge>
          {task.estimation > 0 && (
            <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
              <Clock className="h-2.5 w-2.5" />
              {task.estimation}h
            </span>
          )}
          {task.dependencies.length > 0 && (
            <span className="text-[10px] text-muted-foreground">
              依赖 {task.dependencies.length}
            </span>
          )}
        </div>
      </div>
      <Button
        size="icon"
        variant="ghost"
        className="h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
        onClick={() => onDelete(task.id)}
        disabled={disabled}
      >
        <Trash2 className="h-3 w-3" />
      </Button>
    </div>
  );
}
