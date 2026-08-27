'use client';

/**
 * 故事管理页面
 *
 * 与任务管理同范式：顶部操作栏（搜索 + 状态/优先级筛选 + 新建）、故事列表、
 * 点击打开 StoryDetailPanel 详情抽屉（含任务拆解 Tab），可编辑/删除。
 * - 数据源：project.user_journeys[].stories[]（深树）。
 */

import { useEffect, useMemo, useState } from 'react';
import { Plus, Search } from 'lucide-react';

import { Button, Input, Card, CardContent, CardHeader, CardTitle, Sheet, SheetContent } from '@x-cartographer/ui';
import {
  StoryCreateDialog,
  StoryDetailPanel,
  StoryEditDialog,
} from '@/features/story-map/components';
import { StatusBadge } from '@/features/tasks/components/status-badge';
import { STORY_PRIORITY_CLS, STORY_STATUS_LABEL } from '@/features/workbench/components/card-meta';
import { useCreateStory, useUpdateStory, useDeleteStory, useUpdateStoryStatus } from '@/lib/api/hooks';
import { Priority } from '@/types';
import type { Project, StoryStatus, UserStory } from '@/types';

interface StoriesPageProps {
  /** 当前项目 */
  project: Project;
}

/** 带旅程名的故事 */
type EnrichedStory = UserStory & { journey_name: string };

const PRIORITY_FILTERS: Priority[] = [Priority.HIGH, Priority.MEDIUM, Priority.LOW];

