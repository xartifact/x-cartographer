'use client';

/**
 * 共享用户故事卡片（排期规划 / 故事地图统一用）
 *
 * 内容体见 StoryCardBody（与 story-map 的 PatronStoryNode 共用同一渲染体）。
 * - story-map 的节点深度耦合 xyflow（Handle/NodeProps），无法直接复用整个卡片，
 *   故这里只包一层纯展示的 Card 外壳，Roadmap 泳道/待规划池接入。
 * - onClick 可选：传入则整卡可点，配合外层 StoryDetailPanel 打开详情。
 */

import { Card, CardContent } from '@x-cartographer/ui';
import { cn } from '@/lib/utils';
import { priorityLeftBorderCls } from '@/components/common/priority-badge';
import { StoryCardBody } from '@/components/common/story-card-body';
import type { UserStory } from '@/types';

interface StoryCardProps {
  story: UserStory;
  /** 所属活动名（展示在其上） */
  activityName?: string;
  /** 点击打开详情（可选，传则整卡可点击） */
  onClick?: (story: UserStory) => void;
  className?: string;
}

export function StoryCard({ story, activityName, onClick, className }: StoryCardProps) {
  return (
    <Card
      onClick={onClick ? () => onClick(story) : undefined}
      className={cn(
        'w-full border-l-4 transition-all duration-150',
        onClick && 'cursor-pointer hover:-translate-y-0.5 hover:shadow-md',
        priorityLeftBorderCls(story.priority),
        className
      )}
    >
      <CardContent className="p-3">
        <StoryCardBody story={story} activityName={activityName} />
      </CardContent>
    </Card>
  );
}
