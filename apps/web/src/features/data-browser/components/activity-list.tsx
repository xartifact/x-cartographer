/**
 * 用户活动列表组件
 */

'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight, LayoutList } from 'lucide-react';
import { Badge, Card, CardContent, CardHeader, CardTitle } from '@x-cartographer/ui';
import { UserActivity } from '@/types';
import { StoryCard } from './story-card';
import { cn } from '@/lib/utils';

interface ActivityListProps {
  activities: UserActivity[];
}

export function ActivityList({ activities }: ActivityListProps) {
  const [expandedActivities, setExpandedActivities] = useState<Set<string>>(new Set());

  const toggleActivity = (activityId: string) => {
    setExpandedActivities((prev) => {
      const next = new Set(prev);
      if (next.has(activityId)) {
        next.delete(activityId);
      } else {
        next.add(activityId);
      }
      return next;
    });
  };

  const expandAll = () => {
    setExpandedActivities(new Set(activities.map((a) => a.id)));
  };

  const collapseAll = () => {
    setExpandedActivities(new Set());
  };

  if (activities.length === 0) {
    return (
      <Card>
        <CardContent className="flex h-40 items-center justify-center text-sm text-muted-foreground">
          暂无用户活动
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">用户活动列表</h3>
        <div className="flex gap-2">
          <button
            onClick={expandAll}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            全部展开
          </button>
          <span className="text-muted-foreground">|</span>
          <button
            onClick={collapseAll}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            全部折叠
          </button>
        </div>
      </div>
      <div className="space-y-3">
        {activities.map((activity) => {
          const isExpanded = expandedActivities.has(activity.id);
          const storyCount = activity.stories?.length || 0;

          return (
            <Card
              key={activity.id}
              className={cn(
                'transition-all duration-200',
                isExpanded && 'ring-2 ring-primary'
              )}
            >
              <CardHeader
                className="cursor-pointer hover:bg-muted/50 transition-colors p-3"
                onClick={() => toggleActivity(activity.id)}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                    )}
                    <div className="min-w-0">
                      <CardTitle className="text-base font-medium truncate">
                        {activity.name}
                      </CardTitle>
                      <p className="text-xs text-muted-foreground truncate">
                        序号: {activity.order}
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline" className="shrink-0">
                    {storyCount} 个故事
                  </Badge>
                </div>
              </CardHeader>
              {isExpanded && (
                <CardContent className="p-3 pt-0 border-t">
                  {activity.description && (
                    <p className="text-sm text-muted-foreground mb-3 pl-6">
                      {activity.description}
                    </p>
                  )}
                  <div className="space-y-2 pl-6">
                    {storyCount > 0 ? (
                      activity.stories?.map((story) => (
                        <StoryCard
                          key={story.id}
                          story={story}
                          activityName={activity.name}
                        />
                      ))
                    ) : (
                      <p className="flex items-center justify-center gap-1 py-4 text-sm text-muted-foreground">
                        <LayoutList className="h-3 w-3" />
                        该活动下暂无用户故事
                      </p>
                    )}
                  </div>
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
