/**
 * 任务管理页面
 *
 * 任务列表视图，支持状态筛选和管理
 */

'use client';

import * as React from 'react';
import { Plus, Filter, Download, Upload, Database, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useProjectStore } from '@/features/projects/stores';
import { TaskList, StatusFilterBar, TaskListEmpty, StatusBadge } from '@/features/tasks/components';
import { TaskImportDialog } from './task-import-dialog';
import { TaskCreateDialog } from './task-create-dialog';
import type { Task, TaskStatus, StoryStatus, Project } from '@/types';
import type { UpdateProjectDTO } from '@/types';
import type { AppTask } from '@/lib/toml/task-parser';

interface TasksPageProps {
  /** 当前项目 */
  project: Project;
}

export function TasksPage({ project: initialProject }: TasksPageProps) {
  const { modifyProject } = useProjectStore();
  const [searchQuery, setSearchQuery] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<(TaskStatus | StoryStatus)[]>([]);
  const [selectedTaskIds, setSelectedTaskIds] = React.useState<string[]>([]);
  const [project, setProject] = React.useState(initialProject);
  const [importDialogOpen, setImportDialogOpen] = React.useState(false);
  const [createDialogOpen, setCreateDialogOpen] = React.useState(false);
  const [importedTasks, setImportedTasks] = React.useState<AppTask[]>([]);
  const [importMeta, setImportMeta] = React.useState<{ projectName: string; createdAt: string } | null>(null);

  // 同步项目数据
  React.useEffect(() => {
    setProject(initialProject);
  }, [initialProject]);

  // 收集所有任务
  const allTasks = React.useMemo(() => {
    const tasks: Task[] = [];
    project.user_journeys?.forEach((journey) => {
      journey.stories?.forEach((story) => {
        if (story.tasks) {
          tasks.push(...story.tasks);
        }
      });
    });
    return tasks;
  }, [project]);

  // 所有任务（包括导入的任务）
  const displayTasks = React.useMemo(() => {
    // 将导入的任务转换为统一格式
    const imported: Task[] = importedTasks.map((t) => ({
      id: t.id,
      title: t.title,
      description: t.description,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      type: t.type as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      priority: t.priority as any,
      estimation: t.estimation,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      status: t.status as any,
      dependencies: t.dependencies,
      story_id: '',
      tags: t.tags,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));
    return [...allTasks, ...imported];
  }, [allTasks, importedTasks]);

  // 故事/旅程上下文 map，用于任务卡片显示归属
  const storyContextMap = React.useMemo(() => {
    const map: Record<string, { storyTitle: string; journeyName: string }> = {};
    project.user_journeys?.forEach((journey) => {
      journey.stories?.forEach((story) => {
        map[story.id] = { storyTitle: story.title, journeyName: journey.name };
      });
    });
    return map;
  }, [project]);

  // 过滤任务
  const filteredTasks = React.useMemo(() => {
    let result = displayTasks;
    if (statusFilter.length > 0) {
      result = result.filter((task) => statusFilter.includes(task.status as TaskStatus | StoryStatus));
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
  }, [displayTasks, statusFilter, searchQuery]);

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
    displayTasks.forEach((task) => {
      if (stats[task.status] !== undefined) {
        stats[task.status]++;
      }
    });
    return stats;
  }, [displayTasks]);

  // 处理状态变更
  const handleStatusChange = async (taskId: string, newStatus: TaskStatus) => {
    // 更新项目数据中的任务状态
    const updatedJourneys = project.user_journeys?.map((journey) => ({
      ...journey,
      stories: journey.stories?.map((story) => ({
        ...story,
        tasks: story.tasks?.map((task) =>
          task.id === taskId ? { ...task, status: newStatus } : task
        ),
      })),
    }));

    if (updatedJourneys) {
      const dto: UpdateProjectDTO = { user_journeys: updatedJourneys };
      const updated = await modifyProject(project.id, dto);
      if (updated) {
        setProject(updated);
      }
    }
  };

  // 进度统计
  const completedCount = statusStats.done || 0;
  const totalCount = displayTasks.length;
  const progress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  // 处理新建任务（绑定到指定故事）
  const handleCreateTask = async (storyId: string, task: Task) => {
    const updatedJourneys = project.user_journeys?.map((journey) => ({
      ...journey,
      stories: journey.stories?.map((story) =>
        story.id === storyId
          ? { ...story, tasks: [...(story.tasks ?? []), task] }
          : story
      ),
    }));
    if (updatedJourneys) {
      const updated = await modifyProject(project.id, { user_journeys: updatedJourneys });
      if (updated) setProject(updated);
    }
  };

  // 处理导入
  const handleImport = (tasks: AppTask[], metadata: { project_name: string; created_at: string }) => {
    setImportedTasks(tasks);
    setImportMeta({ projectName: metadata.project_name, createdAt: metadata.created_at });
  };

  // 处理导入任务的状态变更
  const handleImportedTaskStatusChange = (taskId: string, newStatus: TaskStatus) => {
    setImportedTasks((prev) =>
      prev.map((task) => (task.id === taskId ? { ...task, status: newStatus } : task))
    );
  };

  return (
    <div className="space-y-6">
      {/* 顶部操作栏 */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Input
            placeholder="搜索任务..."
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
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setImportDialogOpen(true)}>
            <Upload className="h-4 w-4 mr-2" />
            导入
          </Button>
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            导出
          </Button>
          <Button size="sm" onClick={() => setCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            新建任务
          </Button>
        </div>
      </div>

      {/* 导入提示 */}
      {importMeta && (
        <div className="flex items-center gap-2 p-3 bg-blue-500/10 rounded-lg text-blue-600 text-sm">
          <FileText className="h-4 w-4" />
          <span>
            已导入 "{importMeta.projectName}" ({importMeta.createdAt}) 的 {importedTasks.length} 个任务
          </span>
        </div>
      )}

      {/* 统计信息 */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              总任务数
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              已完成
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{completedCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              进行中
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {statusStats.in_progress + statusStats.in_review + statusStats.testing}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              完成率
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{progress}%</div>
          </CardContent>
        </Card>
      </div>

      {/* 视图切换 */}
      <Tabs defaultValue="list" className="space-y-4">
        <TabsList>
          <TabsTrigger value="list">列表视图</TabsTrigger>
          <TabsTrigger value="kanban">Kanban 视图</TabsTrigger>
          <TabsTrigger value="grouped">按故事分组</TabsTrigger>
        </TabsList>

        <TabsContent value="list">
          {allTasks.length > 0 ? (
            <TaskList
              tasks={filteredTasks}
              onStatusChange={handleStatusChange}
              onSelectionChange={setSelectedTaskIds}
              selectedIds={selectedTaskIds}
              showStatusFilter={false}
              editableStatus={true}
              storyContextMap={storyContextMap}
            />
          ) : (
            <TaskListEmpty message="暂无任务，请先创建用户故事并拆解任务" />
          )}
        </TabsContent>

        <TabsContent value="kanban">
          <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
            {['backlog', 'todo', 'in_progress', 'in_review', 'testing', 'done'].map((status) => (
              <div key={status} className="space-y-2">
                <h4 className="text-sm font-medium capitalize">
                  {status === 'in_progress' ? '进行中' : status === 'in_review' ? '待评审' : status === 'testing' ? '测试中' : status}
                  <span className="ml-2 text-muted-foreground">({statusStats[status] || 0})</span>
                </h4>
                <div className="space-y-2 min-h-[200px] p-2 border rounded-lg bg-muted/20">
                  {allTasks
                    .filter((task) => task.status === status)
                    .map((task) => (
                      <Card key={task.id} className="p-3 cursor-pointer hover:shadow-md">
                        <p className="text-sm font-medium line-clamp-2">{task.title}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <span className="text-xs text-muted-foreground">{task.id}</span>
                          <span className="text-xs text-muted-foreground">{task.priority}</span>
                        </div>
                      </Card>
                    ))}
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="grouped">
          <div className="space-y-4">
            {project.user_journeys
              ?.filter((journey) => journey.stories?.some((s) => s.tasks && s.tasks.length > 0))
              .map((journey) => (
                <Card key={journey.id}>
                  <CardHeader>
                    <CardTitle className="text-base">{journey.name}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {journey.stories
                      ?.filter((story) => story.tasks && story.tasks.length > 0)
                      .map((story) => (
                        <div key={story.id} className="space-y-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono text-muted-foreground">
                              {story.id}
                            </span>
                            <span className="text-sm font-medium">{story.title}</span>
                          </div>
                          <TaskList
                            tasks={story.tasks || []}
                            onStatusChange={handleStatusChange}
                            showStatusFilter={false}
                            editableStatus={true}
                          />
                        </div>
                      ))}
                  </CardContent>
                </Card>
              ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* 任务 TOML 导入对话框 */}
      <TaskImportDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        onImport={handleImport}
      />

      {/* 新建任务对话框 */}
      <TaskCreateDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        project={project}
        onSave={handleCreateTask}
      />
    </div>
  );
}