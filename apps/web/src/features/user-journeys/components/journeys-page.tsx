'use client';

import { useEffect, useMemo, useState } from 'react';
import { Plus, Search, Users, LayoutList, Trash2, ArrowUp, ArrowDown } from 'lucide-react';
import { Button, Input, Card, CardContent } from '@x-cartographer/ui';
import {
  JourneyCreateDialog,
} from '@/features/story-map/components';
import {
  JourneyEditDialog,
} from '@/features/story-map/components';
import { useCreateJourney, useUpdateJourney, useDeleteJourney } from '@/lib/api/hooks';
import type { Project, UserJourney } from '@/types';

interface JourneysPageProps {
  /** 当前项目 */
  project: Project;
}

/** 优先级标签 */
const PRIORITY_LABEL: Record<string, { label: string; cls: string }> = {
  high: { label: '高', cls: 'text-red-600' },
  medium: { label: '中', cls: 'text-amber-600' },
  low: { label: '低', cls: 'text-gray-500' },
};

export function JourneysPage({ project: initialProject }: JourneysPageProps) {
  const createJourney = useCreateJourney();
  const updateJourney = useUpdateJourney();
  const deleteJourney = useDeleteJourney();

  const [project, setProject] = useState(initialProject);
  const [searchQuery, setSearchQuery] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<UserJourney | null>(null);

  // 同步项目数据
  useEffect(() => {
    setProject(initialProject);
  }, [initialProject]);

  const journeys = useMemo(() => {
    const list = [...(project.user_journeys ?? [])].sort((a, b) => a.order - b.order);
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase();
    return list.filter(
      (j) =>
        j.name.toLowerCase().includes(q) ||
        j.description.toLowerCase().includes(q) ||
        j.persona.toLowerCase().includes(q)
    );
  }, [project, searchQuery]);

  const totalStories = useMemo(
    () => (project.user_journeys ?? []).reduce((sum, j) => sum + (j.stories?.length ?? 0), 0),
    [project]
  );

  async function handleCreate(data: {
    name: string;
    description: string;
    persona: string;
    priority: 'high' | 'medium' | 'low';
  }) {
    await createJourney.mutateAsync({ projectId: project.id, ...data });
    setCreateOpen(false);
  }

  async function handleUpdate(updated: UserJourney) {
    await updateJourney.mutateAsync({
      id: updated.id,
      name: updated.name,
      description: updated.description,
      persona: updated.persona,
      priority: updated.priority,
    });
    setEditing(null);
  }

  async function handleDelete(j: UserJourney) {
    if (!window.confirm(`确定删除旅程「${j.name}」吗？该旅程下的故事与任务将一并删除。`)) {
      return;
    }
    await deleteJourney.mutateAsync({ id: j.id });
    if (editing?.id === j.id) setEditing(null);
  }

  /** 上移/下移调整旅程顺序（交换相邻 order 并 PATCH） */
  async function moveJourney(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= journeys.length) return;
    const list = [...journeys];
    [list[index], list[target]] = [list[target], list[index]];
    // 逐个更新 order 为新序号
    const reindexed = list.map((j, idx) => ({ ...j, order: idx }));
    setProject((prev) => ({ ...prev, user_journeys: reindexed }));
    await Promise.all(
      reindexed.map((j) =>
        updateJourney.mutateAsync({ id: j.id, order: j.order })
      )
    );
  }

  return (
    <div className="space-y-6">
      {/* 顶部操作栏 */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="搜索旅程..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-64 pl-9"
            />
          </div>
          <span className="text-sm text-muted-foreground">
            {journeys.length} 旅程 · {totalStories} 故事
          </span>
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          新建旅程
        </Button>
      </div>

      {/* 旅程卡片列表 */}
      {journeys.length === 0 ? (
        <Card>
          <CardContent className="flex h-40 items-center justify-center text-sm text-muted-foreground">
            暂无旅程，点击「新建旅程」创建第一个
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {journeys.map((j, index) => {
            const pl = PRIORITY_LABEL[j.priority ?? 'medium'];
            return (
              <Card
                key={j.id}
                className="cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-md"
                onClick={() => setEditing(j)}
              >
                <CardContent className="space-y-3 p-4">
                  {/* 头：ID + 优先级 */}
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-mono text-xs text-muted-foreground">{j.id}</span>
                    <span className={`text-xs font-semibold ${pl?.cls ?? ''}`}>
                      {pl?.label ?? j.priority}
                    </span>
                  </div>
                  {/* 名称 */}
                  <h3 className="text-base font-semibold leading-snug">{j.name}</h3>
                  {/* 描述 */}
                  {j.description && (
                    <p className="line-clamp-2 text-sm text-muted-foreground">{j.description}</p>
                  )}
                  {/* 元信息 */}
                  <div className="flex flex-wrap items-center gap-3 border-t pt-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {j.persona || '未指定角色'}
                    </span>
                    <span className="flex items-center gap-1">
                      <LayoutList className="h-3 w-3" />
                      {j.stories?.length ?? 0} 故事
                    </span>
                    <div className="ml-auto flex items-center gap-0.5">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        disabled={index === 0}
                        onClick={(e) => { e.stopPropagation(); moveJourney(index, -1); }}
                        title="上移"
                      >
                        <ArrowUp className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        disabled={index === journeys.length - 1}
                        onClick={(e) => { e.stopPropagation(); moveJourney(index, 1); }}
                        title="下移"
                      >
                        <ArrowDown className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-destructive"
                        onClick={(e) => { e.stopPropagation(); handleDelete(j); }}
                        title="删除旅程"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* 创建/编辑对话框 */}
      <JourneyCreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSave={handleCreate}
      />
      <JourneyEditDialog
        open={!!editing}
        journey={editing}
        onOpenChange={(open) => { if (!open) setEditing(null); }}
        onSave={handleUpdate}
      />
    </div>
  );
}
