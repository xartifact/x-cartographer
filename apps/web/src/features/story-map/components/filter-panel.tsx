'use client';

/**
 * 筛选面板组件
 */

import { memo, useState } from 'react';
import { Search, FilterX, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@xpm/ui';
import { Input } from '@xpm/ui';
import { Checkbox } from '@xpm/ui';
import { Badge } from '@xpm/ui';
import { Card, CardContent, CardHeader, CardTitle } from '@xpm/ui';
import { Separator } from '@xpm/ui';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@xpm/ui';
import { useStoryMapStore } from '../stores/story-map-store';
import { Priority, StoryStatus } from '@/types';
import { UserJourney } from '@/types/user-journey';
import { STORY_STATUS_OPTIONS } from '@/features/tasks/components/status-badge';
import { cn } from '@/lib/utils';

interface FilterPanelProps {
  journeys: UserJourney[];
  className?: string;
}

const priorityOptions = [
  { value: Priority.HIGH, label: '高优先级', color: 'text-red-600 dark:text-red-400' },
  { value: Priority.MEDIUM, label: '中优先级', color: 'text-amber-600 dark:text-amber-400' },
  { value: Priority.LOW, label: '低优先级', color: 'text-green-600 dark:text-green-400' },
];

export const FilterPanel = memo<FilterPanelProps>(({ journeys, className }) => {
  const {
    filter,
    setSearchQuery,
    setPriorityFilter,
    setJourneyFilter,
    setStatusFilter,
    resetFilter,
  } = useStoryMapStore();

  const [isPriorityOpen, setIsPriorityOpen] = useState(true);
  const [isStatusOpen, setIsStatusOpen] = useState(true);
  const [isJourneyOpen, setIsJourneyOpen] = useState(true);

  const activeFilterCount =
    filter.priorities.length +
    filter.journeyIds.length +
    filter.statuses.length +
    (filter.searchQuery ? 1 : 0);

  const handlePriorityChange = (priority: Priority, checked: boolean | string) => {
    if (checked) {
      setPriorityFilter([...filter.priorities, priority]);
    } else {
      setPriorityFilter(filter.priorities.filter((p) => p !== priority));
    }
  };

  const handleStatusChange = (status: StoryStatus, checked: boolean | string) => {
    if (checked) {
      setStatusFilter([...filter.statuses, status]);
    } else {
      setStatusFilter(filter.statuses.filter((s) => s !== status));
    }
  };

  const handleJourneyChange = (journeyId: string, checked: boolean | string) => {
    if (checked) {
      setJourneyFilter([...filter.journeyIds, journeyId]);
    } else {
      setJourneyFilter(filter.journeyIds.filter((id) => id !== journeyId));
    }
  };

  return (
    <Card className={cn('w-64', className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">筛选条件</CardTitle>
          {activeFilterCount > 0 && (
            <Badge variant="secondary">{activeFilterCount}</Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* 搜索框 */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="搜索故事..."
            value={filter.searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        <Separator />

        {/* 重置按钮 */}
        {activeFilterCount > 0 && (
          <Button variant="outline" size="sm" className="w-full" onClick={resetFilter}>
            <FilterX className="h-4 w-4 mr-2" />
            重置筛选
          </Button>
        )}

        {/* 优先级筛选 */}
        <Collapsible open={isPriorityOpen} onOpenChange={setIsPriorityOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="w-full justify-between p-0">
              <span className="text-sm font-medium">优先级</span>
              {isPriorityOpen ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-2 space-y-2">
            {priorityOptions.map((option) => (
              <div
                key={option.value}
                className="flex items-center space-x-2"
              >
                <Checkbox
                  id={`priority-${option.value}`}
                  checked={filter.priorities.includes(option.value)}
                  onCheckedChange={(checked) => handlePriorityChange(option.value, checked)}
                />
                <label
                  htmlFor={`priority-${option.value}`}
                  className={cn('text-sm cursor-pointer', option.color)}
                >
                  {option.label}
                </label>
              </div>
            ))}
          </CollapsibleContent>
        </Collapsible>

        <Separator />

        {/* 状态筛选 */}
        <Collapsible open={isStatusOpen} onOpenChange={setIsStatusOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="w-full justify-between p-0">
              <span className="text-sm font-medium">状态</span>
              {isStatusOpen ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-2 space-y-2">
            {STORY_STATUS_OPTIONS.map((option) => (
              <div key={option.value} className="flex items-center space-x-2">
                <Checkbox
                  id={`status-${option.value}`}
                  checked={filter.statuses.includes(option.value as StoryStatus)}
                  onCheckedChange={(checked) => handleStatusChange(option.value as StoryStatus, checked)}
                />
                <span
                  className={cn(
                    'w-2 h-2 rounded-full shrink-0',
                    option.color === 'gray' && 'bg-gray-500',
                    option.color === 'slate' && 'bg-slate-500',
                    option.color === 'blue' && 'bg-blue-500',
                    option.color === 'green' && 'bg-green-500',
                    option.color === 'red' && 'bg-red-500',
                    option.color === 'yellow' && 'bg-yellow-500',
                    option.color === 'purple' && 'bg-purple-500',
                    option.color === 'orange' && 'bg-orange-500'
                  )}
                />
                <label
                  htmlFor={`status-${option.value}`}
                  className="text-sm cursor-pointer"
                >
                  {option.label}
                </label>
              </div>
            ))}
          </CollapsibleContent>
        </Collapsible>

        <Separator />

        {/* 旅程筛选 */}
        <Collapsible open={isJourneyOpen} onOpenChange={setIsJourneyOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="w-full justify-between p-0">
              <span className="text-sm font-medium">用户旅程</span>
              {isJourneyOpen ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-2 space-y-2 max-h-48 overflow-y-auto">
            {journeys.length === 0 ? (
              <p className="text-sm text-muted-foreground">暂无旅程</p>
            ) : (
              journeys.map((journey) => (
                <div
                  key={journey.id}
                  className="flex items-center space-x-2"
                >
                  <Checkbox
                    id={`journey-${journey.id}`}
                    checked={filter.journeyIds.includes(journey.id)}
                    onCheckedChange={(checked) => handleJourneyChange(journey.id, checked)}
                  />
                  <label
                    htmlFor={`journey-${journey.id}`}
                    className="text-sm cursor-pointer truncate"
                    title={journey.name}
                  >
                    {journey.name}
                  </label>
                  <Badge variant="outline" className="text-xs ml-auto">
                    {journey.stories?.length || 0}
                  </Badge>
                </div>
              ))
            )}
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
});

FilterPanel.displayName = 'FilterPanel';