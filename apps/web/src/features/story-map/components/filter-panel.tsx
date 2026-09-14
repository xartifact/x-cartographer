'use client';

/**
 * 筛选面板组件
 */

import { memo, useState } from 'react';
import { Search, FilterX, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@x-cartographer/ui';
import { Input } from '@x-cartographer/ui';
import { Checkbox } from '@x-cartographer/ui';
import { Badge } from '@x-cartographer/ui';
import { Card, CardContent, CardHeader, CardTitle } from '@x-cartographer/ui';
import { Separator } from '@x-cartographer/ui';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@x-cartographer/ui';
import { useStoryMapStore } from '../stores/story-map-store';
import { Priority, StoryStatus, PRIORITY_CONFIG, PRIORITY_COLOR_VARIANTS } from '@/types';
import type { UserActivity } from '@/types';
import { STORY_STATUS_OPTIONS } from '@/features/tasks/components/status-badge';
import { cn } from '@/lib/utils';

interface FilterPanelProps {
  activities: UserActivity[];
  /** 版本（里程碑）列表，用于按版本筛选 */
  milestones?: Array<{ id: string; name: string; status: string }>;
  className?: string;
}

const priorityOptions = Object.values(PRIORITY_CONFIG).map((config) => ({
  value: config.value as Priority,
  label: `${config.label}优先级`,
  color: PRIORITY_COLOR_VARIANTS[config.color].text,
}));
export const FilterPanel = memo<FilterPanelProps>(({ activities, milestones = [], className }) => {
  const {
    filter,
    setSearchQuery,
    setPriorityFilter,
    setActivityFilter,
    setStatusFilter,
    setMilestoneFilter,
    resetFilter,
  } = useStoryMapStore();

  const [isPriorityOpen, setIsPriorityOpen] = useState(true);
  const [isStatusOpen, setIsStatusOpen] = useState(true);
  const [isActivityOpen, setIsActivityOpen] = useState(true);
  const [isMilestoneOpen, setIsMilestoneOpen] = useState(false);

  const activeFilterCount =
    filter.priorities.length +
    filter.activityIds.length +
    filter.statuses.length +
    filter.milestoneIds.length +
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

  const handleActivityChange = (activityId: string, checked: boolean | string) => {
    if (checked) {
      setActivityFilter([...filter.activityIds, activityId]);
    } else {
      setActivityFilter(filter.activityIds.filter((id) => id !== activityId));
    }
  };

  const handleMilestoneChange = (milestoneId: string, checked: boolean | string) => {
    if (checked) {
      setMilestoneFilter([...filter.milestoneIds, milestoneId]);
    } else {
      setMilestoneFilter(filter.milestoneIds.filter((id) => id !== milestoneId));
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

        {/* 活动筛选 */}
        <Collapsible open={isActivityOpen} onOpenChange={setIsActivityOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="w-full justify-between p-0">
              <span className="text-sm font-medium">用户活动</span>
              {isActivityOpen ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-2 space-y-2 max-h-48 overflow-y-auto">
            {activities.length === 0 ? (
              <p className="text-sm text-muted-foreground">暂无活动</p>
            ) : (
              activities.map((activity) => (
                <div
                  key={activity.id}
                  className="flex items-center space-x-2"
                >
                  <Checkbox
                    id={`activity-${activity.id}`}
                    checked={filter.activityIds.includes(activity.id)}
                    onCheckedChange={(checked) => handleActivityChange(activity.id, checked)}
                  />
                  <label
                    htmlFor={`activity-${activity.id}`}
                    className="text-sm cursor-pointer truncate"
                    title={activity.name}
                  >
                    {activity.name}
                  </label>
                  <Badge variant="outline" className="text-xs ml-auto">
                    {activity.stories?.length || 0}
                  </Badge>
                </div>
              ))
            )}
          </CollapsibleContent>
        </Collapsible>

        <Separator />

        {/* 发布筛选 */}
        <Collapsible open={isMilestoneOpen} onOpenChange={setIsMilestoneOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="w-full justify-between p-0">
              <span className="text-sm font-medium">版本</span>
              {isMilestoneOpen ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-2 space-y-2 max-h-48 overflow-y-auto">
            {milestones.length === 0 ? (
              <p className="text-sm text-muted-foreground">暂无发布</p>
            ) : (
              <>
                {/* 未排期选项 */}
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="milestone-unplanned"
                    checked={filter.milestoneIds.includes('unplanned')}
                    onCheckedChange={(checked) => handleMilestoneChange('unplanned', checked)}
                  />
                  <label htmlFor="milestone-unplanned" className="text-sm cursor-pointer">
                    未排期
                  </label>
                </div>
                {milestones.map((milestone) => (
                  <div key={milestone.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`milestone-${milestone.id}`}
                      checked={filter.milestoneIds.includes(milestone.id)}
                      onCheckedChange={(checked) => handleMilestoneChange(milestone.id, checked)}
                    />
                    <label
                      htmlFor={`milestone-${milestone.id}`}
                      className="text-sm cursor-pointer truncate"
                      title={milestone.name}
                    >
                      {milestone.name}
                    </label>
                  </div>
                ))}
              </>
            )}
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
});

FilterPanel.displayName = 'FilterPanel';