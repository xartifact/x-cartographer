'use client';

/**
 * 故事节点组件
 */

import { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Clock, Tag, CheckSquare, GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { StatusBadge } from '@/features/tasks/components/status-badge';
import type { StoryNodeData } from '../types';
import { Priority } from '@/types';

/** 左侧边框优先级颜色 */
const priorityBorder: Record<Priority, string> = {
  [Priority.HIGH]: 'border-l-4 border-l-red-500',
  [Priority.MEDIUM]: 'border-l-4 border-l-amber-400',
  [Priority.LOW]: 'border-l-4 border-l-green-500',
};

/** 优先级标签颜色 */
const priorityLabel: Record<Priority, { text: string; cls: string }> = {
  [Priority.HIGH]: { text: 'P-高', cls: 'text-red-500' },
  [Priority.MEDIUM]: { text: 'P-中', cls: 'text-amber-500' },
  [Priority.LOW]: { text: 'P-低', cls: 'text-green-600' },
};

export const StoryNode = memo<NodeProps<StoryNodeData>>(
  ({ data, selected }) => {
    const { story, journeyName, isSelected } = data;

    const tasks = story.tasks ?? [];
    const totalTasks = tasks.length;
    const doneTasks = tasks.filter((t) => t.status === 'done').length;
    const progressPct =
      totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : null;

    const pl = priorityLabel[story.priority];

    return (
      <>
        <Handle
          type="target"
          position={Position.Top}
          className="!h-2 !w-2 !bg-muted-foreground/40"
        />

        {/* 拖拽手柄 */}
        <div className="drag-handle absolute left-0.5 top-1/2 z-10 -translate-y-1/2 rounded-sm p-0.5 text-muted-foreground/30 transition-all hover:bg-muted hover:text-muted-foreground">
          <GripVertical className="h-4 w-4" />
        </div>

        <Card
          onClick={() => data.onSelect?.(story)}
          className={cn(
            'w-64 cursor-pointer bg-background transition-all duration-150',
            'hover:-translate-y-0.5 hover:shadow-lg',
            selected || isSelected
              ? 'shadow-md ring-2 ring-primary'
              : 'shadow-sm',
            priorityBorder[story.priority],
            // 增加左侧内边距以容纳拖拽手柄
            'pl-6'
          )}
        >
          <CardContent className="space-y-2 p-3">
            {/* 行 1：ID + 优先级文字 + 状态 */}
            <div className="flex items-center justify-between gap-1">
              <div className="flex min-w-0 items-center gap-1.5">
                <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                  {story.id}
                </span>
                <span
                  className={cn('shrink-0 text-[10px] font-semibold', pl.cls)}
                >
                  {pl.text}
                </span>
              </div>
              {story.status && (
                <StatusBadge
                  status={story.status}
                  isTask={false}
                  outline
                  className="shrink-0 px-1.5 py-0 text-[10px]"
                />
              )}
            </div>

            {/* 行 2：标题 */}
            <p className="line-clamp-2 text-sm font-medium leading-snug">
              {story.title}
            </p>

            {/* 行 3：旅程名 */}
            <p className="truncate text-[11px] text-muted-foreground">
              {journeyName}
            </p>

            {/* 分隔线 */}
            <div className="border-t border-border/60" />

            {/* 行 4：meta 信息 */}
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <div className="flex items-center gap-2">
                {story.estimation > 0 && (
                  <span className="flex items-center gap-0.5">
                    <Clock className="h-3 w-3" />
                    {story.estimation}h
                  </span>
                )}
                {story.tags && story.tags.length > 0 && (
                  <span className="flex items-center gap-0.5">
                    <Tag className="h-3 w-3" />
                    {story.tags.length}
                  </span>
                )}
              </div>
              {totalTasks > 0 && (
                <span className="flex items-center gap-0.5">
                  <CheckSquare className="h-3 w-3" />
                  {doneTasks}/{totalTasks}
                </span>
              )}
            </div>

            {/* 任务进度条 */}
            {totalTasks > 0 && (
              <div className="h-1 overflow-hidden rounded-full bg-muted">
                <div
                  className={cn(
                    'h-full rounded-full transition-all duration-300',
                    progressPct === 100 ? 'bg-green-500' : 'bg-primary'
                  )}
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            )}
          </CardContent>
        </Card>

        <Handle
          type="source"
          position={Position.Bottom}
          className="!h-2 !w-2 !bg-muted-foreground/40"
        />
      </>
    );
  }
);

StoryNode.displayName = 'StoryNode';

/**
 * 旅程头节点组件
 */
export const JourneyHeaderNode = memo<
  NodeProps<{ journeyName: string; storyCount: number }>
>(({ data }) => {
  const { journeyName, storyCount } = data;
  return (
    <div className="flex items-center justify-center">
      <Card className="w-60 border-primary/20 bg-primary/5">
        <CardContent className="p-4 text-center">
          <h3 className="line-clamp-2 text-sm font-semibold">{journeyName}</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {storyCount} 个故事
          </p>
        </CardContent>
      </Card>
    </div>
  );
});

JourneyHeaderNode.displayName = 'JourneyHeaderNode';

/**
 * 空状态节点
 */
export const EmptyNode = () => (
  <div className="flex h-20 w-60 items-center justify-center">
    <p className="text-sm italic text-muted-foreground">暂无故事</p>
  </div>
);
