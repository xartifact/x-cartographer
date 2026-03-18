/**
 * 状态筛选器组件
 *
 * 支持单选和多选的状态筛选
 */

'use client';

import * as React from 'react';
import { Filter, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { StatusBadge, TASK_STATUS_OPTIONS, STORY_STATUS_OPTIONS } from './status-badge';
import type { TaskStatus, StoryStatus } from '@/types';

export interface StatusFilterProps {
  /** 当前选中的状态列表 */
  selectedStatuses: (TaskStatus | StoryStatus)[];

  /** 状态变更回调 */
  onStatusChange: (statuses: (TaskStatus | StoryStatus)[]) => void;

  /** 是否为任务筛选 */
  isTask?: boolean;

  /** 筛选模式：'single' | 'multiple' */
  mode?: 'single' | 'multiple';

  /** 禁用状态 */
  disabled?: boolean;

  /** 占位文字 */
  placeholder?: string;

  /** 是否显示"全部"选项 */
  showAllOption?: boolean;

  /** 允许的状态列表（空数组表示全部） */
  allowedStatuses?: (TaskStatus | StoryStatus)[];

  /** 是否显示快捷筛选按钮 */
  showQuickFilters?: boolean;

  /** 自定义类名 */
  className?: string;

  /** 触发器类名 */
  triggerClassName?: string;
}

/**
 * 状态筛选器组件
 */
export function StatusFilter({
  selectedStatuses,
  onStatusChange,
  isTask = true,
  mode = 'multiple',
  disabled = false,
  placeholder = '筛选状态...',
  showAllOption = true,
  allowedStatuses = [],
  showQuickFilters = true,
  className,
  triggerClassName,
}: StatusFilterProps) {
  const [open, setOpen] = React.useState(false);

  // 获取状态选项
  const allOptions = isTask ? TASK_STATUS_OPTIONS : STORY_STATUS_OPTIONS;

  // 过滤允许的状态
  const options =
    allowedStatuses.length > 0
      ? allOptions.filter((opt) => allowedStatuses.includes(opt.value as TaskStatus | StoryStatus))
      : allOptions;

  // 选中状态的数量
  const selectedCount = selectedStatuses.length;
  const isAllSelected = selectedCount === options.length;
  const isEmpty = selectedCount === 0;

  // 切换单个状态
  const toggleStatus = (status: TaskStatus | StoryStatus) => {
    if (mode === 'single') {
      // 单选模式：直接设置为该状态
      onStatusChange([status]);
    } else {
      // 多选模式：切换状态
      const newStatuses = selectedStatuses.includes(status)
        ? selectedStatuses.filter((s) => s !== status)
        : [...selectedStatuses, status];
      onStatusChange(newStatuses);
    }
  };

  // 全选/取消全选
  const toggleAll = () => {
    if (isAllSelected) {
      onStatusChange([]);
    } else {
      onStatusChange(options.map((opt) => opt.value) as (TaskStatus | StoryStatus)[]);
    }
  };

  // 清除筛选
  const clearFilter = () => {
    onStatusChange([]);
  };

  // 快捷筛选
  const quickFilters = showQuickFilters
    ? [
        { label: '进行中', statuses: ['in_progress', 'in_review', 'testing'] as (TaskStatus | StoryStatus)[] },
        { label: '已完成', statuses: ['done' as TaskStatus | StoryStatus] },
        { label: '未开始', statuses: ['backlog', 'todo'] as (TaskStatus | StoryStatus)[] },
      ]
    : [];

  // 触发器显示文本
  const triggerText = isEmpty
    ? placeholder
    : mode === 'single'
    ? allOptions.find((opt) => opt.value === selectedStatuses[0])?.label || placeholder
    : `${selectedCount} 个状态`;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          disabled={disabled}
          className={cn(
            'min-w-[120px] justify-between gap-1',
            !isEmpty && 'border-primary/50 bg-primary/5',
            triggerClassName
          )}
        >
          <span className="flex items-center gap-1">
            <Filter className="h-4 w-4" />
            {triggerText}
          </span>
          {!isEmpty && (
            <X
              className="h-3 w-3 opacity-50 hover:opacity-100"
              onClick={(e) => {
                e.stopPropagation();
                clearFilter();
              }}
            />
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent align="start" className="w-64 p-3">
        <div className="space-y-3">
          {/* 标题 */}
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">按状态筛选</span>
            {!isEmpty && (
              <Button variant="ghost" size="sm" onClick={clearFilter} className="h-6 px-2 text-xs">
                清除
              </Button>
            )}
          </div>

          {/* 快捷筛选 */}
          {showQuickFilters && quickFilters.length > 0 && (
            <>
              <div className="flex flex-wrap gap-1">
                {quickFilters.map((filter) => (
                  <Button
                    key={filter.label}
                    variant="secondary"
                    size="sm"
                    className="h-6 px-2 text-xs"
                    onClick={() => onStatusChange(filter.statuses)}
                  >
                    {filter.label}
                  </Button>
                ))}
              </div>
              <Separator />
            </>
          )}

          {/* 全部选项 */}
          {showAllOption && mode === 'multiple' && (
            <label className="flex items-center gap-2 cursor-pointer hover:bg-accent p-1 rounded">
              <Checkbox
                checked={isAllSelected}
                onCheckedChange={toggleAll}
              />
              <span className="text-sm">全部</span>
            </label>
          )}

          {/* 状态列表 */}
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {options.map((option) => {
              const isSelected = selectedStatuses.includes(option.value as TaskStatus | StoryStatus);

              return (
                <label
                  key={option.value}
                  className={cn(
                    'flex items-center gap-2 cursor-pointer rounded px-2 py-1.5 hover:bg-accent',
                    isSelected && 'bg-primary/5'
                  )}
                >
                  {mode === 'multiple' ? (
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggleStatus(option.value as TaskStatus | StoryStatus)}
                    />
                  ) : (
                    <input
                      type="radio"
                      checked={isSelected}
                      onChange={() => toggleStatus(option.value as TaskStatus | StoryStatus)}
                      className="h-4 w-4 text-primary"
                    />
                  )}
                  <StatusBadge
                    status={option.value as TaskStatus | StoryStatus}
                    isTask={isTask}
                    size="sm"
                  />
                  <span className="text-sm">{option.label}</span>
                </label>
              );
            })}
          </div>

          {/* 多选时的应用按钮 */}
          {mode === 'multiple' && (
            <div className="pt-2 border-t">
              <Button
                className="w-full"
                size="sm"
                onClick={() => setOpen(false)}
              >
                应用筛选 ({selectedCount})
              </Button>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/**
 * 状态筛选标签（已选中的筛选条件显示为标签）
 */
export function StatusFilterTags({
  selectedStatuses,
  onRemove,
  isTask = true,
  className,
}: {
  selectedStatuses: (TaskStatus | StoryStatus)[];
  onRemove: (status: TaskStatus | StoryStatus) => void;
  isTask?: boolean;
  className?: string;
}) {
  if (selectedStatuses.length === 0) {
    return null;
  }

  const options = isTask ? TASK_STATUS_OPTIONS : STORY_STATUS_OPTIONS;

  return (
    <div className={cn('flex flex-wrap gap-1', className)}>
      {selectedStatuses.map((status) => {
        const option = options.find((opt) => opt.value === status);
        if (!option) return null;

        return (
          <StatusBadge
            key={status}
            status={status}
            isTask={isTask}
            size="sm"
            className="cursor-pointer pr-1"
            onClick={() => onRemove(status)}
          >
            <span className="flex items-center gap-1">
              {option.label}
              <X
                className="h-3 w-3 hover:opacity-70"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove(status);
                }}
              />
            </span>
          </StatusBadge>
        );
      })}
    </div>
  );
}

/**
 * 状态筛选栏（组合筛选器和标签）
 */
export function StatusFilterBar({
  selectedStatuses,
  onStatusChange,
  isTask = true,
  mode = 'multiple',
  disabled = false,
  placeholder,
  className,
}: StatusFilterProps & { className?: string }) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <StatusFilter
        selectedStatuses={selectedStatuses}
        onStatusChange={onStatusChange}
        isTask={isTask}
        mode={mode}
        disabled={disabled}
        placeholder={placeholder}
      />
      <StatusFilterTags
        selectedStatuses={selectedStatuses}
        onRemove={(status) => {
          const newStatuses = selectedStatuses.filter((s) => s !== status);
          onStatusChange(newStatuses);
        }}
        isTask={isTask}
      />
    </div>
  );
}