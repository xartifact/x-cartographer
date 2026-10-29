"use client";
/**
 * 状态标签组件
 *
 * 用于显示任务或用户故事的状态标签
 */

import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import {
  TASK_STATUS_CONFIG,
  STORY_STATUS_CONFIG,
  getTaskStatusConfig,
  getStoryStatusConfig,
  TaskStatus,
  type StoryStatus,
  type StatusConfig,
} from "@/types";

/**
 * 状态标签变体类型
 */
export type StatusBadgeVariant =
  | "default"
  | "gray"
  | "slate"
  | "blue"
  | "green"
  | "red"
  | "yellow"
  | "purple"
  | "orange"
  | "outline_gray"
  | "outline_slate"
  | "outline_blue"
  | "outline_green"
  | "outline_red"
  | "outline_yellow"
  | "outline_purple"
  | "outline_orange";

/**
 * 状态标签变体配置
 */
const statusBadgeVariants = cva(
  "inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        // 默认/空状态
        default: "border-transparent bg-muted text-muted-foreground hover:bg-accent",
        // 状态颜色变体
        gray: "border-transparent bg-muted text-muted-foreground hover:bg-accent",
        slate: "border-transparent bg-muted text-muted-foreground hover:bg-accent",
        blue: "border-transparent bg-[var(--xa-info-soft)] text-[var(--xa-info)]",
        green: "border-transparent bg-[var(--xa-success-soft)] text-[var(--xa-success)]",
        red: "border-transparent bg-[var(--xa-danger-soft)] text-[var(--xa-danger)]",
        yellow: "border-transparent bg-[var(--xa-warning-soft)] text-[var(--xa-warning)]",
        purple: "border-transparent bg-[var(--xa-brand-soft)] text-[var(--xa-brand)]",
        orange: "border-transparent bg-[var(--xa-warning-soft)] text-[var(--xa-warning)]",
        // 轮廓变体
        outline_gray: "border-input bg-transparent text-muted-foreground hover:bg-muted",
        outline_slate: "border-input bg-transparent text-muted-foreground hover:bg-muted",
        outline_blue:
          "border-[var(--xa-info)] bg-transparent text-[var(--xa-info)] hover:bg-[var(--xa-info-soft)]",
        outline_green:
          "border-[var(--xa-success)] bg-transparent text-[var(--xa-success)] hover:bg-[var(--xa-success-soft)]",
        outline_red:
          "border-[var(--xa-danger)] bg-transparent text-[var(--xa-danger)] hover:bg-[var(--xa-danger-soft)]",
        outline_yellow:
          "border-[var(--xa-warning)] bg-transparent text-[var(--xa-warning)] hover:bg-[var(--xa-warning-soft)]",
        outline_purple:
          "border-[var(--xa-brand)] bg-transparent text-[var(--xa-brand)] hover:bg-[var(--xa-brand-soft)]",
        outline_orange:
          "border-[var(--xa-warning)] bg-transparent text-[var(--xa-warning)] hover:bg-[var(--xa-warning-soft)]",
      },
      size: {
        sm: "px-2 py-0.5 text-[10px]",
        md: "px-2.5 py-0.5 text-xs",
        lg: "px-3 py-1 text-sm",
      },
    },
    defaultVariants: {
      variant: "slate",
      size: "md",
    },
  },
);

export interface StatusBadgeProps
  extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof statusBadgeVariants> {
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
  outline: boolean,
): StatusBadgeVariant {
  let config: StatusConfig | undefined;

  if (isTask) {
    config = getTaskStatusConfig(status as TaskStatus);
  } else {
    config = getStoryStatusConfig(status as StoryStatus);
  }

  if (!config) {
    return "slate";
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
  size = "sm",
  className,
}: {
  status: TaskStatus | StoryStatus;
  isTask?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const config = isTask
    ? getTaskStatusConfig(status as TaskStatus)
    : getStoryStatusConfig(status as StoryStatus);

  if (!config) {
    return null;
  }

  const sizeClasses = {
    sm: "h-2 w-2",
    md: "h-2.5 w-2.5",
    lg: "h-3 w-3",
  };

  const colorClasses: Record<string, string> = {
    gray: "bg-gray-500",
    slate: "bg-slate-500",
    blue: "bg-blue-500",
    green: "bg-green-500",
    red: "bg-red-500",
    yellow: "bg-yellow-500",
    purple: "bg-purple-500",
    orange: "bg-orange-500",
  };

  return (
    <span
      className={cn(
        "inline-block rounded-full",
        sizeClasses[size],
        colorClasses[config.color],
        className,
      )}
    />
  );
}

/**
 * 任务状态列表（用于下拉选择等场景）
 */
export const TASK_STATUS_OPTIONS = Object.values(TASK_STATUS_CONFIG).map(
  ({ value, label, color }) => ({ value: value as TaskStatus, label, color }),
);
export const STORY_STATUS_OPTIONS = Object.values(STORY_STATUS_CONFIG).map(
  ({ value, label, color }) => ({ value: value as StoryStatus, label, color }),
);
