'use client';

/**
 * 并行工作台：跨项目查看活跃需求与活跃任务
 *
 * 数据源：GET /api/projects（完整树）→ 客户端聚合（见 active-workbench.ts）。
 * 交互：双栏（需求 | 任务）+ 统计条 + 待办池开关 + 标题搜索。
 */

import { useMemo, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { ListTodo, FileText, Search, Layers } from 'lucide-react';
import { Button, Input } from '@x-cartographer/ui';
import { useProjects } from '@/lib/api/hooks';
import type { Project } from '@x-cartographer/shared';
import {
  flattenProjects,
  filterByQuery,
  groupByProject,
  type ActiveStory,
  type ActiveTask,
} from './active-workbench';
import { StatsBar } from './components/stats-bar';
import { StoryCard } from './components/story-card';
import { TaskCard } from './components/task-card';

export function WorkbenchPage() {
  const { data: projects, isLoading } = useProjects();
  const [showBacklog, setShowBacklog] = useState(false);
  const [query, setQuery] = useState('');

  const data = useMemo(() => flattenProjects(projects as Project[] | undefined), [projects]);

  const storyItems = showBacklog
    ? [...data.activeStories, ...data.backlogStories]
    : data.activeStories;
  const taskItems = showBacklog
    ? [...data.activeTasks, ...data.backlogTasks]
    : data.activeTasks;

  const stories = useMemo(() => filterByQuery(storyItems, query), [storyItems, query]);
  const tasks = useMemo(() => filterByQuery(taskItems, query), [taskItems, query]);
  const storyGroups = useMemo(() => groupByProject(stories), [stories]);
  const taskGroups = useMemo(() => groupByProject(tasks), [tasks]);

  function openStory(s: ActiveStory) {
    // 深链到该项目的故事地图（按需求定位）
    window.location.href = `/projects/${s.project_id}/story-map`;
  }
  function openTask(t: ActiveTask) {
    window.location.href = `/projects/${t.project_id}/tasks`;
  }

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center rounded-xl border bg-muted/30 text-muted-foreground">
        加载中…
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4">
      {/* 标题 + 统计 + 控件 */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Layers className="h-5 w-5" />
            并行工作台
          </h2>
          <p className="text-sm text-muted-foreground">
            跨项目查看进行中的需求与任务，点击卡片进入对应项目
          </p>
        </div>
        <StatsBar
          projectCount={data.projectCount}
          activeStoryCount={data.activeStories.length}
          activeTaskCount={data.activeTasks.length}
        />
      </div>

      {/* 筛选 */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索标题…"
            className="h-9 w-64 pl-8"
          />
        </div>
        <Button
          variant={showBacklog ? 'default' : 'outline'}
          size="sm"
          onClick={() => setShowBacklog((v) => !v)}
        >
          {showBacklog ? '隐藏待办池' : '显示待办池'}
        </Button>
        <span className="text-xs text-muted-foreground">
          {stories.length} 条需求 · {tasks.length} 条任务
        </span>
      </div>

      {/* 双栏：活跃需求 | 活跃任务 */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* 活跃需求 */}
        <section className="rounded-xl border bg-muted/10 p-3">
          <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
            <FileText className="h-4 w-4" />
            活跃需求
            <span className="text-xs font-normal text-muted-foreground">
              {stories.length} 条
            </span>
          </h3>
          {storyGroups.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              暂无活跃需求
            </p>
          ) : (
            <div className="space-y-3">
              {storyGroups.map((g) => (
                <div key={g.project_id}>
                  <Link
                    to="/projects/$projectId"
                    params={{ projectId: g.project_id }}
                    className="mb-1.5 inline-block text-xs font-medium text-muted-foreground hover:text-foreground"
                  >
                    {g.project_name} · {g.items.length}
                  </Link>
                  <div className="space-y-1.5">
                    {g.items.map((s) => (
                      <StoryCard key={s.id} story={s} onOpen={openStory} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* 活跃任务 */}
        <section className="rounded-xl border bg-muted/10 p-3">
          <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
            <ListTodo className="h-4 w-4" />
            活跃任务
            <span className="text-xs font-normal text-muted-foreground">
              {tasks.length} 条
            </span>
          </h3>
          {taskGroups.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              暂无活跃任务
            </p>
          ) : (
            <div className="space-y-3">
              {taskGroups.map((g) => (
                <div key={g.project_id}>
                  <Link
                    to="/projects/$projectId"
                    params={{ projectId: g.project_id }}
                    className="mb-1.5 inline-block text-xs font-medium text-muted-foreground hover:text-foreground"
                  >
                    {g.project_name} · {g.items.length}
                  </Link>
                  <div className="space-y-1.5">
                    {g.items.map((t) => (
                      <TaskCard key={t.id} task={t} onOpen={openTask} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
