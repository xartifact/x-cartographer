/**
 * 状态选择弹出组件
 *
 * 用于在任务卡片或故事卡片上切换状态的弹出选择器
 */

'use client';

import * as React from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { StatusIndicator, TASK_STATUS_OPTIONS, STORY_STATUS_OPTIONS } from './status-badge';
import { TaskStatus, type StoryStatus } from '@/types';

export interface StatusSelectProps {
  /** 当前状态 */
  status: TaskStatus | StoryStatus;

  /** 状态变更回调 */
  onStatusChange: (newStatus: TaskStatus | StoryStatus) => void;

  /** 是否为任务 */
  isTask?: boolean;

  /** 是否禁用 */
  disabled?: boolean;

  /** 按钮变体 */
  variant?: 'default' | 'outline' | 'ghost';

  /** 按钮尺寸 */
  size?: 'sm' | 'lg' | 'icon';

  /** 是否显示标签文字 */
  showLabel?: boolean;

  /** 是否显示状态指示器 */
  showIndicator?: boolean;

  /** 允许的状态列表（空数组表示全部） */
  allowedStatuses?: (TaskStatus | StoryStatus)[];

  /** 自定义类名 */
  className?: string;

  /** 触发器按钮类名 */
  triggerClassName?: string;
}

/**
 * 状态选择组件
 */
export function StatusSelect({
  status,
  onStatusChange,
  isTask = true,
  disabled = false,
  variant = 'outline',
  size = 'sm',
  showLabel = true,
  showIndicator = true,
  allowedStatuses = [],
  className: _className,
  triggerClassName,
}: StatusSelectProps) {
  // 使用正确的 Button size 类型
  const buttonSize = size === 'sm' ? 'sm' : size === 'lg' ? 'lg' : 'sm';
  // 获取状态选项
  const options = isTask ? TASK_STATUS_OPTIONS : STORY_STATUS_OPTIONS;

  // 过滤允许的状态
  const filteredOptions =
    allowedStatuses.length > 0
      ? options.filter((opt) => allowedStatuses.includes(opt.value as TaskStatus | StoryStatus))
      : options;

  // 查找当前状态配置
  const currentOption = options.find((opt) => opt.value === status);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild disabled={disabled}>
        <Button
          variant={variant}
          size={buttonSize}
          className={cn(
            'h-auto min-w-[80px] justify-between gap-1 px-2',
            triggerClassName
          )}
        >
          {showIndicator && (
            <StatusIndicator status={status} isTask={isTask} size={size === 'sm' ? 'sm' : 'md'} />
          )}
          {showLabel && <span>{currentOption?.label || status}</span>}
          {!disabled && <ChevronDown className="h-3 w-3 shrink-0 opacity-50" />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48">
        <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
          选择状态
        </div>
        <DropdownMenuSeparator />
        {filteredOptions.map((option) => (
          <DropdownMenuItem
            key={option.value}
            onClick={() => onStatusChange(option.value as TaskStatus | StoryStatus)}
            className="flex items-center gap-2 px-2 py-1.5"
          >
            <StatusIndicator
              status={option.value as TaskStatus | StoryStatus}
              isTask={isTask}
              size="sm"
            />
            <span className="flex-1">{option.label}</span>
            {status === option.value && (
              <Check className="h-4 w-4 text-primary" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * 迷你状态选择器（用于表格行等紧凑场景）
 */
export function StatusSelectMini({
  status,
  onStatusChange,
  isTask = true,
  disabled = false,
  className,
}: Omit<StatusSelectProps, 'variant' | 'size' | 'showLabel' | 'showIndicator'>) {
  return (
    <StatusSelect
      status={status}
      onStatusChange={onStatusChange}
      isTask={isTask}
      disabled={disabled}
      variant="ghost"
      size="sm"
      showLabel={true}
      showIndicator={true}
      className={cn('min-w-[60px]', className)}
    />
  );
}

/**
 * 状态切换按钮（直接在原位置更新状态）
 *
 * 适用于简单的状态循环切换场景
 */
export interface StatusToggleProps {
  /** 当前状态 */
  status: TaskStatus | StoryStatus;

  /** 状态变更回调 */
  onStatusChange: (newStatus: TaskStatus | StoryStatus) => void;

  /** 是否为任务 */
  isTask?: boolean;

  /** 禁用状态 */
  disabled?: boolean;

  /** 循环切换的状态序列 */
  cycleStatuses?: (TaskStatus | StoryStatus)[];

  /** 自定义类名 */
  className?: string;
}

/**
 * 常见状态循环（任务）
 */
const TASK_STATUS_CYCLE: TaskStatus[] = [
  TaskStatus.TODO,
  TaskStatus.IN_PROGRESS,
  TaskStatus.DONE,
];

/**
 * 常见状态循环（故事）
 */
const STORY_STATUS_CYCLE: StoryStatus[] = ['todo', 'in_progress', 'done'];

/**
 * 状态切换按钮
 */
export function StatusToggle({
  status,
  onStatusChange,
  isTask = true,
  disabled = false,
  cycleStatuses,
  className,
}: StatusToggleProps) {
  const statusCycle = cycleStatuses || (isTask ? TASK_STATUS_CYCLE : STORY_STATUS_CYCLE);

  // 查找当前状态在循环中的位置
  const currentIndex = statusCycle.indexOf(status as TaskStatus | StoryStatus);

  // 计算下一个状态
  const nextIndex = (currentIndex + 1) % statusCycle.length;
  const nextStatus = statusCycle[nextIndex];

  // 获取状态配置
  const options = isTask ? TASK_STATUS_OPTIONS : STORY_STATUS_OPTIONS;
  const currentOption = options.find((opt) => opt.value === status);
  const nextOption = options.find((opt) => opt.value === nextStatus);

  const handleClick = () => {
    if (!disabled) {
      onStatusChange(nextStatus);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={disabled}
      className={cn(
        'inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium transition-colors',
        'hover:opacity-80 disabled:opacity-50',
        {
          'bg-gray-100 text-gray-800': status === 'backlog' || status === 'todo',
          'bg-blue-100 text-blue-800': status === 'in_progress' || status === 'testing' || status === 'in_review',
          'bg-green-100 text-green-800': status === 'done',
          'bg-red-100 text-red-800': status === 'cancelled',
        },
        className
      )}
      title={`点击切换到: ${nextOption?.label || nextStatus}`}
    >
      <StatusIndicator status={status} isTask={isTask} size="sm" />
      {currentOption?.label || status}
    </button>
  );
}