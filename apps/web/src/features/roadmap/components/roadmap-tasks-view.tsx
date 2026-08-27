'use client';

/**
 * 研发任务排期视图
 *
 * 基于「故事 → 版本」关系聚合展示研发任务：任务本身不直接挂版本，
 * 按所属故事所在的里程碑分组。未排期故事的任务进入待规划池。
 *
 * 数据源：useProject 的深树（user_journeys[].stories[].tasks[] + story.milestone_id）。
 */

import { useMemo } from 'react';
import { Calendar as CalendarIcon, Clock, GitBranch } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@x-cartographer/ui';
import { cn } from '@/lib/utils';
import { StatusBadge } from '@/features/tasks/components/status-badge';
import { TASK_PRIORITY_CLS } from '@/features/workbench/components/card-meta';
import type { Project, Milestone } from '@/types';

/** 带旅程名的故事（用于任务聚合） */
type EnrichedStory = {
  id: string;
  title: string;
  milestone_id?: string;
  estimation?: number;
  journey_name: string;
  tasks: Array<{
    id: string;
    title: string;
    status: string;
    priority: string;
    estimation: number;
    dependencies: string[];
  }>;
};

interface RoadmapTasksViewProps {
  project: Project;
  milestones: Milestone[];
}

export function RoadmapTasksView({ project, milestones }: RoadmapTasksViewProps) {
  // 扁平化带旅程名+任务的未排期/已排期故事（排除已取消故事）
  const stories = useMemo<EnrichedStory[]>(() => {
    return (project.user_journeys ?? []).flatMap((j) =>
      (j.stories ?? [])
        .filter((s) => s.status !== 'cancelled')
        .map(
          (s) =>
            ({
              id: s.id,
              title: s.title,
              milestone_id: s.milestone_id,
              estimation: s.estimation,
              journey_name: j.name,
              tasks: s.tasks ?? [],
            }) as EnrichedStory
        )
    );
  }, [project]);

  const unplannedStories = useMemo(
    () => stories.filter((s) => !s.milestone_id),
    [stories]
  );

  const storiesByMilestone = useMemo(() => {
    const map = new Map<string, EnrichedStory[]>();
    for (const m of milestones) map.set(m.id, []);
    for (const s of stories) {
      if (s.milestone_id && map.has(s.milestone_id)) map.get(s.milestone_id)!.push(s);
    }
    return map;
  }, [stories, milestones]);

  function taskStats(storyList: EnrichedStory[]) {
    const tasks = storyList.flatMap((s) => s.tasks);
    const done = tasks.filter((t) => t.status === 'done').length;
    const est = tasks.reduce((sum, t) => sum + (t.estimation ?? 0), 0);
    return { total: tasks.length, done, est, pct: tasks.length > 0 ? Math.round((done / tasks.length) * 100) : 0 };
  }

  function renderColumn(header: string, storyList: EnrichedStory[], emptyText: string) {
    const { total, done, est, pct } = taskStats(storyList);
    return (
      <Card className="w-80 shrink-0">
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-sm font-medium">{header}</CardTitle>
          <div className="text-xs text-muted-foreground">
            {total} 任务 · {est}h · {done}/{total} 完成
          </div>
          {total > 0 && (
            <div className="h-1 overflow-hidden rounded-full bg-muted">
              <div
                className={cn('h-full rounded-full', pct === 100 ? 'bg-green-500' : 'bg-primary')}
                style={{ width: `${pct}%` }}
              />
            </div>
          )}
        </CardHeader>
        <CardContent className="space-y-3">
          {storyList.length === 0 ? (
            <p className="text-sm text-muted-foreground">{emptyText}</p>
          ) : (
            storyList.map((s) => (
              <div key={s.id} className="space-y-1.5">
                {/* 故事头 */}
                <div className="flex items-center gap-1.5 border-b pb-1 text-xs text-muted-foreground">
                  <span className="font-mono">{s.id}</span>
                  <span className="truncate font-medium text-foreground">{s.title}</span>
                  {s.estimation ? <span>{s.estimation}h</span> : null}
                </div>
                {/* 任务行 */}
                {s.tasks.length === 0 ? (
                  <p className="pl-1 text-xs italic text-muted-foreground">无任务</p>
                ) : (
                  <div className="space-y-1">
                    {s.tasks.map((t) => (
                      <div
                        key={t.id}
                        className="flex items-center gap-2 rounded-md border px-2 py-1.5 text-xs"
                      >
                        <StatusBadge
                          status={t.status as never}
                          isTask={true}
                          showLabel={false}
                          className="shrink-0"
                        />
                        <span
                          className={cn(
                            'shrink-0 font-semibold',
                            TASK_PRIORITY_CLS[t.priority as keyof typeof TASK_PRIORITY_CLS] ??
                              ''
                          )}
                        >
                          {t.priority}
                        </span>
                        <span className="min-w-0 flex-1 truncate" title={t.title}>
                          {t.title}
                        </span>
                        <span className="flex shrink-0 items-center gap-0.5 text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {t.estimation}h
                        </span>
                        {t.dependencies && t.dependencies.length > 0 && (
                          <span className="flex shrink-0 items-center gap-0.5 text-muted-foreground">
                            <GitBranch className="h-3 w-3" />
                            {t.dependencies.length}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="flex items-center gap-2 text-base font-semibold">
          <CalendarIcon className="h-4 w-4" />
          研发任务
        </h3>
        <p className="text-sm text-muted-foreground">
          按所属故事所在的版本聚合研发任务，跟踪版本级交付进度
        </p>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4">
        {renderColumn('待规划池', unplannedStories, '无未排期故事的任务')}
        {milestones.map((m) =>
          renderColumn(m.name, storiesByMilestone.get(m.id) ?? [], '暂无任务')
        )}
      </div>
    </div>
  );
}