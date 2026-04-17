/**
 * 项目进度统计组件
 *
 * 显示项目整体进度和统计信息
 */

'use client';

import { TrendingUp, Clock, CheckCircle2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ProgressStatsProps {
  /** 任务统计 */
  taskStats: {
    total: number;
    completed: number;
    inProgress: number;
    backlog: number;
  };

  /** 用户故事统计 */
  storyStats: {
    total: number;
    completed: number;
    inProgress: number;
    backlog: number;
  };

  /** 整体进度 */
  overallProgress?: number;

  /** 显示模式：'full' | 'compact' | 'minimal' */
  displayMode?: 'full' | 'compact' | 'minimal';

  /** 趋势数据（可选） */
  trendData?: {
    weekTasks: number[];
    weekProgress: number[];
  };

  /** 自定义类名 */
  className?: string;
}

/**
 * 进度统计卡片
 */
function StatCard({
  title,
  value,
  icon: Icon,
  trend,
  trendValue,
  className,
}: {
  title: string;
  value: number | string;
  icon: React.ElementType;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  className?: string;
}) {
  return (
    <div className={cn('flex items-center gap-3 p-4 rounded-lg border bg-card', className)}>
      <div className="p-2 rounded-lg bg-primary/10">
        <Icon className="h-5 w-5 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-muted-foreground truncate">{title}</p>
        <p className="text-2xl font-bold truncate">{value}</p>
      </div>
      {trend && trendValue && (
        <div
          className={cn(
            'flex items-center gap-1 text-xs font-medium',
            trend === 'up' && 'text-green-600',
            trend === 'down' && 'text-red-600',
            trend === 'neutral' && 'text-muted-foreground'
          )}
        >
          {trend === 'up' && <TrendingUp className="h-3 w-3" />}
          {trend === 'down' && <TrendingDown className="h-3 w-3" />}
          {trendValue}
        </div>
      )}
    </div>
  );
}

/**
 * 进度条组件
 */
function ProgressBar({
  value,
  max = 100,
  showLabel = true,
  color = 'green',
  className,
}: {
  value: number;
  max?: number;
  showLabel?: boolean;
  color?: 'green' | 'blue' | 'yellow' | 'red';
  className?: string;
}) {
  const percentage = Math.min(Math.round((value / max) * 100), 100);

  const colorClasses = {
    green: 'bg-green-500',
    blue: 'bg-blue-500',
    yellow: 'bg-yellow-500',
    red: 'bg-red-500',
  };

  return (
    <div className={cn('space-y-1', className)}>
      {showLabel && (
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">进度</span>
          <span className="font-medium">{percentage}%</span>
        </div>
      )}
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div
          className={cn('h-full transition-all', colorClasses[color])}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

/**
 * 项目进度统计组件
 */
export function ProgressStats({
  taskStats,
  storyStats,
  overallProgress,
  displayMode = 'full',
  trendData,
  className,
}: ProgressStatsProps) {
  // 计算整体进度（如果未提供）
  const total = taskStats.total + storyStats.total;
  const completed = taskStats.completed + storyStats.completed;
  const calculatedProgress = overallProgress ?? (total > 0 ? Math.round((completed / total) * 100) : 0);

  // 紧凑模式
  if (displayMode === 'compact') {
    return (
      <div className={cn('grid grid-cols-4 gap-2', className)}>
        <StatCard
          title="总任务"
          value={total}
          icon={AlertCircle}
        />
        <StatCard
          title="已完成"
          value={completed}
          icon={CheckCircle2}
        />
        <StatCard
          title="进行中"
          value={taskStats.inProgress + storyStats.inProgress}
          icon={Clock}
        />
        <div className="p-4 rounded-lg border bg-card">
          <p className="text-sm text-muted-foreground mb-1">完成率</p>
          <p className="text-2xl font-bold">{calculatedProgress}%</p>
        </div>
      </div>
    );
  }

  // 极简模式
  if (displayMode === 'minimal') {
    return (
      <div className={cn('flex items-center gap-4', className)}>
        <div className="flex items-center gap-2">
          <div className="w-32 h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 transition-all"
              style={{ width: `${calculatedProgress}%` }}
            />
          </div>
          <span className="text-sm font-medium">{calculatedProgress}%</span>
        </div>
        <span className="text-sm text-muted-foreground">
          {completed}/{total}
        </span>
      </div>
    );
  }

  // 完整模式
  return (
    <div className={cn('space-y-6', className)}>
      {/* 整体进度 */}
      <div className="p-4 rounded-lg border bg-card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">项目进度</h3>
          <span className="text-3xl font-bold text-primary">{calculatedProgress}%</span>
        </div>
        <ProgressBar value={completed} max={total} />
        <div className="mt-4 grid grid-cols-3 gap-4 text-sm">
          <div className="text-center">
            <p className="text-muted-foreground">任务</p>
            <p className="font-semibold">{taskStats.completed}/{taskStats.total}</p>
          </div>
          <div className="text-center">
            <p className="text-muted-foreground">用户故事</p>
            <p className="font-semibold">{storyStats.completed}/{storyStats.total}</p>
          </div>
          <div className="text-center">
            <p className="text-muted-foreground">待处理</p>
            <p className="font-semibold">{taskStats.backlog + storyStats.backlog}</p>
          </div>
        </div>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          title="总任务数"
          value={taskStats.total}
          icon={AlertCircle}
          trend={trendData ? 'up' : undefined}
          trendValue={trendData ? `+${trendData.weekTasks[trendData.weekTasks.length - 1] || 0}` : undefined}
        />
        <StatCard
          title="已完成任务"
          value={taskStats.completed}
          icon={CheckCircle2}
          trendValue={trendData ? `${Math.round((taskStats.completed / (taskStats.total || 1)) * 100)}%` : undefined}
        />
        <StatCard
          title="进行中"
          value={taskStats.inProgress + storyStats.inProgress}
          icon={Clock}
        />
        <StatCard
          title="用户故事"
          value={storyStats.total}
          icon={TrendingUp}
          trend={trendData ? 'up' : undefined}
          trendValue={trendData ? `+${trendData.weekTasks[trendData.weekTasks.length - 1] || 0}` : undefined}
        />
      </div>

      {/* 状态分布 */}
      <div className="p-4 rounded-lg border bg-card">
        <h4 className="text-sm font-medium mb-3">状态分布</h4>
        <div className="space-y-2">
          <StatusDistributionRow
            label="待处理"
            count={taskStats.backlog + storyStats.backlog}
            total={total}
            color="gray"
          />
          <StatusDistributionRow
            label="进行中"
            count={taskStats.inProgress + storyStats.inProgress}
            total={total}
            color="blue"
          />
          <StatusDistributionRow
            label="已完成"
            count={completed}
            total={total}
            color="green"
          />
        </div>
      </div>
    </div>
  );
}

/**
 * 状态分布行
 */
function StatusDistributionRow({
  label,
  count,
  total,
  color,
}: {
  label: string;
  count: number;
  total: number;
  color: 'gray' | 'blue' | 'green';
}) {
  const percentage = total > 0 ? Math.round((count / total) * 100) : 0;

  const colorClasses = {
    gray: 'bg-gray-400',
    blue: 'bg-blue-400',
    green: 'bg-green-400',
  };

  return (
    <div className="flex items-center gap-3">
      <span className="w-16 text-sm text-muted-foreground">{label}</span>
      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
        <div
          className={cn('h-full transition-all', colorClasses[color])}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <span className="w-12 text-sm font-medium text-right">{count}</span>
      <span className="w-10 text-xs text-muted-foreground text-right">{percentage}%</span>
    </div>
  );
}

// 辅助函数：向下箭头图标
function TrendingDown({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6"
      />
    </svg>
  );
}