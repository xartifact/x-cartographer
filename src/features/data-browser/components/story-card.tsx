/**
 * 用户故事卡片组件
 */

'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight, Clock, Tag } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { UserStory } from '@/types';
import { cn } from '@/lib/utils';

interface StoryCardProps {
  story: UserStory;
  journeyName?: string;
}

const priorityConfig = {
  high: { label: '高', variant: 'destructive' as const, className: 'bg-red-500' },
  medium: { label: '中', variant: 'secondary' as const, className: 'bg-yellow-500' },
  low: { label: '低', variant: 'default' as const, className: 'bg-green-500' },
};

export function StoryCard({ story, journeyName }: StoryCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const priority = priorityConfig[story.priority] || priorityConfig.medium;

  return (
    <Card className={cn('transition-all duration-200', isExpanded && 'ring-2 ring-primary')}>
      <CardHeader
        className="cursor-pointer hover:bg-muted/50 transition-colors p-3"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {isExpanded ? (
              <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            )}
            <div className="min-w-0">
              <CardTitle className="text-sm font-medium truncate">{story.title}</CardTitle>
              {journeyName && (
                <p className="text-xs text-muted-foreground truncate">{journeyName}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Badge variant={priority.variant} className="text-xs">
              {priority.label}
            </Badge>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              {story.estimation}h
            </div>
          </div>
        </div>
      </CardHeader>
      {isExpanded && (
        <CardContent className="p-3 pt-0 border-t">
          <div className="space-y-3 pl-6">
            {story.description && (
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground mb-1">描述</h4>
                <p className="text-sm">{story.description}</p>
              </div>
            )}
            {story.acceptance_criteria && story.acceptance_criteria.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground mb-1">验收标准</h4>
                <ul className="text-sm space-y-1">
                  {story.acceptance_criteria.map((criteria, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <span className="text-muted-foreground">-</span>
                      <span>{typeof criteria === 'string' ? criteria : criteria.description}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {story.tags && story.tags.length > 0 && (
              <div className="flex items-center gap-2">
                <Tag className="h-3 w-3 text-muted-foreground" />
                <div className="flex flex-wrap gap-1">
                  {story.tags.map((tag) => (
                    <Badge key={tag} variant="outline" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  );
}