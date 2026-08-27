'use client';

/**
 * 共享用户故事卡片（排期规划 / 故事地图统一用）
 *
 * 信息密度对齐故事地图 StoryNode：优先级左色条 + 状态徽章 + 估算 + 任务进度。
 * - story-map 的 StoryNode 深度耦合 xyflow（Handle/NodeProps），无法直接复用，
 *   故以纯展示卡片形式抽出，Roadmap 泳道/待规划池接入。
 * - onClick 可选：传入则整卡可点，配合外层 StoryDetailPanel 打开详情。
 */

import { Clock, Tag, CheckSquare } from 'lucide-react';
import { Card, CardContent } from '@x-cartographer/ui';
import { cn } from '@/lib/utils';
import { StatusBadge } from '@/features/tasks/components/status-badge';
import type { UserStory } from '@/types';

/** 优先级左色条 */
const priorityBorder: Record<string, string> = {
  high: 'border-l-4 border-l-red-500',
  medium: 'border-l-4 border-l-amber-400',
  low: 'border-l-4 border-l-green-500',
};

interface StoryCardProps {
  story: UserStory;
  /** 所属旅程名（展示在其上） */
  journeyName?: string;
  /** 点击打开详情（可选，传则整卡可点击） */
  onClick?: (story: UserStory) => void;
  className?: string;
}

export function StoryCard({ story, journeyName, onClick, className }: StoryCardProps) {
  const tasks = story.tasks ?? [];
  const totalTasks = tasks.length;
  const doneTasks = tasks.filter((t) => t.status === 'done').length;
  const progressPct = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : null;

  return (
    <Card
      onClick={onClick ? () => onClick(story) : undefined}
      className={cn(
        'w-full transition-all duration-150',
        onClick && 'cursor-pointer hover:-translate-y-0.5 hover:shadow-md',
        priorityBorder[story.priority] ?? 'border-l-4 border-l-transparent',
        className
      )}
    >
      <CardContent className="space-y-2 p-3">
        {/* 行 1：ID + 优先级标签 + 状态 */}
        <div className="flex items-center justify-between gap-1">
          <div className="flex min-w-0 items-center gap-1.5">
            <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
              {story.id}
            </span>
            <span
              className={cn(
                'shrink-0 text-[10px] font-semibold',
                story.priority === 'high' && 'text-red-600',
                story.priority === 'medium' && 'text-amber-600',
                story.priority === 'low' && 'text-gray-500'
              )}
            >
              {story.priority === 'high'
                ? '高'
                : story.priority === 'medium'
                  ? '中'
                  : '低'}
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
        <p className="line-clamp-2 text-sm font-medium leading-snug">{story.title}</p>

        {/* 行 3：旅程名 */}
        {journeyName && (
          <p className="truncate text-[11px] text-muted-foreground">{journeyName}</p>
        )}

        {/* meta 信息 */}
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
  );
}