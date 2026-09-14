'use client';

import { useEffect, useMemo, useState } from 'react';
import { Plus, Search, LayoutList, Trash2, ArrowUp, ArrowDown } from 'lucide-react';
import { Button, Input, Card, CardContent } from '@x-cartographer/ui';
import {
  ActivityCreateDialog,
  ActivityEditDialog,
} from '@/features/story-map/components';
import { useCreateActivity, useUpdateActivity, useDeleteActivity } from '@/lib/api/hooks';
import type { Product, UserActivity } from '@/types';

interface JourneysPageProps {
  /** 当前产品 */
  project: Product;
}

export function JourneysPage({ project: initialProject }: JourneysPageProps) {
  const createActivity = useCreateActivity();
  const updateActivity = useUpdateActivity();
  const deleteActivity = useDeleteActivity();

  const [project, setProject] = useState(initialProject);
  const [searchQuery, setSearchQuery] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<UserActivity | null>(null);

  // 同步产品数据
  useEffect(() => {
    setProject(initialProject);
  }, [initialProject]);

  const activities = useMemo(() => {
    const list = [...(project.user_activities ?? [])].sort((a, b) => a.order - b.order);
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase();
    return list.filter(
      (j) =>
        j.name.toLowerCase().includes(q) ||
        j.description.toLowerCase().includes(q)
    );
  }, [project, searchQuery]);

  const totalStories = useMemo(
    () => (project.user_activities ?? []).reduce((sum, j) => sum + (j.stories?.length ?? 0), 0),
    [project]
  );

  async function handleCreate(data: { name: string; description: string }) {
    await createActivity.mutateAsync({ productId: project.id, ...data });
    setCreateOpen(false);
  }

  async function handleUpdate(updated: UserActivity) {
    await updateActivity.mutateAsync({
      id: updated.id,
      name: updated.name,
      description: updated.description,
      order: updated.order,
    });
    setEditing(null);
  }

  async function handleDelete(j: UserActivity) {
    if (!window.confirm(`确定删除活动「${j.name}」吗？该活动下的故事与任务将一并删除。`)) {
      return;
    }
    await deleteActivity.mutateAsync({ id: j.id });
    if (editing?.id === j.id) setEditing(null);
  }

  /** 上移/下移调整活动顺序（交换相邻 order 并 PATCH） */
  async function moveActivity(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= activities.length) return;
    const list = [...activities];
    [list[index], list[target]] = [list[target], list[index]];
    // 逐个更新 order 为新序号
    const reindexed = list.map((j, idx) => ({ ...j, order: idx }));
    setProject((prev) => ({ ...prev, user_activities: reindexed }));
    await Promise.all(
      reindexed.map((j) =>
        updateActivity.mutateAsync({ id: j.id, order: j.order })
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
              placeholder="搜索活动..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-56 pl-9"
            />
          </div>
          <span className="text-sm text-muted-foreground">
            {activities.length} 活动 · {totalStories} 故事
          </span>
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          新建活动
        </Button>
      </div>

      {/* 活动列表 */}
      {activities.length === 0 ? (
        <Card>
          <CardContent className="flex h-40 items-center justify-center text-sm text-muted-foreground">
            暂无活动，点击「新建活动」创建第一个
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="space-y-2 pt-4">
            {activities.map((j, index) => (
              <div
                key={j.id}
                className="flex items-center gap-3 rounded-md border p-3"
              >
                <LayoutList className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{j.name}</div>
                  {j.description && (
                    <div className="truncate text-xs text-muted-foreground">{j.description}</div>
                  )}
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {(j.stories?.length ?? 0)} 故事
                </span>
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    disabled={index === 0}
                    onClick={() => moveActivity(index, -1)}
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    disabled={index === activities.length - 1}
                    onClick={() => moveActivity(index, 1)}
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive"
                    onClick={() => handleDelete(j)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* 新建活动对话框 */}
      <ActivityCreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSave={handleCreate}
      />
      {/* 编辑活动对话框 */}
      <ActivityEditDialog
        open={!!editing}
        activity={editing}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
        onSave={handleUpdate}
      />
    </div>
  );
}
