'use client';

/**
 * 故事节点组件
 */

import { memo } from 'react';
import { Handle, Position, NodeProps, type Node } from '@xyflow/react';
import { GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@x-cartographer/ui';
import { priorityLeftBorderCls } from '@/components/common/priority-badge';
import { StoryCardBody } from '@/components/common/story-card-body';
import type { StoryNodeData } from '../types';

export const StoryNode = memo<NodeProps<Node<Record<string, unknown>> & { data: StoryNodeData }>>(
  ({ data, selected }) => {
    const { story, activityName, userTaskName, tier, isSelected } = data;

    // Patton 纵向重要性：head=走查线（强），body=主体，tail=细化（渐弱）
    const tierCls =
      tier === 'head'
        ? 'ring-1 ring-primary/40 shadow-[0_2px_10px_rgba(59,130,246,0.12)]'
        : tier === 'tail'
          ? 'opacity-80 shadow-none'
          : '';

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
            tierCls,
            'border-l-4',
            // 增加左侧内边距以容纳拖拽手柄
            'pl-6'
          )}
        >
          <CardContent className="p-3">
            <StoryCardBody story={story} activityName={activityName} userTaskName={userTaskName} />
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
export const ActivityHeaderNode = memo<
  NodeProps<Node<Record<string, unknown>> & { data: { activityName: string; storyCount: number } }>
>(({ data }) => {
  const { activityName, storyCount } = data;
  return (
    <div className="flex items-center justify-center">
      <Card className="w-60 border-primary/20 bg-primary/5">
        <CardContent className="p-4 text-center">
          <h3 className="line-clamp-2 text-sm font-semibold">{activityName}</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {storyCount} 个故事
          </p>
        </CardContent>
      </Card>
    </div>
  );
});

ActivityHeaderNode.displayName = 'ActivityHeaderNode';

/**
 * 空状态节点
 */
export const EmptyNode = () => (
  <div className="flex h-20 w-60 items-center justify-center">
    <p className="text-sm italic text-muted-foreground">暂无故事</p>
  </div>
);
