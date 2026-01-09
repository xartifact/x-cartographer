'use client';

/**
 * 故事节点组件
 */

import { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Clock, Tag } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import type { StoryNodeData } from '../types';
import { Priority } from '@/types';
import { UserStory } from '@/types/user-story';

const priorityColors: Record<Priority, string> = {
  [Priority.HIGH]: 'bg-red-100 border-red-300 text-red-800 dark:bg-red-900/30 dark:border-red-700 dark:text-red-300',
  [Priority.MEDIUM]: 'bg-amber-100 border-amber-300 text-amber-800 dark:bg-amber-900/30 dark:border-amber-700 dark:text-amber-300',
  [Priority.LOW]: 'bg-green-100 border-green-300 text-green-800 dark:bg-green-900/30 dark:border-green-700 dark:text-green-300',
};

const priorityBadgeVariants: Record<Priority, 'destructive' | 'default' | 'secondary'> = {
  [Priority.HIGH]: 'destructive',
  [Priority.MEDIUM]: 'default',
  [Priority.LOW]: 'secondary',
};

export const StoryNode = memo<NodeProps<StoryNodeData>>(({ data, selected }) => {
  const { story, journeyName, isSelected } = data;

  const handleClick = () => {
    if (data.onSelect) {
      data.onSelect(story);
    }
  };

  return (
    <>
      {/* 连接线 - 顶部 */}
      <Handle
        type="target"
        position={Position.Top}
        className="!w-2 !h-2 !bg-muted-foreground/50"
      />

      <Card
        className={cn(
          'w-64 cursor-pointer transition-all duration-200',
          'hover:shadow-md hover:scale-[1.02]',
          selected || isSelected
            ? 'ring-2 ring-primary shadow-md'
            : 'border-border',
          priorityColors[story.priority]
        )}
        onClick={handleClick}
      >
        <CardContent className="p-3 space-y-2">
          {/* 标题行 */}
          <div className="flex items-start justify-between gap-2">
            <span className="text-xs font-mono text-muted-foreground">
              {story.id}
            </span>
            <Badge variant={priorityBadgeVariants[story.priority]} className="text-xs">
              {story.priority}
            </Badge>
          </div>

          {/* 故事标题 */}
          <h4 className="text-sm font-medium line-clamp-2 leading-snug">
            {story.title}
          </h4>

          {/* 旅程名称 */}
          <p className="text-xs text-muted-foreground truncate">
            {journeyName}
          </p>

          {/* 底部信息 */}
          <div className="flex items-center justify-between pt-1">
            {/* 估算工时 */}
            {story.estimation > 0 && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                <span>{story.estimation}h</span>
              </div>
            )}

            {/* 标签 */}
            {story.tags && story.tags.length > 0 && (
              <div className="flex items-center gap-1">
                <Tag className="h-3 w-3 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">
                  {story.tags.length}
                </span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 连接线 - 底部 */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-2 !h-2 !bg-muted-foreground/50"
      />
    </>
  );
});

StoryNode.displayName = 'StoryNode';

/**
 * 旅程头节点组件
 */
export const JourneyHeaderNode = memo<NodeProps<{ journeyName: string; storyCount: number }>>(
  ({ data }) => {
    const { journeyName, storyCount } = data;

    return (
      <div className="flex items-center justify-center">
        <Card className="w-64 bg-primary/5 border-primary/20">
          <CardContent className="p-4 text-center">
            <h3 className="font-semibold text-sm line-clamp-2">{journeyName}</h3>
            <p className="text-xs text-muted-foreground mt-1">
              {storyCount} 个故事
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }
);

JourneyHeaderNode.displayName = 'JourneyHeaderNode';

/**
 * 空状态节点
 */
export const EmptyNode = () => {
  return (
    <div className="w-64 h-24 flex items-center justify-center">
      <p className="text-sm text-muted-foreground italic">暂无故事</p>
    </div>
  );
};