/**
 * 任务详情抽屉组件
 *
 * 从右侧滑出，展示任务的完整信息，包括：
 * - 基本信息（ID、标题、描述、类型、优先级、估算工时）
 * - 状态信息
 * - 依赖任务列表（解析为具体任务标题，可点击跳转）
 * - 被依赖任务列表（反向依赖）
 * - 标签
 * - 所属故事/旅程
 */

'use client';

import * as React from 'react';
import {
  Clock,
  Tag,
  ArrowRight,
  ArrowLeft,
  GitBranch,
  Calendar,
  User,
  FileText,
  ExternalLink,
} from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@x-cartographer/ui';
import { Badge } from '@x-cartographer/ui';
import { Separator } from '@x-cartographer/ui';
import { StatusBadge } from './status-badge';
import { cn } from '@/lib/utils';
import type { Task, TaskStatus } from '@/types';

interface TaskDetailSheetProps {
  /** 当前选中的任务 */
  task: Task | null;
  /** 是否打开 */
  open: boolean;
  /** 打开/关闭回调 */
  onOpenChange: (open: boolean) => void;
  /** 所有任务列表（用于解析依赖） */
  allTasks: Task[];
  /** 故事/旅程上下文映射 */
  storyContextMap?: Record<string, { storyTitle: string; journeyName: string }>;
  /** 点击依赖任务时的回调（用于跳转到其他任务详情） */
  onTaskNavigate?: (task: Task) => void;
}

const priorityConfig: Record<string, { label: string; color: string }> = {
  P0: { label: 'P0 - 紧急', color: 'text-red-600 bg-red-50 border-red-200' },
  P1: {
    label: 'P1 - 高',
    color: 'text-orange-600 bg-orange-50 border-orange-200',
  },
  P2: { label: 'P2 - 中', color: 'text-blue-600 bg-blue-50 border-blue-200' },
  P3: { label: 'P3 - 低', color: 'text-gray-600 bg-gray-50 border-gray-200' },
};

const typeConfig: Record<string, { label: string; icon: string }> = {
  user_story: { label: '用户故事', icon: '📖' },
  technical_task: { label: '技术任务', icon: '⚙️' },
  bug_fix: { label: 'Bug 修复', icon: '🐛' },
  spike: { label: 'Spike 探索', icon: '🔍' },
};

