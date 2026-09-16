/**
 * 任务管理页面
 *
 * 任务列表视图，支持状态筛选和管理
 */

'use client';

import * as React from 'react';
import { Plus, Download, Network } from 'lucide-react';
import {
  Button,
  Input,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@x-cartographer/ui';
import {
  TaskList,
  StatusFilterBar,
  TaskListEmpty,
  StatusOverview,
  ProgressStats,
  ViewSwitcher,
  BulkActionToolbar,
  BulkUpdateConfirmDialog,
  PresetManager,
} from '@/features/tasks/components';
import type { ViewType, FilterConditions } from '@/features/tasks/components';
import { TaskCreateDialog, type NewDevTaskDraft } from './task-create-dialog';
import { TaskDetailSheet } from './task-detail-sheet';
import { TaskDependencyGraph } from '@/features/task-graph/components/task-dependency-graph';
import {
  useUpdateDevTaskStatus,
  useCreateDevTask,
  useUpdateDevTask,
} from '@/lib/api/hooks';
import { TaskStatus } from '@/types';
import type { DevTask, StoryStatus, Product } from '@/types';
import { serializeKanbanMarkdown } from '@/lib/markdown';
import { useHotkeys } from '@/lib/hooks/use-hotkeys';

interface TasksPageProps {
  /** 当前产品 */
  project: Product;
}
export function TasksPage({ project: initialProject }: TasksPageProps) {
  const updateTaskStatus = useUpdateDevTaskStatus();
  const createTask = useCreateDevTask();
  const updateTask = useUpdateDevTask();
  const [searchQuery, setSearchQuery] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<
    (TaskStatus | StoryStatus)[]
  >([]);
  const [selectedTaskIds, setSelectedTaskIds] = React.useState<string[]>([]);
  /** 当前视图 */
  const [view, setView] = React.useState<ViewType>('list');
  /** 批量更新确认弹窗 */
  const [bulkDialogOpen, setBulkDialogOpen] = React.useState(false);
  const [bulkTargetStatus, setBulkTargetStatus] = React.useState<
    TaskStatus | StoryStatus | null
  >(null);
  const [bulkReason, setBulkReason] = React.useState('');
  const [project, setProject] = React.useState(initialProject);
  const [createDialogOpen, setCreateDialogOpen] = React.useState(false);
  /** 任务详情抽屉 */
  const [detailTask, setDetailTask] = React.useState<DevTask | null>(null);
  const [detailSheetOpen, setDetailSheetOpen] = React.useState(false);

  /**
   * 打开任务详情抽屉
   */
  const openTaskDetail = React.useCallback((task: DevTask) => {
    setDetailTask(task);
    setDetailSheetOpen(true);
  }, []);
  /** 搜索框 ref（快捷键聚焦用） */
  const searchInputRef = React.useRef<HTMLInputElement>(null);

  // TASK-090：键盘快捷键
  useHotkeys('n', () => setCreateDialogOpen(true), {
    enabled: !createDialogOpen && !detailSheetOpen,
  });
  useHotkeys('mod+s', (e) => {
    e.preventDefault();
    handleExportKanban();
  });
  useHotkeys('mod+k', (e) => {
    e.preventDefault();
    searchInputRef.current?.focus();
  });

  // 同步产品数据
  React.useEffect(() => {
    setProject(initialProject);
  }, [initialProject]);

  // 收集所有研发任务
  const allTasks = React.useMemo(() => {
    const tasks: DevTask[] = [];
    project.user_activities?.forEach((activity) => {
      activity.stories?.forEach((story) => {
        if (story.dev_tasks) {
          tasks.push(...story.dev_tasks);
        }
      });
    });
    return tasks;
  }, [project]);

  // 故事/活动上下文 map，用于任务卡片显示归属
  const storyContextMap = React.useMemo(() => {
    const map: Record<string, { storyTitle: string; activityName: string }> = {};
    project.user_activities?.forEach((activity) => {
      activity.stories?.forEach((story) => {
        map[story.id] = { storyTitle: story.title, activityName: activity.name };
      });
    });
    return map;
  }, [project]);

  // 过滤任务
  const filteredTasks = React.useMemo(() => {
    let result = allTasks;
    if (statusFilter.length > 0) {
      result = result.filter((task) =>
        statusFilter.includes(task.status as TaskStatus | StoryStatus)
      );
    }
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (task) =>
          task.title.toLowerCase().includes(query) ||
          task.description.toLowerCase().includes(query) ||
          task.id.toLowerCase().includes(query) ||
          task.tags?.some((tag) => tag.toLowerCase().includes(query))
      );
    }
    return result;
  }, [allTasks, statusFilter, searchQuery]);

  // 按状态分组统计
  const statusStats = React.useMemo(() => {
    const stats: Record<string, number> = {
      backlog: 0,
      todo: 0,
      in_progress: 0,
      in_review: 0,
      testing: 0,
      done: 0,
    };
    allTasks.forEach((task) => {
      if (stats[task.status] !== undefined) {
        stats[task.status]++;
      }
    });
    return stats;
  }, [allTasks]);

  // 按状态统计用户故事
  const storyStats = React.useMemo(() => {
    const stats: Record<string, number> = {
      backlog: 0,
      todo: 0,
      in_progress: 0,
      accepted: 0,
    };
    project.user_activities?.forEach((activity) => {
      activity.stories?.forEach((story) => {
        if (story.status && stats[story.status] !== undefined) {
          stats[story.status]++;
        }
      });
    });
    return stats;
  }, [project]);

  // 应用筛选预设（条件中包含搜索关键词）
  const handleApplyPreset = React.useCallback(
    (conditions: FilterConditions) => {
      setStatusFilter(
        conditions.taskStatuses ? [...conditions.taskStatuses] : []
      );
      setSearchQuery(conditions.searchQuery ?? '');
    },
    []
  );

  // 批量更新状态
  const handleBulkStatusChange = (status: TaskStatus | StoryStatus) => {
    setBulkTargetStatus(status);
    setBulkDialogOpen(true);
  };

  const handleBulkConfirm = async () => {
    if (!bulkTargetStatus) return;
    try {
      await Promise.all(
        selectedTaskIds.map((id) =>
          updateTaskStatus.mutateAsync({
            id,
            status: bulkTargetStatus as TaskStatus,
            reason: bulkReason || undefined,
          })
        )
      );
      // 乐观更新本地产品状态
      setProject((prev) => ({
        ...prev,
        user_activities: prev.user_activities?.map((activity) => ({
          ...activity,
          stories: activity.stories?.map((story) => ({
            ...story,
            dev_tasks: story.dev_tasks?.map((task) =>
              selectedTaskIds.includes(task.id)
                ? { ...task, status: bulkTargetStatus as TaskStatus }
                : task
            ),
          })),
        })),
      }));
      setSelectedTaskIds([]);
      setBulkReason('');
    } catch (err) {
      console.error('bulk update task status failed', err);
    }
  };

  // 处理状态变更
  const handleStatusChange = async (taskId: string, newStatus: TaskStatus) => {
    try {
      await updateTaskStatus.mutateAsync({ id: taskId, status: newStatus });
      // 乐观更新本地产品状态
      setProject((prev) => ({
        ...prev,
        user_activities: prev.user_activities?.map((activity) => ({
          ...activity,
          stories: activity.stories?.map((story) => ({
            ...story,
            dev_tasks: story.dev_tasks?.map((task) =>
              task.id === taskId ? { ...task, status: newStatus } : task
            ),
          })),
        })),
      }));
    } catch (err) {
      console.error('update task status failed', err);
    }
  };

  // 导出 Kanban Markdown
  const handleExportKanban = React.useCallback(() => {
    try {
      const markdown = serializeKanbanMarkdown(project);
      const blob = new Blob([markdown], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      const safeName = project.name.replace(/[/\\:*?"<>|]/g, '_');
      anchor.download = `kanban-${safeName}.md`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Kanban 导出失败:', error);
      alert(`导出失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }, [project]);

  // 进度统计
  const completedCount = statusStats.done || 0;
  const totalCount = allTasks.length;
  const progress =
    totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  // 处理新建任务（绑定到指定故事）
  // 用服务端返回的 ID 构造乐观项——前端不得伪造主键（曾用本地 nanoid，
  // 导致乐观项 ID 与库里真实 ID 不符，后续按 ID 的操作全部落空）。
  const handleCreateTask = async (draft: NewDevTaskDraft) => {
    try {
      const created = await createTask.mutateAsync({
        storyId: draft.storyId,
        productId: project.id,
        title: draft.title,
        description: draft.description,
        priority: draft.priority,
        estimation: draft.estimation,
        dependencies: draft.dependencies,
        tags: draft.tags,
      });
      const now = new Date().toISOString();
      const optimistic: DevTask = {
        id: created.id,
        story_id: draft.storyId,
        title: draft.title,
        description: draft.description,
        priority: draft.priority,
        estimation: draft.estimation,
        status: TaskStatus.BACKLOG,
        dependencies: draft.dependencies,
        tags: draft.tags,
        created_at: now,
        updated_at: now,
      };
      setProject((prev) => ({
        ...prev,
        user_activities: prev.user_activities?.map((activity) => ({
          ...activity,
          stories: activity.stories?.map((story) =>
            story.id === draft.storyId
              ? { ...story, dev_tasks: [...(story.dev_tasks ?? []), optimistic] }
              : story
          ),
        })),
      }));
    } catch (err) {
      console.error('create task failed', err);
    }
  };
  return (
    <div className="space-y-6">
      {/* 顶部操作栏 */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Input
            ref={searchInputRef}
            placeholder="搜索任务... (⌘K)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-64"
          />
          <StatusFilterBar
            selectedStatuses={statusFilter}
            onStatusChange={setStatusFilter}
            isTask={true}
            placeholder="所有状态"
          />
          <PresetManager
            currentConditions={{
              taskStatuses: statusFilter as TaskStatus[],
              searchQuery,
            }}
            onApplyPreset={handleApplyPreset}
          />
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportKanban}
          >
            <Download className="mr-2 h-4 w-4" />
            导出
          </Button>
          <Button size="sm" onClick={() => setCreateDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            新建任务
          </Button>
        </div>
      </div>

      {/* 统计信息 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            状态概览
          </CardTitle>
        </CardHeader>
        <CardContent>
          <StatusOverview
            counts={statusStats}
            entityType="task"
            selectedStatuses={statusFilter}
            onStatusClick={(status) => {
              const next = statusFilter.includes(status)
                ? statusFilter.filter((s) => s !== status)
                : [...statusFilter, status];
              setStatusFilter(next);
            }}
          />
        </CardContent>
      </Card>
      <ProgressStats
        taskStats={{
          total: totalCount,
          completed: completedCount,
          inProgress:
            (statusStats.in_progress || 0) +
            (statusStats.in_review || 0) +
            (statusStats.testing || 0),
          backlog: statusStats.backlog || 0,
        }}
        storyStats={{
          total: storyStats.backlog + storyStats.todo + storyStats.in_progress + storyStats.accepted,
          completed: storyStats.accepted || 0,
          inProgress: storyStats.in_progress || 0,
          backlog: storyStats.backlog || 0,
        }}
        overallProgress={progress}
      />

      {/* 视图切换 */}
      <div className="flex items-center justify-between">
        <ViewSwitcher
          currentView={view}
          onViewChange={setView}
          availableViews={['list', 'kanban', 'board', 'dependencies']}
        />
        <BulkActionToolbar
          selectedCount={{ tasks: selectedTaskIds.length, stories: 0 }}
          onStatusChange={handleBulkStatusChange}
          onClearSelection={() => setSelectedTaskIds([])}
        />
      </div>

      {/* 列表视图 */}
      {view === 'list' &&
        (allTasks.length > 0 ? (
          <TaskList
            tasks={filteredTasks}
            onStatusChange={handleStatusChange}
            onTaskClick={openTaskDetail}
            onSelectionChange={setSelectedTaskIds}
            selectedIds={selectedTaskIds}
            showStatusFilter={false}
            editableStatus={true}
            storyContextMap={storyContextMap}
          />
        ) : (
          <TaskListEmpty message="暂无任务，请先创建用户故事并拆解任务" />
        ))}

      {/* Kanban 视图 */}
      {view === 'kanban' && (
        <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
          {[
            'backlog',
            'todo',
            'in_progress',
            'in_review',
            'testing',
            'done',
          ].map((status) => (
            <div key={status} className="space-y-2">
              <h4 className="text-sm font-medium capitalize">
                {status === 'in_progress'
                  ? '进行中'
                  : status === 'in_review'
                    ? '待评审'
                    : status === 'testing'
                      ? '测试中'
                      : status}
                <span className="ml-2 text-muted-foreground">
                  ({statusStats[status] || 0})
                </span>
              </h4>
              <div className="min-h-[200px] space-y-2 rounded-lg border bg-muted/20 p-2">
                {filteredTasks
                  .filter((task) => task.status === status)
                  .map((task) => (
                    <Card
                      key={task.id}
                      className="cursor-pointer p-3 hover:shadow-md"
                      onClick={() => {
                        openTaskDetail(task);
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <p className="line-clamp-2 flex-1 text-sm font-medium">
                          {task.title}
                        </p>
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">
                          {task.id}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {task.priority}
                        </span>
                      </div>
                    </Card>
                  ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 按故事分组视图 */}
      {view === 'board' && (
        <div className="space-y-4">
          {project.user_activities
            ?.filter((activity) =>
              activity.stories?.some((s) => s.dev_tasks && s.dev_tasks.length > 0)
            )
            .map((activity) => (
              <Card key={activity.id}>
                <CardHeader>
                  <CardTitle className="text-base">{activity.name}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {activity.stories
                    ?.filter((story) => story.dev_tasks && story.dev_tasks.length > 0)
                    .map((story) => (
                      <div key={story.id} className="space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs text-muted-foreground">
                            {story.id}
                          </span>
                          <span className="text-sm font-medium">
                            {story.title}
                          </span>
                        </div>
                        <TaskList
                          tasks={story.dev_tasks || []}
                          onStatusChange={handleStatusChange}
                          onTaskClick={openTaskDetail}
                          showStatusFilter={false}
                          editableStatus={true}
                        />
                      </div>
                    ))}
                </CardContent>
              </Card>
            ))}
        </div>
      )}

      {/* 依赖图视图（DAG）：以选中任务为中心 N 跳邻域。
          未选中任务时给出引导——全量渲染 190+ 节点会缩成一团不可读。 */}
      {view === 'dependencies' && (
        <Card>
          <CardContent className="pt-6">
            {detailTask ? (
              <TaskDependencyGraph
                tasks={allTasks}
                focusTaskId={detailTask.id}
                filterStoryId={detailTask.story_id}
                className="h-[560px]"
              />
            ) : (
              <div className="flex h-[560px] items-center justify-center text-center">
                <div className="space-y-2">
                  <Network className="mx-auto h-8 w-8 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    请先点击一个任务打开详情，依赖图将以该任务为中心展示 1 跳邻域
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* 批量更新确认弹窗 */}
      <BulkUpdateConfirmDialog
        open={bulkDialogOpen}
        onOpenChange={setBulkDialogOpen}
        selectedCount={{ tasks: selectedTaskIds.length, stories: 0 }}
        currentStatus={
          selectedTaskIds.length > 0
            ? (filteredTasks.find((t) => t.id === selectedTaskIds[0])?.status ??
              'todo')
            : 'todo'
        }
        targetStatus={bulkTargetStatus ?? 'todo'}
        isTask={true}
        onConfirm={handleBulkConfirm}
        onCancel={() => setBulkDialogOpen(false)}
        reason={bulkReason}
        onReasonChange={setBulkReason}
      />

      {/* 新建任务对话框 */}
      <TaskCreateDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        project={project}
        onSave={handleCreateTask}
      />

      {/* 任务详情抽屉 */}
      <TaskDetailSheet
        task={detailTask}
        open={detailSheetOpen}
        onOpenChange={setDetailSheetOpen}
        allTasks={allTasks}
        storyContextMap={storyContextMap}
        onTaskNavigate={(navTask) => {
          setDetailTask(navTask);
        }}
        onUpdateDependencies={async (taskId, dependencies) => {
          await updateTask.mutateAsync({ id: taskId, dependencies });
          // 乐观更新本地产品状态
          setProject((prev) => ({
            ...prev,
            user_activities: prev.user_activities?.map((activity) => ({
              ...activity,
              stories: activity.stories?.map((story) => ({
                ...story,
                dev_tasks: story.dev_tasks?.map((task) =>
                  task.id === taskId
                    ? { ...task, dependencies }
                    : task
                ),
              })),
            })),
          }));
        }}
      />
    </div>
  );
}
