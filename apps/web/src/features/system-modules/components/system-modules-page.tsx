'use client';

/**
 * 模块目录管理页面（约束空间·规矩，docs/design/domain-model.md §6.4.1）
 *
 * 用途是**系统设计**：看全貌、画依赖、做规划。因此本页的价值不在 CRUD 表单，
 * 而在把「谁依赖谁」摆到同一屏——三种视图是同一份数据的三个投影：
 * - 列表（默认）：每行展示该模块依赖的模块（正向），适合逐条查阅/编辑
 * - 依赖图（`module-dependency-graph.tsx`）：整目录一张分层图，看拓扑全貌
 * - 归属矩阵（`module-matrix`）：Story/Task × 模块的触及关系，看影响面（§4）
 * 详情抽屉展示反向引用（依赖它的模块）——影响面在这里才看得见。
 *
 * 模块 id 是人类可读 slug（非随机 id），故列表以等宽字体突出 id。
 */

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Boxes, Grid3x3, List, Network, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@x-cartographer/ui';
import type { Product, SystemModule } from '@x-cartographer/shared';
import { useDeleteSystemModule, useSystemModules, useUpsertSystemModule } from '@/lib/api/hooks';
import { dependentsOf, moduleNameMap, type ModuleFormDraft } from '../lib/module-form';
import { ModuleDependencyGraph } from './module-dependency-graph';
import { ModuleMatrix } from '@/features/module-matrix';
import { ModuleFormDialog, resolveDraftDependencies } from './module-form-dialog';

interface SystemModulesPageProps {
  /** 当前产品（模块目录按产品隔离） */
  project: Product;
}