export function TaskDetailSheet({
  task,
  open,
  onOpenChange,
  allTasks,
  storyContextMap,
  onTaskNavigate,
}: TaskDetailSheetProps) {
  // 解析依赖任务（当前任务依赖的任务）
  const dependsOn = React.useMemo(() => {
    if (!task) return [];
    if (!task.dependencies || task.dependencies.length === 0) return [];
    return task.dependencies.map((depId) => {
      const depTask = allTasks.find((t) => t.id === depId);
      return {
        id: depId,
        task: depTask ?? null,
        title: depTask?.title ?? depId,
        status: depTask?.status as TaskStatus | undefined,
      };
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task, allTasks]);

  // 解析被依赖任务（依赖当前任务的其他任务）
  const dependedBy = React.useMemo(() => {
    if (!task) return [];
    return allTasks.filter(
      (t) => t.id !== task.id && t.dependencies?.includes(task.id)
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task, allTasks]);

  if (!task) return null;

  const priority = priorityConfig[task.priority] ?? priorityConfig.P2;
  const typeInfo = typeConfig[task.type] ?? typeConfig.technical_task;
  const storyContext = storyContextMap?.[task.story_id];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader className="pr-8">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-muted-foreground">
              {task.id}
            </span>
            <StatusBadge status={task.status} isTask size="sm" />
          </div>
          <SheetTitle className="text-lg leading-snug">{task.title}</SheetTitle>
          {storyContext && (
            <SheetDescription className="flex items-center gap-1 text-xs">
              <GitBranch className="h-3 w-3" />
              {storyContext.journeyName} &rsaquo; {storyContext.storyTitle}
            </SheetDescription>
          )}
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* 基本属性 */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">基本信息</h3>
            <div className="grid grid-cols-2 gap-3">
              {/* 类型 */}
              <InfoItem
                icon={<FileText className="h-3.5 w-3.5" />}
                label="类型"
              >
                <span>
                  {typeInfo.icon} {typeInfo.label}
                </span>
              </InfoItem>

              {/* 优先级 */}
              <InfoItem icon={<Tag className="h-3.5 w-3.5" />} label="优先级">
                <span
                  className={cn(
                    'inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium',
                    priority.color
                  )}
                >
                  {priority.label}
                </span>
              </InfoItem>

              {/* 估算工时 */}
              <InfoItem
                icon={<Clock className="h-3.5 w-3.5" />}
                label="估算工时"
              >
                <span>
                  {task.estimation > 0 ? `${task.estimation} 小时` : '未估算'}
                </span>
              </InfoItem>

              {/* 负责人 */}
              <InfoItem icon={<User className="h-3.5 w-3.5" />} label="负责人">
                <span>{task.assignee ?? '未分配'}</span>
              </InfoItem>

              {/* 创建时间 */}
              {task.created_at && (
                <InfoItem
                  icon={<Calendar className="h-3.5 w-3.5" />}
                  label="创建时间"
                >
                  <span className="text-xs">
                    {new Date(task.created_at).toLocaleDateString('zh-CN')}
                  </span>
                </InfoItem>
              )}

              {/* 完成时间 */}
              {task.completed_at && (
                <InfoItem
                  icon={<Calendar className="h-3.5 w-3.5" />}
                  label="完成时间"
                >
                  <span className="text-xs">
                    {new Date(task.completed_at).toLocaleDateString('zh-CN')}
                  </span>
                </InfoItem>
              )}
            </div>
          </section>

          <Separator />

          {/* 描述 */}
          <section className="space-y-2">
            <h3 className="text-sm font-semibold text-foreground">描述</h3>
            {task.description ? (
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                {task.description}
              </p>
            ) : (
              <p className="text-sm italic text-muted-foreground/60">
                暂无描述
              </p>
            )}
          </section>

          <Separator />

          {/* 依赖关系 */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">依赖关系</h3>

            {/* 依赖的任务（前置依赖） */}
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <ArrowLeft className="h-3 w-3" />
                <span>前置依赖（当前任务依赖于）</span>
                {dependsOn.length > 0 && (
                  <Badge variant="secondary" className="ml-1 text-[10px]">
                    {dependsOn.length}
                  </Badge>
                )}
              </div>
              {dependsOn.length > 0 ? (
                <div className="space-y-1.5">
                  {dependsOn.map((dep) => (
                    <DependencyCard
                      key={dep.id}
                      id={dep.id}
                      title={dep.title}
                      status={dep.status}
                      found={dep.task !== null}
                      onClick={() => {
                        if (dep.task && onTaskNavigate) {
                          onTaskNavigate(dep.task);
                        }
                      }}
                      clickable={dep.task !== null && !!onTaskNavigate}
                    />
                  ))}
                </div>
              ) : (
                <p className="py-2 text-center text-xs text-muted-foreground/60">
                  无前置依赖
                </p>
              )}
            </div>

            <div className="my-2" />

            {/* 被依赖的任务（后续任务） */}
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <ArrowRight className="h-3 w-3" />
                <span>被依赖（以下任务依赖当前任务）</span>
                {dependedBy.length > 0 && (
                  <Badge variant="secondary" className="ml-1 text-[10px]">
                    {dependedBy.length}
                  </Badge>
                )}
              </div>
              {dependedBy.length > 0 ? (
                <div className="space-y-1.5">
                  {dependedBy.map((depTask) => (
                    <DependencyCard
                      key={depTask.id}
                      id={depTask.id}
                      title={depTask.title}
                      status={depTask.status as TaskStatus}
                      found={true}
                      onClick={() => onTaskNavigate?.(depTask)}
                      clickable={!!onTaskNavigate}
                    />
                  ))}
                </div>
              ) : (
                <p className="py-2 text-center text-xs text-muted-foreground/60">
                  无后续依赖
                </p>
              )}
            </div>
          </section>

          {/* 标签 */}
          {task.tags && task.tags.length > 0 && (
            <>
              <Separator />
              <section className="space-y-2">
                <h3 className="text-sm font-semibold text-foreground">标签</h3>
                <div className="flex flex-wrap gap-1.5">
                  {task.tags.map((tag) => (
                    <Badge key={tag} variant="outline" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </section>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

/** 信息项 */
function InfoItem({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      <div className="text-sm">{children}</div>
    </div>
  );
}

/** 依赖任务卡片 */
function DependencyCard({
  id,
  title,
  status,
  found,
  onClick,
  clickable,
}: {
  id: string;
  title: string;
  status?: TaskStatus;
  found: boolean;
  onClick: () => void;
  clickable: boolean;
}) {
  return (
    <button
      type="button"
      onClick={clickable ? onClick : undefined}
      disabled={!clickable}
      className={cn(
        'flex w-full items-center gap-2 rounded-md border p-2.5 text-left transition-colors',
        clickable ? 'cursor-pointer hover:bg-accent/50' : 'cursor-default',
        !found && 'border-dashed border-muted-foreground/30 bg-muted/30'
      )}
    >
      <div className="min-w-0 flex-1 space-y-0.5">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] text-muted-foreground">
            {id}
          </span>
          {status && <StatusBadge status={status} isTask size="sm" />}
        </div>
        <p className="truncate text-sm">
          {found ? title : `${id}（任务未找到）`}
        </p>
      </div>
      {clickable && (
        <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      )}
    </button>
  );
}
