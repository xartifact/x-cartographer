/**
 * 用户旅程列表组件
 */

'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight, BookOpen } from 'lucide-react';
import { Badge, Card, CardContent, CardHeader, CardTitle } from '@x-cartographer/ui';
import { UserJourney } from '@/types';
import { StoryCard } from './story-card';
import { cn } from '@/lib/utils';

interface JourneyListProps {
  journeys: UserJourney[];
}

export function JourneyList({ journeys }: JourneyListProps) {
  const [expandedJourneys, setExpandedJourneys] = useState<Set<string>>(new Set());

  const toggleJourney = (journeyId: string) => {
    setExpandedJourneys((prev) => {
      const next = new Set(prev);
      if (next.has(journeyId)) {
        next.delete(journeyId);
      } else {
        next.add(journeyId);
      }
      return next;
    });
  };

  const expandAll = () => {
    setExpandedJourneys(new Set(journeys.map((j) => j.id)));
  };

  const collapseAll = () => {
    setExpandedJourneys(new Set());
  };

  if (journeys.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <BookOpen className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-muted-foreground">暂无用户旅程</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">用户旅程列表</h3>
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
        {journeys.map((journey) => {
          const isExpanded = expandedJourneys.has(journey.id);
          const storyCount = journey.stories?.length || 0;

          return (
            <Card
              key={journey.id}
              className={cn(
                'transition-all duration-200',
                isExpanded && 'ring-2 ring-primary'
              )}
            >
              <CardHeader
                className="cursor-pointer hover:bg-muted/50 transition-colors p-3"
                onClick={() => toggleJourney(journey.id)}
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
                        {journey.name}
                      </CardTitle>
                      <p className="text-xs text-muted-foreground truncate">
                        目标用户: {journey.persona}
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
                  {journey.description && (
                    <p className="text-sm text-muted-foreground mb-3 pl-6">
                      {journey.description}
                    </p>
                  )}
                  <div className="space-y-2 pl-6">
                    {storyCount > 0 ? (
                      journey.stories?.map((story) => (
                        <StoryCard
                          key={story.id}
                          story={story}
                          journeyName={journey.name}
                        />
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        该旅程下暂无用户故事
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