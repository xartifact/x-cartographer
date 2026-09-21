'use client';

/**
 * 模块归属矩阵（Story/Task × SystemModule）—— relationship-visualization.md §4。
 *
 * 为什么是矩阵而不是图：多对多关系用节点连线表示，边数是二部图两侧规模的乘积级增长；
 * 矩阵是线性可滚动的表格，一眼看出一列（"改这个模块影响谁"）或一行（"这个实体涉及哪些模块"）。
 *
 * 本组件是 `technical-constitution.md` §4 `resolveEffectiveArchitectureContext` 的**人类可读投影**：
 * 矩阵里"某故事触及某模块"与 `story info` 里出现的该模块架构原则，是同一份 `affected_modules` 数据的两种视图。
 *
 * 刻意只展示**已标注**的行：未标注实体对矩阵零信息量，且混进来会让"没人标注"看起来像
 * "不涉及任何模块"——真实缺口由顶部提示单独暴露（domain-model.md §1.2：0/194 填充率必须可见）。
 */

import * as React from 'react';
import { AlertTriangle, Filter } from 'lucide-react';
import { Badge, Card, CardContent, CardHeader, CardTitle, Button } from '@x-cartographer/ui';
import { cn } from '@/lib/utils';
import type { Product, SystemModule } from '@x-cartographer/shared';
import { buildModuleMatrix, rowHasModule, type MatrixRow, type MatrixSource } from '../lib/build-module-matrix';

export interface ModuleMatrixProps {
  /** 当前产品（含活动→故事→研发任务深树，矩阵数据源） */
  project: Product;
  /** 模块目录（决定列） */
  modules: readonly SystemModule[];
  className?: string;
}

type RowFilter = 'all' | 'story' | 'task';

export function ModuleMatrix({ project, modules, className }: ModuleMatrixProps) {
  const [kindFilter, setKindFilter] = React.useState<RowFilter>('all');

  /** 从产品深树收集故事与任务（深树一次取全，勿逐 story 拉接口） */
  const { stories, tasks } = React.useMemo(() => {
    const s: MatrixSource[] = [];
    const t: MatrixSource[] = [];
    for (const activity of project.user_activities ?? []) {
      for (const story of activity.stories ?? []) {
        s.push({ id: story.id, title: story.title, affected_modules: story.affected_modules });
        for (const task of story.dev_tasks ?? []) {
          t.push({
            id: task.id,
            title: task.title,
            affected_modules: task.affected_modules,
            module_id: task.module_id,
            // 继承故事的标注：与 CLI task info 的回落链一致（§4）
            story_affected_modules: story.affected_modules,
          });
        }
      }
    }
    return { stories: s, tasks: t };
  }, [project]);

  const matrix = React.useMemo(
    () => buildModuleMatrix(modules, stories, tasks),
    [modules, stories, tasks]
  );

  const rows = React.useMemo(
    () => (kindFilter === 'all' ? matrix.rows : matrix.rows.filter((r) => r.kind === kindFilter)),
    [matrix.rows, kindFilter]
  );

  if (modules.length === 0) {
    return (
      <Card className={className}>
        <CardContent className="flex h-40 items-center justify-center px-8 text-center text-sm text-muted-foreground">
          模块目录为空——矩阵没有可用的列。请先在「列表」视图创建模块。
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn('overflow-hidden', className)}>
      <CardHeader className="flex-row items-center justify-between gap-4 space-y-0 pb-3">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          模块归属矩阵（行 = 故事/任务，列 = 模块）
        </CardTitle>
        <div className="flex items-center gap-1 rounded-lg border bg-muted/30 p-1">
          {(
            [
              ['all', '全部'],
              ['story', '仅故事'],
              ['task', '仅任务'],
            ] as const
          ).map(([value, label]) => (
            <Button
              key={value}
              variant={kindFilter === value ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setKindFilter(value)}
            >
              {label}
            </Button>
          ))}
        </div>
      </CardHeader>

      <CardContent className="space-y-3 p-0 pb-4">
        {/* 缺口提示：未标注实体数必须可见，否则矩阵看起来"一切正常" */}
        {matrix.unlabeledCount > 0 && (
          <div className="mx-6 flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-xs">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
            <span>
              有 <strong>{matrix.unlabeledCount}</strong> 个故事/任务未标注 <code>affected_modules</code>
              （不在矩阵中）。未标注意味着它们的架构影响面未知，也拿不到对应的架构原则。
            </span>
          </div>
        )}

        {matrix.missingIds.length > 0 && (
          <div className="mx-6 flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-xs">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" />
            <span>
              有 {matrix.missingIds.length} 个被引用的模块不在目录中（已删除但引用未清理）：
              {matrix.missingIds.map((id) => (
                <Badge key={id} variant="outline" className="ml-1 font-mono text-[10px] text-destructive">
                  {id}
                </Badge>
              ))}
            </span>
          </div>
        )}

        {rows.length === 0 ? (
          <div className="flex h-32 items-center justify-center px-8 text-center text-sm text-muted-foreground">
            {matrix.rows.length === 0
              ? '尚无标注了 affected_modules 的故事或任务——矩阵为空。标注在故事/任务拆解时完成。'
              : '当前筛选下没有行。'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b">
                  <th className="sticky left-0 z-10 bg-card px-4 py-2 text-left font-medium">
                    实体
                  </th>
                  {matrix.columns.map((col) => (
                    <th
                      key={col.id}
                      className={cn(
                        'whitespace-nowrap px-3 py-2 text-center font-medium',
                        col.missing && 'text-destructive'
                      )}
                      title={col.missing ? '该模块已不在目录中（悬空引用）' : col.id}
                    >
                      <div className="font-mono text-[11px]">{col.id}</div>
                      <div className="text-[10px] font-normal text-muted-foreground">
                        {col.missing ? '已删除' : col.name}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b last:border-0 hover:bg-accent/30">
                    <th className="sticky left-0 z-10 max-w-[280px] bg-card px-4 py-2 text-left font-normal">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="shrink-0 text-[10px]">
                          {row.kind === 'story' ? '故事' : '任务'}
                        </Badge>
                        <span className="font-mono text-[11px] text-muted-foreground">{row.id}</span>
                      </div>
                      <div className="truncate text-xs" title={row.title}>
                        {row.title}
                      </div>
                    </th>
                    {matrix.columns.map((col) => (
                      <td key={col.id} className="px-3 py-2 text-center">
                        {rowHasModule(row, col.id) ? (
                          <span
                            className={cn(
                              'inline-block h-2.5 w-2.5 rounded-full',
                              col.missing ? 'bg-destructive' : 'bg-primary'
                            )}
                            aria-label="涉及"
                          />
                        ) : (
                          <span className="text-muted-foreground/30">·</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="mx-6 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-primary" />
            涉及
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-destructive" />
            涉及（模块已删除）
          </span>
          <span className="flex items-center gap-1">
            <Filter className="h-3 w-3" />
            共 {rows.length} 行 × {matrix.columns.length} 列
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

/** 行类型再导出，供测试/调用方使用 */
export type { MatrixRow };