export function StoriesPage({ project: initialProject }: StoriesPageProps) {
  const createStory = useCreateStory();
  const updateStory = useUpdateStory();
  const deleteStory = useDeleteStory();
  const updateStoryStatus = useUpdateStoryStatus();

  const [project, setProject] = useState(initialProject);
  const [searchQuery, setSearchQuery] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<Priority | null>(null);
  const [statusFilter, setStatusFilter] = useState<StoryStatus | null>(null);

  // 新建故事的目标旅程
  const [targetJourneyId, setTargetJourneyId] = useState<string>('');
  const [createOpen, setCreateOpen] = useState(false);
  // 编辑
  const [editing, setEditing] = useState<UserStory | null>(null);
  // 详情抽屉
  const [detail, setDetail] = useState<{ story: UserStory; journeyName: string } | null>(null);

  useEffect(() => {
    setProject(initialProject);
  }, [initialProject]);

  // 旅程列表
  const journeys = useMemo(() => project.user_journeys ?? [], [project]);

  // 带旅程名的故事（排除已取消）
  const allStories = useMemo<EnrichedStory[]>(() => {
    return journeys.flatMap((j) =>
      (j.stories ?? [])
        .filter((s) => s.status !== 'cancelled')
        .map((s) => ({ ...s, journey_name: j.name })) as EnrichedStory[]
    );
  }, [journeys]);

  // 目标旅程默认第一个
  useEffect(() => {
    if (!targetJourneyId && journeys.length > 0) {
      setTargetJourneyId(journeys[0].id);
    }
  }, [journeys, targetJourneyId]);

  const filteredStories = useMemo(() => {
    let list = allStories;
    if (priorityFilter) list = list.filter((s) => s.priority === priorityFilter);
    if (statusFilter) list = list.filter((s) => s.status === statusFilter);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (s) => s.title.toLowerCase().includes(q) || s.id.toLowerCase().includes(q)
      );
    }
    return list;
  }, [allStories, priorityFilter, statusFilter, searchQuery]);

  const targetJourney = journeys.find((j) => j.id === targetJourneyId);

  function togglePriority(p: Priority) {
    setPriorityFilter((prev) => (prev === p ? null : p));
  }


  async function handleCreate(data: {
    journeyId: string;
    title: string;
    description: string;
    priority: Priority;
    estimation: number;
    acceptance_criteria: string[];
    tags: string[];
  }) {
    await createStory.mutateAsync(data);
    setCreateOpen(false);
  }

  async function handleUpdate(updated: UserStory) {
    await updateStory.mutateAsync({
      id: updated.id,
      title: updated.title,
      description: updated.description,
      priority: updated.priority,
      estimation: updated.estimation,
      acceptanceCriteria: updated.acceptance_criteria,
      tags: updated.tags,
      milestoneId: updated.milestone_id ?? null,
    });
    setEditing(null);
    setDetail((prev) => (prev ? { ...prev, story: updated } : prev));
  }

  async function handleDelete(s: UserStory) {
    if (!window.confirm(`确定删除故事「${s.title}」吗？该故事下的任务将一并删除。`)) {
      return;
    }
    await deleteStory.mutateAsync({ id: s.id });
    setDetail(null);
  }

  async function cycleStatus(s: EnrichedStory) {
    const order: StoryStatus[] = ['backlog', 'todo', 'in_progress', 'done'];
    const idx = order.indexOf(s.status ?? 'backlog');
    const next = order[(idx + 1) % order.length];
    await updateStoryStatus.mutateAsync({ id: s.id, status: next });
    setDetail((prev) =>
      prev && prev.story.id === s.id ? { ...prev, story: { ...prev.story, status: next } } : prev
    );
  }

  return (
    <div className="space-y-6">
      {/* 顶部操作栏 */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="搜索故事..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-56 pl-9"
            />
          </div>
          {/* 优先级筛选 */}
          <div className="flex items-center gap-1">
            {PRIORITY_FILTERS.map((p) => (
              <Button
                key={p}
                variant={priorityFilter === p ? 'default' : 'outline'}
                size="sm"
                onClick={() => togglePriority(p)}
              >
                {p === 'high' ? '高' : p === 'medium' ? '中' : '低'}
              </Button>
            ))}
          </div>
          {/* 状态筛选 */}
          <select
            value={statusFilter ?? ''}
            onChange={(e) => setStatusFilter((e.target.value as StoryStatus) || null)}
            className="h-9 rounded-md border bg-background px-2 text-sm"
          >
            <option value="">所有状态</option>
            {(['backlog', 'todo', 'in_progress', 'done'] as StoryStatus[]).map((s) => (
              <option key={s} value={s}>
                {STORY_STATUS_LABEL[s]}
              </option>
            ))}
          </select>
          <span className="text-sm text-muted-foreground">{filteredStories.length} 故事</span>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={targetJourneyId}
            onChange={(e) => setTargetJourneyId(e.target.value)}
            className="h-9 rounded-md border bg-background px-2 text-sm"
          >
            {journeys.map((j) => (
              <option key={j.id} value={j.id}>
                {j.name}
              </option>
            ))}
          </select>
          <Button size="sm" onClick={() => setCreateOpen(true)} disabled={!targetJourney}>
            <Plus className="mr-2 h-4 w-4" />
            新建故事
          </Button>
        </div>
      </div>

      {/* 故事列表 */}
      {filteredStories.length === 0 ? (
        <Card>
          <CardContent className="flex h-40 items-center justify-center text-sm text-muted-foreground">
            暂无故事，点击「新建故事」创建第一个
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              故事列表
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {filteredStories.map((s) => (
              <div
                key={s.id}
                role="button"
                tabIndex={0}
                onClick={() => setDetail({ story: s, journeyName: s.journey_name })}
                onKeyDown={(e) => { if (e.key === 'Enter') setDetail({ story: s, journeyName: s.journey_name }); }}
                className="flex cursor-pointer items-center gap-3 rounded-md border p-3 transition-colors hover:bg-accent/40"
              >
                <span className="font-mono text-xs text-muted-foreground">{s.id}</span>
                <span className={`shrink-0 text-xs font-semibold ${STORY_PRIORITY_CLS[s.priority] ?? ''}`}>
                  {s.priority === 'high' ? '高' : s.priority === 'medium' ? '中' : '低'}
                </span>
                {s.status && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); cycleStatus(s); }}
                    className="shrink-0 cursor-pointer border-0 bg-transparent p-0 hover:opacity-80"
                    title="点击切换状态"
                  >
                    <StatusBadge status={s.status} isTask={false} outline className="shrink-0" />
                  </button>
                )}
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{s.title}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{s.journey_name}</span>
                {s.estimation > 0 && (
                  <span className="shrink-0 text-xs text-muted-foreground">{s.estimation}h</span>
                )}
                {(s.tasks?.length ?? 0) > 0 && (
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {s.tasks?.filter((t) => t.status === 'done').length}/{s.tasks?.length} 任务
                  </span>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* 新建故事对话框 */}
      <StoryCreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        journeyId={targetJourneyId}
        journeyName={targetJourney?.name ?? ''}
        onSave={handleCreate}
      />
      {/* 故事编辑对话框 */}
      <StoryEditDialog
        open={!!editing}
        story={editing}
        onOpenChange={(open) => { if (!open) setEditing(null); }}
        onSave={handleUpdate}
      />
      {/* 故事详情抽屉（Sheet，对齐任务管理交互） */}
      <Sheet
        open={!!detail}
        onOpenChange={(open) => { if (!open) setDetail(null); }}
      >
        <SheetContent className="p-4">
          {detail && (
            <StoryDetailPanel
              story={detail.story}
              journeyName={detail.journeyName}
              project={project}
              onClose={() => setDetail(null)}
              onEdit={(s) => setEditing(s)}
              onDelete={handleDelete}
              className="w-full h-full"
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
