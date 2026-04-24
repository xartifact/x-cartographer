'use client';

/**
 * 旅程列组件（独立版本，非 React Flow 节点）
 */

import { memo } from 'react';
import type { UserJourney, UserStory } from '@/types';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, Tag } from 'lucide-react';
import { Priority } from '@/types';

interface JourneyColumnProps {
  journey: UserJourney;
  stories: UserStory[];
  journeyName: string;
  columnWidth: number;
  rowHeight: number;
  onStorySelect: (story: UserStory) => void;
  selectedStoryId?: string;
}

// 优先级颜色
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

// 故事卡片组件
function StoryCard({ story, journeyName, isSelected, onSelect }: {
  story: UserStory;
  journeyName: string;
  isSelected: boolean;
  onSelect: (story: UserStory) => void;
}) {
  return (
    <Card
      className={cn(
        'w-64 cursor-pointer transition-all duration-200',
        'hover:shadow-md hover:scale-[1.02]',
        isSelected ? 'ring-2 ring-primary shadow-md' : 'border-border',
        priorityColors[story.priority]
      )}
      onClick={() => onSelect(story)}
    >
      <CardContent className="p-3 space-y-2">
        {/* 标题行 */}
        <div className="flex items-start justify-between gap-2">
          <span className="text-xs font-mono text-muted-foreground">{story.id}</span>
          <Badge variant={priorityBadgeVariants[story.priority]} className="text-xs">
            {story.priority}
          </Badge>
        </div>

        {/* 故事标题 */}
        <h4 className="text-sm font-medium line-clamp-2 leading-snug">{story.title}</h4>

        {/* 旅程名称 */}
        <p className="text-xs text-muted-foreground truncate">{journeyName}</p>

        {/* 底部信息 */}
        <div className="flex items-center justify-between pt-1">
          {story.estimation > 0 && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              <span>{story.estimation}h</span>
            </div>
          )}
          {story.tags && story.tags.length > 0 && (
            <div className="flex items-center gap-1">
              <Tag className="h-3 w-3 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">{story.tags.length}</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export const JourneyColumn = memo<JourneyColumnProps>(
  ({ journey: _journey, stories, journeyName, columnWidth, rowHeight, onStorySelect, selectedStoryId }) => {
    return (
      <div
        className="flex flex-col gap-4"
        style={{
          width: columnWidth,
          minHeight: Math.max(stories.length * rowHeight, 200),
        }}
      >
        {/* 旅程头 */}
        <div className="sticky top-0 z-10">
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="p-4 text-center">
              <h3 className="font-semibold text-sm line-clamp-2">{journeyName}</h3>
              <p className="text-xs text-muted-foreground mt-1">
                {stories.length} 个故事
              </p>
            </CardContent>
          </Card>
        </div>

        {/* 故事列表 */}
        <div className="flex flex-col gap-3">
          {stories.length === 0 ? (
            <div
              className="flex items-center justify-center h-24 border-2 border-dashed border-muted rounded-lg"
              style={{ height: rowHeight }}
            >
              <p className="text-sm text-muted-foreground italic">暂无故事</p>
            </div>
          ) : (
            stories.map((story) => (
              <div
                key={story.id}
                className={cn(
                  'transition-all duration-200',
                  selectedStoryId === story.id && 'ring-2 ring-primary rounded-lg'
                )}
              >
                <StoryCard
                  story={story}
                  journeyName={journeyName}
                  isSelected={selectedStoryId === story.id}
                  onSelect={onStorySelect}
                />
              </div>
            ))
          )}
        </div>
      </div>
    );
  }
);

JourneyColumn.displayName = 'JourneyColumn';