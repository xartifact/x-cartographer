"use client";
import { EntityStatusControl } from "@/components/common/entity-status-control";
import { useUrlState } from "@/lib/hooks/use-url-state";

/**
 * 故事管理页面
 *
 * 与任务管理同范式：顶部操作栏（搜索 + 状态/优先级筛选 + 新建）、故事列表、
 * 点击打开 StoryDetailPanel 详情抽屉（含任务拆解 Tab），可编辑/删除。
 * - 数据源：project.user_journeys[].stories[]（深树）。
 */

import { useEffect, useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";

import {
  Button,
  Input,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Sheet,
  SheetContent,
} from "@x-cartographer/ui";
import {
  StoryCreateDialog,
  StoryDetailPanel,
  StoryEditDialog,
} from "@/features/story-map/components";
import { STORY_PRIORITY_CLS, STORY_STATUS_LABEL } from "@/features/workbench/components/card-meta";
import { useCreateStory, useUpdateStory, useDeleteStory } from "@/lib/api/hooks";
import { Priority } from "@/types";
import type { Product, StoryStatus, UserStory } from "@/types";

interface StoriesPageProps {
  /** 当前产品 */
  project: Product;
}

/** 带用户活动名的故事 */
type EnrichedStory = UserStory & { activity_name: string };

const PRIORITY_FILTERS: Priority[] = [Priority.HIGH, Priority.MEDIUM, Priority.LOW];

export function StoriesPage({ project: initialProject }: StoriesPageProps) {
  const createStory = useCreateStory();
  const updateStory = useUpdateStory();
  const deleteStory = useDeleteStory();

  const [project, setProject] = useState(initialProject);
  const [searchQuery, setSearchQuery] = useUrlState("q");
  const [priorityValue, setPriorityValue] = useUrlState("priority");
  const priorityFilter = (
    ["high", "medium", "low"].includes(priorityValue) ? priorityValue : null
  ) as Priority | null;
  const setPriorityFilter = (value: Priority | null) => setPriorityValue(value);
  const [statusValue, setStatusValue] = useUrlState("status");
  const statusFilter = (
    ["backlog", "todo", "in_progress", "accepted", "cancelled"].includes(statusValue)
      ? statusValue
      : null
  ) as StoryStatus | null;
  const setStatusFilter = (value: StoryStatus | null) => setStatusValue(value);

  // 新建故事的目标活动
  const [targetJourneyId, setTargetJourneyId] = useState<string>("");
  const [createOpen, setCreateOpen] = useState(false);
  // 编辑
  const [editing, setEditing] = useState<UserStory | null>(null);
  // 详情抽屉
  const [detailId, setDetailId] = useUrlState("storyId");
  const detailStory = (project.user_activities ?? [])
    .flatMap((a) => (a.stories ?? []).map((story) => ({ story, activityName: a.name })))
    .find((d) => d.story.id === detailId);
  const detail = detailStory ?? null;
  const setDetail = (value: { story: UserStory; activityName: string } | null) =>
    setDetailId(value?.story.id ?? null);

  useEffect(() => {
    setProject(initialProject);
  }, [initialProject]);

  // 用户活动列表
  const activities = useMemo(() => project.user_activities ?? [], [project]);

  // 带用户活动名的故事（排除已取消）
  const allStories = useMemo<EnrichedStory[]>(() => {
    return activities.flatMap(
      (j) =>
        ((j as { stories?: UserStory[] }).stories ?? [])
          .filter((s) => s.status !== "cancelled")
          .map((s) => ({ ...s, activity_name: j.name })) as EnrichedStory[],
    );
  }, [activities]);

  // 目标活动默认第一个
  useEffect(() => {
    if (!targetJourneyId && activities.length > 0) {
      setTargetJourneyId(activities[0].id);
    }
  }, [activities, targetJourneyId]);

  const filteredStories = useMemo(() => {
    let list = allStories;
    if (priorityFilter) list = list.filter((s) => s.priority === priorityFilter);
    if (statusFilter) list = list.filter((s) => s.status === statusFilter);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (s) => s.title.toLowerCase().includes(q) || s.id.toLowerCase().includes(q),
      );
    }
    return list;
  }, [allStories, priorityFilter, statusFilter, searchQuery]);

  const targetJourney = activities.find((j) => j.id === targetJourneyId);

  function togglePriority(p: Priority) {
    setPriorityFilter(priorityFilter === p ? null : p);
  }

  async function handleCreate(data: {
    activityId: string;
    title: string;
    description: string;
    priority: Priority;
    estimation: number;
    acceptance_criteria: string[];
    tags: string[];
  }) {
    const { acceptance_criteria, ...fields } = data;
    await createStory.mutateAsync({ ...fields, acceptanceCriteria: acceptance_criteria });
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
      affectedModules: updated.affected_modules,
      activityId: updated.activity_id,
      userTaskId: updated.user_task_id ?? null,
      milestoneId: updated.milestone_id ?? null,
    });
    setEditing(null);
  }

  async function handleDelete(s: UserStory) {
    if (!window.confirm(`确定删除故事「${s.title}」吗？该故事下的任务将一并删除。`)) {
      return;
    }
    await deleteStory.mutateAsync({ id: s.id });
    setDetail(null);
  }

  return (
    <div className="space-y-6">
      {/* 顶部操作栏 */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="搜索故事..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full sm:w-56 pl-9"
            />
          </div>
          {/* 优先级筛选 */}
          <div className="flex items-center gap-1">
            {PRIORITY_FILTERS.map((p) => (
              <Button
                key={p}
                variant={priorityFilter === p ? "default" : "outline"}
                size="sm"
                onClick={() => togglePriority(p)}
              >
                {p === "high" ? "高" : p === "medium" ? "中" : "低"}
              </Button>
            ))}
          </div>
          {/* 状态筛选 */}
          <select
            value={statusFilter ?? ""}
            onChange={(e) => setStatusFilter((e.target.value as StoryStatus) || null)}
            className="h-9 rounded-md border bg-background px-2 text-sm"
          >
            <option value="">所有状态</option>
            {(["backlog", "todo", "in_progress", "accepted"] as StoryStatus[]).map((s) => (
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
            {activities.map((j) => (
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
            <CardTitle className="text-sm font-medium text-muted-foreground">故事列表</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {filteredStories.map((s) => (
              <div
                key={s.id}
                role="button"
                tabIndex={0}
                onClick={() => setDetail({ story: s, activityName: s.activity_name })}
                onKeyDown={(e) => {
                  if (e.key === "Enter") setDetail({ story: s, activityName: s.activity_name });
                }}
                className="flex cursor-pointer items-center gap-3 rounded-md border p-3 transition-colors hover:bg-accent/40"
              >
                <span className="font-mono text-xs text-muted-foreground">{s.id}</span>
                <span
                  className={`shrink-0 text-xs font-semibold ${STORY_PRIORITY_CLS[s.priority] ?? ""}`}
                >
                  {s.priority === "high" ? "高" : s.priority === "medium" ? "中" : "低"}
                </span>
                {s.status && <EntityStatusControl id={s.id} status={s.status} isTask={false} />}
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{s.title}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{s.activity_name}</span>
                {s.estimation > 0 && (
                  <span className="shrink-0 text-xs text-muted-foreground">{s.estimation}h</span>
                )}
                {(s.dev_tasks?.length ?? 0) > 0 && (
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {s.dev_tasks?.filter((t) => t.status === "done").length}/{s.dev_tasks?.length}{" "}
                    研发任务
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
        activityId={targetJourneyId}
        activities={activities.map((j) => ({ id: j.id, name: j.name }))}
        activityName={targetJourney?.name ?? ""}
        onSave={handleCreate}
      />
      {/* 故事编辑对话框 */}
      <StoryEditDialog
        open={!!editing}
        story={editing}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
        onSave={handleUpdate}
      />
      {/* 故事详情抽屉（Sheet，对齐任务管理交互） */}
      <Sheet
        open={!!detail}
        onOpenChange={(open) => {
          if (!open) setDetail(null);
        }}
      >
        <SheetContent className="p-4">
          {detail && (
            <StoryDetailPanel
              story={detail.story}
              activityName={detail.activityName}
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
