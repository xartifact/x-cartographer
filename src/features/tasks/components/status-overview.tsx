/**
 * 状态概览组件
 *
 * 在故事地图视图顶部显示各状态的统计信息
 */

'use client';

import { cn } from '@/lib/utils';
import { StatusBadge, TASK_STATUS_OPTIONS, STORY_STATUS_OPTIONS } from './status-badge';
import type { TaskStatus, StoryStatus } from '@/types';

export interface StatusOverviewProps {
  /** 各状态的数量统计 */
  counts: Record<string, number>;

  /** 实体类型 */
  entityType: 'task' | 'story';

  /** 选中的状态列表 */
  selectedStatuses?: (TaskStatus | StoryStatus)[];

  /** 状态点击回调 */
  onStatusClick?: (status: TaskStatus | StoryStatus) => void;

  /** 是否禁用交互 */
  disabled?: boolean;

  /** 显示为紧凑模式 */
  compact?: boolean;

  /** 自定义类名 */
  className?: string;
}

/**
 * 状态概览组件
 */
export function StatusOverview({
  counts,
  entityType,
  selectedStatuses = [],
  onStatusClick,
  disabled = false,
  compact = false,
  className,
}: StatusOverviewProps) {
  const options = entityType === 'task' ? TASK_STATUS_OPTIONS : STORY_STATUS_OPTIONS;

  // 计算总数
  const total = Object.values(counts).reduce((sum, count) => sum + count, 0);

  // 计算完成率
  const doneCount = counts['done'] || 0;
  const completionRate = total > 0 ? Math.round((doneCount / total) * 100) : 0;

  if (compact) {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        {/* 总数 */}
        <div className="text-sm">
          <span className="font-semibold">{total}</span>
          <span className="text-muted-foreground ml-1">项</span>
        </div>

        {/* 完成率 */}
        {total > 0 && (
          <div className="flex items-center gap-1 text-sm">
            <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500 transition-all"
                style={{ width: `${completionRate}%` }}
              />
            </div>
            <span className="text-muted-foreground">{completionRate}%</span>
          </div>
        )}

        {/* 状态分布 */}
        <div className="flex items-center gap-0.5 ml-2">
          {options.map((option) => {
            const count = counts[option.value] || 0;
            if (count === 0) return null;

            const isSelected = selectedStatuses.includes(option.value as TaskStatus | StoryStatus);

            return (
              <button
                key={option.value}
                onClick={() => onStatusClick?.(option.value as TaskStatus | StoryStatus)}
                disabled={disabled}
                className={cn(
                  'inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs transition-colors',
                  'hover:bg-accent',
                  isSelected && 'bg-primary/10',
                  disabled && 'cursor-not-allowed'
                )}
                title={`${option.label}: ${count}`}
              >
                <span
                  className={cn(
                    'w-1.5 h-1.5 rounded-full',
                    option.color === 'gray' && 'bg-gray-400',
                    option.color === 'slate' && 'bg-slate-400',
                    option.color === 'blue' && 'bg-blue-400',
                    option.color === 'green' && 'bg-green-400',
                    option.color === 'red' && 'bg-red-400',
                    option.color === 'yellow' && 'bg-yellow-400',
                    option.color === 'purple' && 'bg-purple-400',
                    option.color === 'orange' && 'bg-orange-400'
                  )}
                />
                <span className={cn(isSelected && 'font-medium')}>{count}</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className={cn('space-y-3', className)}>
      {/* 顶部统计 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="text-sm">
            <span className="text-2xl font-bold">{total}</span>
            <span className="text-muted-foreground ml-1">总数</span>
          </div>
          {total > 0 && (
            <div className="flex items-center gap-2">
              <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-500 transition-all"
                  style={{ width: `${completionRate}%` }}
                />
              </div>
              <span className="text-sm font-medium text-green-600">{completionRate}% 完成</span>
            </div>
          )}
        </div>
      </div>

      {/* 状态分布条 */}
      {total > 0 && (
        <div className="flex h-2 rounded-full overflow-hidden">
          {options.map((option) => {
            const count = counts[option.value] || 0;
            const percentage = (count / total) * 100;
            if (percentage === 0) return null;

            return (
              <div
                key={option.value}
                className={cn(
                  'transition-all',
                  option.color === 'gray' && 'bg-gray-400',
                  option.color === 'slate' && 'bg-slate-400',
                  option.color === 'blue' && 'bg-blue-400',
                  option.color === 'green' && 'bg-green-400',
                  option.color === 'red' && 'bg-red-400',
                  option.color === 'yellow' && 'bg-yellow-400',
                  option.color === 'purple' && 'bg-purple-400',
                  option.color === 'orange' && 'bg-orange-400'
                )}
                style={{ width: `${percentage}%` }}
              />
            );
          })}
        </div>
      )}

      {/* 状态卡片列表 */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-2">
        {options.map((option) => {
          const count = counts[option.value] || 0;
          const isSelected = selectedStatuses.includes(option.value as TaskStatus | StoryStatus);

          return (
            <button
              key={option.value}
              onClick={() => onStatusClick?.(option.value as TaskStatus | StoryStatus)}
              disabled={disabled}
              className={cn(
                'flex flex-col items-center gap-1 p-2 rounded-lg border transition-colors',
                'hover:bg-accent',
                isSelected && 'border-primary bg-primary/5',
                disabled && 'cursor-not-allowed opacity-60'
              )}
            >
              <StatusBadge
                status={option.value as TaskStatus | StoryStatus}
                isTask={entityType === 'task'}
                size="sm"
                showLabel={true}
              />
              <span className="text-lg font-semibold">{count}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * 迷你状态统计（用于卡片角落）
 */
export function StatusMiniStats({
  counts,
  entityType,
  className,
}: {
  counts: Record<string, number>;
  entityType: 'task' | 'story';
  className?: string;
}) {
  const options = entityType === 'task' ? TASK_STATUS_OPTIONS : STORY_STATUS_OPTIONS;

  // 只显示非零的状态
  const activeStatuses = options.filter((opt) => (counts[opt.value] || 0) > 0);

  return (
    <div className={cn('flex items-center gap-1', className)}>
      {activeStatuses.slice(0, 3).map((option) => {
        const count = counts[option.value] || 0;
        return (
          <div
            key={option.value}
            className={cn(
              'w-2 h-2 rounded-full',
              option.color === 'gray' && 'bg-gray-400',
              option.color === 'slate' && 'bg-slate-400',
              option.color === 'blue' && 'bg-blue-400',
              option.color === 'green' && 'bg-green-400',
              option.color === 'red' && 'bg-red-400',
              option.color === 'yellow' && 'bg-yellow-400',
              option.color === 'purple' && 'bg-purple-400',
              option.color === 'orange' && 'bg-orange-400'
            )}
            title={`${option.label}: ${count}`}
          />
        );
      })}
      {activeStatuses.length > 3 && (
        <span className="text-xs text-muted-foreground">
          +{activeStatuses.length - 3}
        </span>
      )}
    </div>
  );
}