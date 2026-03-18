/**
 * 状态标签组件
 *
 * 用于显示任务或用户故事的状态标签
 */

'use client';

import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import {
  getTaskStatusConfig,
  getStoryStatusConfig,
  TaskStatus,
  type StoryStatus,
  type StatusConfig,
} from '@/types';

/**
 * 状态标签变体类型
 */
export type StatusBadgeVariant =
  | 'default'
  | 'gray'
  | 'slate'
  | 'blue'
  | 'green'
  | 'red'
  | 'yellow'
  | 'purple'
  | 'orange'
  | 'outline_gray'
  | 'outline_slate'
  | 'outline_blue'
  | 'outline_green'
  | 'outline_red'
  | 'outline_yellow'
  | 'outline_purple'
  | 'outline_orange';

/**
 * 状态标签变体配置
 */
const statusBadgeVariants = cva(
  'inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      variant: {
        // 默认/空状态
        default: 'border-transparent bg-gray-100 text-gray-800 hover:bg-gray-200',
        // 状态颜色变体
        gray: 'border-transparent bg-gray-100 text-gray-800 hover:bg-gray-200',
        slate: 'border-transparent bg-slate-100 text-slate-800 hover:bg-slate-200',
        blue: 'border-transparent bg-blue-100 text-blue-800 hover:bg-blue-200',
        green: 'border-transparent bg-green-100 text-green-800 hover:bg-green-200',
        red: 'border-transparent bg-red-100 text-red-800 hover:bg-red-200',
        yellow: 'border-transparent bg-yellow-100 text-yellow-800 hover:bg-yellow-200',
        purple: 'border-transparent bg-purple-100 text-purple-800 hover:bg-purple-200',
        orange: 'border-transparent bg-orange-100 text-orange-800 hover:bg-orange-200',
        // 轮廓变体
        outline_gray: 'border-gray-300 bg-transparent text-gray-700 hover:bg-gray-50',
        outline_slate: 'border-slate-300 bg-transparent text-slate-700 hover:bg-slate-50',
        outline_blue: 'border-blue-300 bg-transparent text-blue-700 hover:bg-blue-50',
        outline_green: 'border-green-300 bg-transparent text-green-700 hover:bg-green-50',
        outline_red: 'border-red-300 bg-transparent text-red-700 hover:bg-red-50',
        outline_yellow: 'border-yellow-300 bg-transparent text-yellow-700 hover:bg-yellow-50',
        outline_purple: 'border-purple-300 bg-transparent text-purple-700 hover:bg-purple-50',
        outline_orange: 'border-orange-300 bg-transparent text-orange-700 hover:bg-orange-50',
      },
      size: {
        sm: 'px-2 py-0.5 text-[10px]',
        md: 'px-2.5 py-0.5 text-xs',
        lg: 'px-3 py-1 text-sm',
      },
    },
    defaultVariants: {
      variant: 'slate',
      size: 'md',
    },
  }
);

export interface StatusBadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof statusBadgeVariants> {
  /** 状态值 */
  status: TaskStatus | StoryStatus;

  /** 是否为任务（否则为用户故事） */
  isTask?: boolean;

  /** 显示状态标签文字 */
  showLabel?: boolean;

  /** 是否为轮廓样式 */
  outline?: boolean;

  /** 自定义配置覆盖 */
  customConfig?: Partial<StatusConfig>;
}

/**
 * 获取状态对应的变体名称
 */
function getVariantName(
  status: TaskStatus | StoryStatus,
  isTask: boolean,
  outline: boolean
): StatusBadgeVariant {
  let config: StatusConfig | undefined;

  if (isTask) {
    config = getTaskStatusConfig(status as TaskStatus);
  } else {
    config = getStoryStatusConfig(status as StoryStatus);
  }

  if (!config) {
    return 'slate';
  }

  const colorName = config.color;
  if (outline) {
    return `outline_${colorName}` as StatusBadgeVariant;
  }
  return colorName as StatusBadgeVariant;
}

/**
 * 状态标签组件
 */
export function StatusBadge({
  status,
  isTask = true,
  showLabel = true,
  outline = false,
  customConfig,
  className,
  children,
  ...props
}: StatusBadgeProps) {
  // 获取配置
  const defaultConfig = isTask
    ? getTaskStatusConfig(status as TaskStatus)
    : getStoryStatusConfig(status as StoryStatus);

  // 合并自定义配置
  const config: StatusConfig = {
    ...defaultConfig,
    ...customConfig,
  };

  // 确定变体
  const variant = customConfig?.color
    ? (customConfig.color as StatusBadgeVariant)
    : getVariantName(status, isTask, outline);

  // 显示内容
  const label = config?.label || status;

  return (
    <div className={cn(statusBadgeVariants({ variant }), className)} {...props}>
      {showLabel && <span>{children || label}</span>}
      {!showLabel && children}
    </div>
  );
}

/**
 * 简化的状态指示器（小圆点）
 */
export function StatusIndicator({
  status,
  isTask = true,
  size = 'sm',
  className,
}: {
  status: TaskStatus | StoryStatus;
  isTask?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const config = isTask
    ? getTaskStatusConfig(status as TaskStatus)
    : getStoryStatusConfig(status as StoryStatus);

  if (!config) {
    return null;
  }

  const sizeClasses = {
    sm: 'h-2 w-2',
    md: 'h-2.5 w-2.5',
    lg: 'h-3 w-3',
  };

  const colorClasses: Record<string, string> = {
    gray: 'bg-gray-500',
    slate: 'bg-slate-500',
    blue: 'bg-blue-500',
    green: 'bg-green-500',
    red: 'bg-red-500',
    yellow: 'bg-yellow-500',
    purple: 'bg-purple-500',
    orange: 'bg-orange-500',
  };

  return (
    <span
      className={cn(
        'inline-block rounded-full',
        sizeClasses[size],
        colorClasses[config.color],
        className
      )}
    />
  );
}

/**
 * 任务状态列表（用于下拉选择等场景）
 */
export const TASK_STATUS_OPTIONS: { value: TaskStatus; label: string; color: string }[] = [
  { value: TaskStatus.BACKLOG, label: '待处理', color: 'gray' },
  { value: TaskStatus.TODO, label: '待开始', color: 'slate' },
  { value: TaskStatus.IN_PROGRESS, label: '进行中', color: 'blue' },
  { value: TaskStatus.IN_REVIEW, label: '待评审', color: 'yellow' },
  { value: TaskStatus.TESTING, label: '测试中', color: 'purple' },
  { value: TaskStatus.DONE, label: '已完成', color: 'green' },
  { value: TaskStatus.CANCELLED, label: '已取消', color: 'red' },
];

/**
 * 用户故事状态列表
 */
export const STORY_STATUS_OPTIONS: { value: StoryStatus; label: string; color: string }[] = [
  { value: 'backlog', label: '待处理', color: 'gray' },
  { value: 'todo', label: '待开始', color: 'slate' },
  { value: 'in_progress', label: '进行中', color: 'blue' },
  { value: 'done', label: '已完成', color: 'green' },
  { value: 'cancelled', label: '已取消', color: 'red' },
];