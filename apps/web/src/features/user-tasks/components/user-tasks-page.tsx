'use client';

/**
 * 用户任务管理页面
 *
 * 用户任务（UserTask）= 活动下的用户操作步骤（Patton 骨架第二层，地图元素）。
 * 与故事/任务管理同范式：顶部操作栏（搜索 + 活动筛选 + 新建）、列表、行内编辑/删除。
 * - 数据源：GET /api/user-tasks?productId=（跨活动聚合，按活动→任务序排列）。
 */

import { useMemo, useState } from 'react';
import { Plus, Search, Pencil, Trash2 } from 'lucide-react';

import { Button, Input, Card, CardContent, CardHeader, CardTitle, Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@x-cartographer/ui';
import {
  useUserTasksByProduct,
  useCreateUserTask,
  useUpdateUserTask,
  useDeleteUserTask,
} from '@/lib/api/hooks';
import type { Product, UserTask } from '@/types';

interface UserTasksPageProps {
  /** 当前产品 */
  project: Product;
}

/** 带活动名的用户任务 */
type EnrichedTask = UserTask & { activity_name: string };

export function UserTasksPage({ project }: UserTasksPageProps) {
  const productId = project.id;
  const activities = useMemo(() => project.user_activities ?? [], [project]);
  const activityName = useMemo(
    () => new Map(activities.map((a) => [a.id, a.name])),
    [activities]
  );

  const { data: tasks = [], isLoading } = useUserTasksByProduct(productId);
  const createTask = useCreateUserTask();
  const updateTask = useUpdateUserTask();
  const deleteTask = useDeleteUserTask();

  const [searchQuery, setSearchQuery] = useState('');
  const [activityFilter, setActivityFilter] = useState<string>('');
  const [createOpen, setCreateOpen] = useState(false);
  const [createTarget, setCreateTarget] = useState<string>('');
  const [editing, setEditing] = useState<EnrichedTask | null>(null);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');

  const enriched = useMemo<EnrichedTask[]>(
    () => tasks.map((t) => ({ ...t, activity_name: activityName.get(t.activity_id) ?? '（未知活动）' })),
    [tasks, activityName]
  );

  const filtered = useMemo(() => {
    let list = enriched;
    if (activityFilter) list = list.filter((t) => t.activity_id === activityFilter);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (t) => t.name.toLowerCase().includes(q) || t.id.toLowerCase().includes(q)
      );
    }
    return list;
  }, [enriched, activityFilter, searchQuery]);

  async function handleCreate() {
    if (!newName.trim() || !createTarget) return;
    await createTask.mutateAsync({
      activity_id: createTarget,
      name: newName.trim(),
      description: newDesc.trim(),
    });
    setNewName('');
    setNewDesc('');
    setCreateOpen(false);
  }

  async function handleSaveEdit() {
    if (!editing || !editName.trim()) return;
    await updateTask.mutateAsync({ id: editing.id, name: editName.trim(), description: editDesc.trim() });
    setEditing(null);
  }

  async function handleDelete(t: EnrichedTask) {
    if (!window.confirm(`确定删除用户任务「${t.name}」吗？关联故事将变为未分配。`)) return;
    await deleteTask.mutateAsync({ id: t.id });
  }

  function openEdit(t: EnrichedTask) {
    setEditing(t);
    setEditName(t.name);
    setEditDesc(t.description);
  }

  return (
    <div className="space-y-6">
      {/* 顶部操作栏 */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="搜索用户任务..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-56 pl-9"
            />
          </div>
          <select
            value={activityFilter}
            onChange={(e) => setActivityFilter(e.target.value)}
            className="h-9 rounded-md border bg-background px-2 text-sm"
          >
            <option value="">所有活动</option>
            {activities.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
          <span className="text-sm text-muted-foreground">{filtered.length} 用户任务</span>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={createTarget}
            onChange={(e) => setCreateTarget(e.target.value)}
            className="h-9 rounded-md border bg-background px-2 text-sm"
          >
            {activities.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
          <Button
            size="sm"
            onClick={() => {
              if (!createTarget && activities.length > 0) setCreateTarget(activities[0].id);
              setCreateOpen(true);
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            新建用户任务
          </Button>
        </div>
      </div>

      {/* 列表 */}
      {isLoading ? (
        <Card>
          <CardContent className="flex h-40 items-center justify-center text-sm text-muted-foreground">
            加载中…
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex h-40 items-center justify-center text-sm text-muted-foreground">
            暂无用户任务，点击「新建用户任务」创建
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              用户任务列表（按活动分组序）
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {filtered.map((t) => (
              <div
                key={t.id}
                className="group flex items-center gap-3 rounded-md border p-3 transition-colors hover:bg-accent/40"
              >
                <span className="font-mono text-xs text-muted-foreground">{t.id}</span>
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{t.name}</span>
                {t.description && (
                  <span className="hidden max-w-[280px] truncate text-xs text-muted-foreground md:block">
                    {t.description}
                  </span>
                )}
                <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary/80">
                  {t.activity_name}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">#{t.order}</span>
                <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="编辑" onClick={() => openEdit(t)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" title="删除" onClick={() => handleDelete(t)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* 新建对话框 */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>新建用户任务</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input placeholder="任务名（用户操作短语，如「拖拽调整故事位置」）" value={newName} onChange={(e) => setNewName(e.target.value)} />
            <Input placeholder="描述（可选）" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} />
            <select value={createTarget} onChange={(e) => setCreateTarget(e.target.value)} className="h-9 w-full rounded-md border bg-background px-2 text-sm">
              {activities.map((a) => (
                <option key={a.id} value={a.id}>
                  所属活动：{a.name}
                </option>
              ))}
            </select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>取消</Button>
            <Button onClick={handleCreate} disabled={!newName.trim() || !createTarget}>创建</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 编辑对话框 */}
      <Dialog open={!!editing} onOpenChange={(open) => { if (!open) setEditing(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>编辑用户任务</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
            <Input placeholder="描述" value={editDesc} onChange={(e) => setEditDesc(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>取消</Button>
            <Button onClick={handleSaveEdit} disabled={!editName.trim()}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
