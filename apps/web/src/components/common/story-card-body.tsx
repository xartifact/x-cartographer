/**
 * 故事卡片内容体（ID+优先级+状态 / 标题 / 活动名 / 工时+标签+任务进度）
 *
 * 原本在 story-map 的 StoryNode（xyflow 节点）与 roadmap 的 StoryCard（纯展示卡片）里
 * 各自维护一份几乎相同的渲染 JSX——StoryNode 因为深度耦合 xyflow 的 Handle/NodeProps
 * 无法直接复用 StoryCard，但两者的"卡片内容"本该是同一份。这里只抽出内容体，外层的
 * <Card>/<Handle> 壳仍由各自调用方决定。
 */

import { Clock, Tag, CheckSquare } from 'lucide-react';
import { StatusBadge } from '@/features/tasks/components/status-badge';
import { PriorityText } from '@/components/common/priority-badge';
import type { UserStory } from '@/types';

/**
 * 卡片上的 ID 展示形式：短标识（如 US-015）原样保留；
 * 长 nanoid（21 字符，历史数据）截为前 8 位 + 省略号，完整值由 title 提供。
 */
export function shortStoryId(id: string): string {
  return id.length <= 12 ? id : `${id.slice(0, 8)}…`;
}

export function StoryCardBody({
  story,
  activityName,
  userTaskName,
  /** 标题截断（line-clamp-2）。PatronCanvas 变高卡片传 false：高度由文本测量预算，标题完整渲染 */
  clampTitle = true,
}: {
  story: UserStory;
  activityName?: string;
  userTaskName?: string;
  clampTitle?: boolean;
}) {
  const tasks = story.dev_tasks ?? [];
  const totalTasks = tasks.length;
  const doneTasks = tasks.filter((t) => t.status === 'done').length;
  const progressPct = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : null;

  return (
    <div className="space-y-2">
      {/* 行 1：ID + 优先级标签 + 状态 */}
      <div className="flex items-center justify-between gap-1">
        <div className="flex min-w-0 flex-1 items-center gap-1.5">
          {/* ID 展示：短 ID（US-015）原样；长 nanoid（21 字符）显示前 8 位——
              完整值悬浮可见，避免随机串截断成无意义碎片又遮挡状态徽章 */}
          <span
            className="min-w-0 truncate font-mono text-[10px] text-muted-foreground"
            title={story.id}
          >
            {shortStoryId(story.id)}
          </span>
          <PriorityText value={story.priority} className="shrink-0 text-[10px]" />
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
      {/* 行 2：标题（clampTitle=false 时完整渲染——高度已由文本测量预算） */}
      <p className={clampTitle ? 'line-clamp-2 text-sm font-medium leading-snug' : 'text-sm font-medium leading-snug'}>{story.title}</p>

      {/* 行 3：用户任务 › 活动归属链 */}
      <p className="truncate text-[11px] text-muted-foreground">
        {userTaskName ? `${userTaskName} › ` : ''}
        {activityName}
      </p>

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
            className={`h-full rounded-full transition-all duration-300 ${
              progressPct === 100 ? 'bg-green-500' : 'bg-primary'
            }`}
            style={{ width: `${progressPct}%` }}
          />
        </div>
      )}
    </div>
  );
}
