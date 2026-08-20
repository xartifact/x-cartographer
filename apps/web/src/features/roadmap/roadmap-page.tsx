'use client';

/**
 * Roadmap 排期页面
 *
 * 里程碑/版本模型：
 * - 版本管理：创建/编辑/归档版本（名称、目标、目标日期、状态）
 * - 泳道视图：按版本分组展示故事，待规划池置首列
 */

import { useMemo, useState } from 'react';
import { Plus, Calendar as CalendarIcon } from 'lucide-react';
import { Button, Card, CardContent, CardHeader, CardTitle } from '@x-cartographer/ui';
import { useProject } from '@/lib/api/hooks';
import {
  useMilestonesByProject,
  useCreateMilestone,
  useUpdateMilestone,
  useDeleteMilestone,
} from '@/lib/api/hooks';
import { MilestoneDialog } from './components/milestone-dialog';

interface RoadmapPageProps {
  projectId: string;
}

interface MilestoneJson {
  id: string;
  project_id: string;
  name: string;
  goal: string;
  target_date?: string;
  status: string;
  created_at: string;
  updated_at: string;
}

const STATUS_LABEL: Record<string, string> = {
  planned: '规划中',
  active: '进行中',
  completed: '已完成',
};

export function RoadmapPage({ projectId }: RoadmapPageProps) {
  const { data: project, isLoading: projectLoading } = useProject(projectId);
  const { data: milestones = [], isLoading: milestonesLoading } =
    useMilestonesByProject(projectId);
  const createMilestone = useCreateMilestone();
  const updateMilestone = useUpdateMilestone();
  const deleteMilestone = useDeleteMilestone();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<MilestoneJson | null>(null);

  // 待规划池：未排期的故事（milestone_id 为空）
  const unplannedStories = useMemo(() => {
    return (project?.user_journeys ?? []).flatMap((j) =>
      (j.stories ?? [])
        .filter((s) => !s.milestone_id)
        .map((s) => ({ ...s, journey_name: j.name }))
    );
  }, [project]);

  // 每个版本的故事（按 milestone_id 分组）
  const storiesByMilestone = useMemo(() => {
    const map = new Map<string, typeof unplannedStories>();
    for (const m of milestones) map.set(m.id, []);
    for (const j of project?.user_journeys ?? []) {
      for (const s of j.stories ?? []) {
        if (s.milestone_id && map.has(s.milestone_id)) {
          map.get(s.milestone_id)!.push({ ...s, journey_name: j.name });
        }
      }
    }
    return map;
  }, [project, milestones]);

  function estimateSum(stories: Array<{ estimation?: number }>) {
    return stories.reduce((sum, s) => sum + (s.estimation ?? 0), 0);
  }




  async function handleCreate(data: {
    name: string;
    goal: string;
    target_date?: string;
    status?: string;
  }) {
    await createMilestone.mutateAsync({
      project_id: projectId,
      name: data.name,
      goal: data.goal,
      target_date: data.target_date,
      status: data.status as 'planned' | 'active' | 'completed',
    });
  }

  async function handleUpdate(data: {
    name: string;
    goal: string;
    target_date?: string;
    status?: string;
  }) {
    if (!editing) return;
    await updateMilestone.mutateAsync({
      id: editing.id,
      projectId,
      name: data.name,
      goal: data.goal,
      target_date: data.target_date ?? null,
      status: data.status as 'planned' | 'active' | 'completed',
    });
  }

  async function handleDelete(m: MilestoneJson) {
    if (!window.confirm(`确定删除版本 "${m.name}" 吗？该版本下的故事将回到待规划池。`)) {
      return;
    }
    await deleteMilestone.mutateAsync({ id: m.id, projectId });
  }

  if (projectLoading || milestonesLoading) {
    return (
      <div className="flex h-full items-center justify-center rounded-xl border bg-muted/30 text-muted-foreground">
        加载中…
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <CalendarIcon className="h-5 w-5" />
            排期规划
          </h2>
          <p className="text-sm text-muted-foreground">
            按版本组织交付计划，未排期故事进入待规划池
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => { setEditing(null); setDialogOpen(true); }}>
            <Plus className="mr-2 h-4 w-4" />
            新建版本
          </Button>
        </div>
      </div>


      {/* 泳道视图：待规划池置首，后接各版本 */}
      <div className="flex gap-4 overflow-x-auto pb-4">
        {/* 待规划池 */}
        <Card className="min-w-[280px] shrink-0">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">待规划池</CardTitle>
            <div className="text-xs text-muted-foreground">
              {unplannedStories.length} 故事 · {estimateSum(unplannedStories)}h
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {unplannedStories.length === 0 ? (
              <p className="text-sm text-muted-foreground">无未排期故事</p>
            ) : (
              unplannedStories.map((s) => (
                <div
                  key={s.id}
                  className="rounded-md border p-2 text-sm"
                >
                  <div className="line-clamp-2 font-medium">{s.title}</div>
                  <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{s.id}</span>
                    <span>{s.journey_name}</span>
                    <span>{s.estimation ?? 0}h</span>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* 各版本泳道 */}
        {milestones.map((m: MilestoneJson) => {
          const stories = storiesByMilestone.get(m.id) ?? [];
          return (
            <Card key={m.id} className="min-w-[280px] shrink-0">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-sm font-medium">{m.name}</CardTitle>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {m.goal || '未填写目标'}
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-xs">
                      <span className="rounded bg-muted px-1.5 py-0.5">
                        {STATUS_LABEL[m.status] ?? m.status}
                      </span>
                      {m.target_date && (
                        <span>{m.target_date.slice(0, 10)}</span>
                      )}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {stories.length} 故事 · {estimateSum(stories)}h
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => { setEditing(m); setDialogOpen(true); }}
                    >
                      编辑
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive"
                      onClick={() => handleDelete(m)}
                    >
                      删除
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {stories.length === 0 ? (
                  <p className="text-sm text-muted-foreground">暂无故事</p>
                ) : (
                  stories.map((s) => (
                    <div key={s.id} className="rounded-md border p-2 text-sm">
                      <div className="line-clamp-2 font-medium">{s.title}</div>
                      <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{s.id}</span>
                        <span>{s.journey_name}</span>
                        <span>{s.estimation ?? 0}h</span>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          );
        })}

        {milestones.length === 0 && (
          <Card className="min-w-[280px] shrink-0 border-dashed">
            <CardContent className="flex h-40 items-center justify-center text-sm text-muted-foreground">
              点击"新建版本"创建第一个版本
            </CardContent>
          </Card>
        )}
      </div>

      <MilestoneDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        initial={editing}
        onSave={editing ? handleUpdate : handleCreate}
      />
    </div>
  );
}