export function SystemModulesPage({ project }: SystemModulesPageProps) {
  const productId = project.id;
  const { data: modules = [], isLoading, error } = useSystemModules(productId);
  const upsertModule = useUpsertSystemModule();
  const deleteModule = useDeleteSystemModule();

  const [searchQuery, setSearchQuery] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<SystemModule | null>(null);
  const [detail, setDetail] = useState<SystemModule | null>(null);
  /** 最近一次写入失败原因（slug 非法 / 重名 / 网络失败），回填给对话框 */
  const [submitError, setSubmitError] = useState<string | null>(null);

  /** 视图：列表（默认）/ 依赖图 */
  const [view, setView] = useState<'list' | 'graph' | 'matrix'>('list');

  const names = useMemo(() => moduleNameMap(modules), [modules]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return modules;
    return modules.filter(
      (m) =>
        m.id.toLowerCase().includes(q) ||
        m.name.toLowerCase().includes(q) ||
        m.path.toLowerCase().includes(q) ||
        m.responsibility.toLowerCase().includes(q)
    );
  }, [modules, searchQuery]);

  /** 提交表单。返回 false = 失败（对话框保持打开并显示 submitError） */
  async function handleSubmit(draft: ModuleFormDraft): Promise<boolean> {
    const id = draft.id.trim();
    setSubmitError(null);
    try {
      await upsertModule.mutateAsync({
        id,
        product_id: productId,
        name: draft.name.trim(),
        path: draft.path.trim(),
        responsibility: draft.responsibility.trim(),
        depends_on: resolveDraftDependencies(draft),
        // 人在 UI 里登记的模块属于直接主张（§3），显式落列避免被读成 agent_inferred
        provenance: 'human_asserted',
      });
      toast.success(editing ? '模块已更新' : '模块已创建', { description: id });
      // 不清 editing：对话框关闭时由 onOpenChange 统一复位，此刻清会让
      // 表单 effect 先重跑一次空草稿（闪一帧空表单）才关闭
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : '未知错误';
      setSubmitError(message);
      toast.error(editing ? '更新模块失败' : '创建模块失败', { description: message });
      return false;
    }
  }

  async function handleDelete(m: SystemModule) {
    const dependents = dependentsOf(m.id, modules);
    const warning =
      dependents.length > 0
        ? `\n\n注意：${dependents.map((d) => d.id).join('、')} 依赖它，删除后这些引用会指向不存在的模块。`
        : '';
    if (!window.confirm(`确定删除模块「${m.name}」(${m.id}) 吗？${warning}`)) return;

    try {
      await deleteModule.mutateAsync({ id: m.id, productId });
      toast.success('模块已删除', { description: m.id });
      if (detail?.id === m.id) setDetail(null);
    } catch (err) {
      toast.error('删除模块失败', {
        description: err instanceof Error ? err.message : '未知错误',
      });
    }
  }

  function openForm(target: SystemModule | null) {
    setEditing(target);
    setSubmitError(null);
    setFormOpen(true);
  }

  /** 依赖 badge：已知模块显示名称 tooltip，悬空引用（模块已删）标红提示 */
  function renderDependencyBadges(deps: readonly string[]) {
    if (deps.length === 0) return <span className="text-xs text-muted-foreground">无依赖</span>;
    return (
      <div className="flex flex-wrap items-center gap-1">
        {deps.map((dep) => {
          const known = dep in names;
          return (
            <Badge
              key={dep}
              variant="outline"
              title={known ? names[dep] : '目标模块不在目录中（可能已删除）'}
              className={
                known ? 'font-mono text-[11px]' : 'font-mono text-[11px] text-destructive'
              }
            >
              {dep}
            </Badge>
          );
        })}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 顶部操作栏 */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* 视图切换（分段控件，对齐 roadmap-page 范式） */}
          <div className="flex items-center gap-1 rounded-lg border bg-muted/30 p-1">
            <Button
              variant={view === 'list' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setView('list')}
              className="gap-1.5"
            >
              <List className="h-3.5 w-3.5" />
              列表
            </Button>
            <Button
              variant={view === 'graph' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setView('graph')}
              className="gap-1.5"
            >
              <Network className="h-3.5 w-3.5" />
              依赖图
            </Button>
            <Button
              variant={view === 'matrix' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setView('matrix')}
              className="gap-1.5"
            >
              <Grid3x3 className="h-3.5 w-3.5" />
              归属矩阵
            </Button>
          </div>
          {/* 搜索与计数只属于列表：依赖图刻意不按搜索词过滤——
              滤掉中间节点会让"谁依赖谁"失真 */}
          {view === 'list' && (
            <>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="搜索模块..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-56 pl-9"
                />
              </div>
              <span className="text-sm text-muted-foreground">{filtered.length} 个模块</span>
            </>
          )}
        </div>
        <Button size="sm" onClick={() => openForm(null)}>
          <Plus className="mr-2 h-4 w-4" />
          新建模块
        </Button>
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="flex h-40 items-center justify-center text-sm text-muted-foreground">
            加载中…
          </CardContent>
        </Card>
      ) : error ? (
        <Card>
          <CardContent className="flex h-40 items-center justify-center text-sm text-destructive">
            加载模块目录失败：{error instanceof Error ? error.message : '未知错误'}
          </CardContent>
        </Card>
      ) : modules.length === 0 ? (
        /* 空态：图视图没有可渲染的节点，提示回列表创建（见下行文案） */
        <Card>
          <CardContent className="flex h-40 items-center justify-center px-8 text-center text-sm text-muted-foreground">
            {view === 'graph'
              ? '尚无模块记录——依赖图没有可渲染的节点。请切回「列表」视图创建模块。'
              : '尚无模块记录。模块目录用于系统设计——登记代码库的模块划分与依赖关系。'}
          </CardContent>
        </Card>
      ) : view === 'graph' ? (
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            <ModuleDependencyGraph modules={modules} className="h-[600px]" />
          </CardContent>
        </Card>
      ) : view === 'matrix' ? (
        /* 矩阵不按搜索词过滤（同依赖图理由：滤掉行会让影响面失真） */
        <ModuleMatrix project={project} modules={modules} />
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex h-40 items-center justify-center px-8 text-center text-sm text-muted-foreground">
            没有匹配的模块
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              模块列表（按 id 排序）
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {filtered.map((m) => (
              <div
                key={m.id}
                role="button"
                tabIndex={0}
                onClick={() => setDetail(m)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') setDetail(m);
                }}
                className="group flex cursor-pointer items-start gap-3 rounded-md border p-3 transition-colors hover:bg-accent/40"
              >
                <Boxes className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs text-muted-foreground">{m.id}</span>
                    <span className="text-sm font-medium">{m.name}</span>
                    {m.path && (
                      <span className="font-mono text-xs text-muted-foreground">{m.path}</span>
                    )}
                  </div>
                  {m.responsibility && (
                    <p className="line-clamp-1 text-xs text-muted-foreground">{m.responsibility}</p>
                  )}
                  <div className="flex flex-wrap items-center gap-1">
                    <span className="text-xs text-muted-foreground">依赖：</span>
                    {renderDependencyBadges(m.depends_on ?? [])}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    title="编辑"
                    onClick={(e) => {
                      e.stopPropagation();
                      openForm(m);
                    }}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-destructive"
                    title="删除"
                    onClick={(e) => {
                      e.stopPropagation();
                      void handleDelete(m);
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* 新建/编辑对话框 */}
      <ModuleFormDialog
        open={formOpen}
        onOpenChange={(next) => {
          setFormOpen(next);
          if (!next) {
            setEditing(null);
            setSubmitError(null);
          }
        }}
        modules={modules}
        editing={editing}
        submitError={submitError}
        onSubmit={handleSubmit}
      />

      {/* 模块详情抽屉（Sheet，对齐任务/故事交互） */}
      <Sheet
        open={!!detail}
        onOpenChange={(open) => {
          if (!open) setDetail(null);
        }}
      >
        <SheetContent side="right" className="w-full overflow-y-auto p-4 sm:max-w-lg">
          {detail && (
            <ModuleDetail
              module={detail}
              modules={modules}
              onEdit={() => {
                const target = detail;
                setDetail(null);
                openForm(target);
              }}
              onDelete={() => void handleDelete(detail)}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

/** 模块详情抽屉内容 */
function ModuleDetail({
  module: m,
  modules,
  onEdit,
  onDelete,
}: {
  module: SystemModule;
  modules: readonly SystemModule[];
  onEdit: () => void;
  onDelete: () => void;
}) {
  const names = moduleNameMap(modules);
  const dependents = dependentsOf(m.id, modules);

  return (
    <div className="space-y-6">
      <SheetHeader className="pr-8 text-left">
        <span className="font-mono text-xs text-muted-foreground">{m.id}</span>
        <SheetTitle className="text-lg leading-snug">{m.name}</SheetTitle>
        {m.path && <SheetDescription className="font-mono text-xs">{m.path}</SheetDescription>}
      </SheetHeader>

      <div className="space-y-1">
        <h3 className="text-xs text-muted-foreground">职责</h3>
        <p className="text-sm">{m.responsibility || '（未填写）'}</p>
      </div>

      <div className="space-y-1">
        <h3 className="text-xs text-muted-foreground">依赖的模块</h3>
        {(m.depends_on ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">无</p>
        ) : (
          <div className="flex flex-wrap gap-1">
            {(m.depends_on ?? []).map((dep) => (
              <Badge
                key={dep}
                variant="outline"
                className={
                  dep in names ? 'font-mono text-[11px]' : 'font-mono text-[11px] text-destructive'
                }
                title={names[dep] ?? '目标模块不在目录中'}
              >
                {dep}
              </Badge>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-1">
        <h3 className="text-xs text-muted-foreground">被以下模块依赖</h3>
        {dependents.length === 0 ? (
          <p className="text-sm text-muted-foreground">无（改动它不影响其他已登记模块）</p>
        ) : (
          <div className="flex flex-wrap gap-1">
            {dependents.map((d) => (
              <Badge key={d.id} variant="secondary" className="font-mono text-[11px]">
                {d.id}
              </Badge>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={onEdit}>
          <Pencil className="mr-2 h-4 w-4" />
          编辑
        </Button>
        <Button variant="outline" size="sm" className="text-destructive" onClick={onDelete}>
          <Trash2 className="mr-2 h-4 w-4" />
          删除
        </Button>
      </div>
    </div>
  );
}
