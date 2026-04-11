'use client';

/**
 * 故事任务拆解面板
 *
 * 在故事地图详情侧边栏中管理某个用户故事下的任务，
 * 支持手动新增和 AI 自动拆解，维护 task.story_id 关联关系。
 */

import { useState } from 'react';
import { nanoid } from 'nanoid';
import { Plus, Trash2, Wand2, Loader2, Clock, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { StatusBadge, TASK_STATUS_OPTIONS } from '@/features/tasks/components/status-badge';
import { useProjectStore } from '@/features/projects/stores';
import { decomposeStory, type DecomposeStoryContext } from '@/app/actions/llm.actions';
import type { Task, TaskType, TaskPriority, Project } from '@/types';
import { TaskType as TaskTypeEnum, TaskPriority as TaskPriorityEnum, TaskStatus, LLMProvider } from '@/types';
import type { UserStory } from '@/types/user-story';
import { cn } from '@/lib/utils';

interface StoryTaskPanelProps {
  story: UserStory;
  project: Project;
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

/** 从故事及旅程列表中找到目标故事所在旅程，更新故事任务，返回新 journeys */
function buildUpdatedJourneys(project: Project, storyId: string, newTasks: Task[]) {
  return project.user_journeys.map((journey) => ({
    ...journey,
    stories: journey.stories?.map((s) =>
      s.id === storyId ? { ...s, tasks: newTasks } : s
    ),
  }));
}

export function StoryTaskPanel({ story, project }: StoryTaskPanelProps) {
  const { modifyProject } = useProjectStore();
  const tasks = story.tasks ?? [];

  const [isAddingTask, setIsAddingTask] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [isDecomposing, setIsDecomposing] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  /** 保存任务列表变更到项目 */
  async function saveTasks(newTasks: Task[]) {
    setSaving(true);
    try {
      await modifyProject(project.id, {
        user_journeys: buildUpdatedJourneys(project, story.id, newTasks),
      });
    } finally {
      setSaving(false);
    }
  }

  /** 手动新增任务 */
  async function handleAddTask() {
    if (!form.title.trim()) return;

    const now = new Date().toISOString();
    const newTask: Task = {
      id: `TASK-${nanoid(8)}`,
      story_id: story.id,
      title: form.title.trim(),
      description: '',
      type: form.type,
      priority: form.priority,
      estimation: form.estimation,
      status: TaskStatus.BACKLOG,
      dependencies: [],
      tags: [],
      created_at: now,
      updated_at: now,
    };

    await saveTasks([...tasks, newTask]);
    setForm(EMPTY_FORM);
    setIsAddingTask(false);
  }

  /** 删除任务 */
  async function handleDeleteTask(taskId: string) {
    await saveTasks(tasks.filter((t) => t.id !== taskId));
  }

  /** 切换任务状态 */
  async function handleStatusChange(taskId: string, newStatus: TaskStatus) {
    await saveTasks(tasks.map((t) => t.id === taskId ? { ...t, status: newStatus } : t));
  }

  /** AI 自动拆解 */
  async function handleAIDecompose() {
    setAiError(null);
    const provider: LLMProvider = project.settings?.llm_provider ?? LLMProvider.OPENAI;

    // 构建产品全景上下文
    const storyMapSummary = project.user_journeys
      .map((j) => {
        const storyLines = (j.stories ?? []).map((s) => {
          const marker = s.id === story.id ? ' ← 【当前】' : '';
          const taskCount = s.tasks?.length ?? 0;
          return `  - ${s.title} [${s.status ?? 'backlog'}]${taskCount > 0 ? ` (${taskCount}个任务)` : ''}${marker}`;
        });
        return [`旅程：${j.name}（${j.persona ?? ''}）`, ...storyLines].join('\n');
      })
      .join('\n\n');

    const currentJourney = project.user_journeys.find((j) =>
      j.stories?.some((s) => s.id === story.id)
    );
    const currentJourneyTasks = (currentJourney?.stories ?? [])
      .flatMap((s) => s.tasks ?? [])
      .map((t) => ({ id: t.id, title: t.title }));

    const context: DecomposeStoryContext = {
      projectName: project.name,
      projectDescription: project.description ?? undefined,
      techStack: project.metadata?.tech_stack ?? [],
      storyMapSummary,
      currentJourneyTasks,
    };

    console.log(
      `[StoryTaskPanel] AI decompose start: story="${story.id}" "${story.title}"` +
      ` | journeys=${project.user_journeys.length}` +
      ` | currentJourneyTasks=${currentJourneyTasks.length}` +
      ` | techStack=[${(project.metadata?.tech_stack ?? []).join(', ')}]`
    );

    setIsDecomposing(true);
    try {
      const data = await decomposeStory(
        {
          title: story.title,
          description: story.description,
          acceptance_criteria: story.acceptance_criteria ?? [],
        },
        provider,
        context
      );

      const now = new Date().toISOString();
      // action 已完成 id 生成和依赖序号映射，直接使用
      const generated: Task[] = (data.tasks ?? []).map((t) => ({
        id: t.id,
        story_id: story.id,
        title: t.title,
        description: t.description ?? '',
        type: (t.type as TaskType) ?? TaskTypeEnum.TECHNICAL_TASK,
        priority: (t.priority as TaskPriority) ?? TaskPriorityEnum.P1,
        estimation: t.estimation ?? 2,
        status: TaskStatus.BACKLOG,
        dependencies: t.dependencies ?? [],
        tags: t.tags ?? [],
        created_at: now,
        updated_at: now,
      }));

      console.log(`[StoryTaskPanel] AI decompose done: ${generated.length} tasks added to story "${story.id}"`);
      await saveTasks([...tasks, ...generated]);
    } catch (err) {
      console.error(`[StoryTaskPanel] AI decompose error:`, err instanceof Error ? err.message : err);
      setAiError(err instanceof Error ? err.message : '请求失败，请检查 API Key 配置');
    } finally {
      setIsDecomposing(false);
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
          onClick={() => { setIsAddingTask(true); setAiError(null); }}
          disabled={isAddingTask || saving}
        >
          <Plus className="h-3.5 w-3.5 mr-1" />
          新增任务
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="flex-1"
          onClick={handleAIDecompose}
          disabled={isDecomposing || saving}
        >
          {isDecomposing ? (
            <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
          ) : (
            <Wand2 className="h-3.5 w-3.5 mr-1" />
          )}
          AI 拆解
        </Button>
      </div>

      {/* AI 错误提示 */}
      {aiError && (
        <div className="flex items-start gap-2 p-2 rounded-md bg-destructive/10 text-destructive text-xs">
          <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>{aiError}</span>
        </div>
      )}

      {/* 手动新增表单 */}
      {isAddingTask && (
        <div className="border rounded-md p-3 space-y-2 bg-muted/30">
          <Input
            placeholder="任务标题"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            onKeyDown={(e) => { if (e.key === 'Enter') handleAddTask(); if (e.key === 'Escape') setIsAddingTask(false); }}
            autoFocus
            className="text-sm h-8"
          />
          <div className="flex gap-2">
            {/* 类型 */}
            <select
              value={form.type}
              onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as TaskType }))}
              className="flex-1 text-xs h-7 rounded border bg-background px-2"
            >
              {TASK_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            {/* 优先级 */}
            <select
              value={form.priority}
              onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value as TaskPriority }))}
              className="w-16 text-xs h-7 rounded border bg-background px-2"
            >
              {TASK_PRIORITY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            {/* 工时 */}
            <input
              type="number"
              min={0.5}
              max={24}
              step={0.5}
              value={form.estimation}
              onChange={(e) => setForm((f) => ({ ...f, estimation: parseFloat(e.target.value) || 1 }))}
              className="w-16 text-xs h-7 rounded border bg-background px-2"
            />
          </div>
          <div className="flex gap-2 justify-end">
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setIsAddingTask(false)}>
              取消
            </Button>
            <Button size="sm" className="h-7 text-xs" onClick={handleAddTask} disabled={!form.title.trim() || saving}>
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
          {tasks.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              onDelete={handleDeleteTask}
              onStatusChange={handleStatusChange}
              disabled={saving}
            />
          ))}
        </div>
      ) : !isAddingTask ? (
        <p className="text-xs text-muted-foreground text-center py-4">
          暂无任务，点击「新增任务」或「AI 拆解」开始
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
          <span className={cn('text-[10px] font-semibold', priorityCls(task.priority))}>
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
