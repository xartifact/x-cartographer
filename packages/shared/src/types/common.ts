/**
 * 通用类型定义
 */

/**
 * 优先级枚举
 */
export enum Priority {
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
}

/**
 * 任务优先级
 */
export enum TaskPriority {
  P0 = 'P0', // Critical
  P1 = 'P1', // High
  P2 = 'P2', // Medium
  P3 = 'P3', // Low
}

/**
 * 优先级配置类型
 *
 * 颜色令牌故意独立于 StatusConfig.color 的 8 值枚举——优先级（紧急度）和状态（流程阶段）
 * 是两个独立语义轴，不应共享同一色板约束。
 */
export interface PriorityConfig {
  value: string;
  label: string;
  color: 'red' | 'orange' | 'amber' | 'blue' | 'gray';
  order: number;
}

/**
 * 用户故事/旅程优先级配置
 */
export const PRIORITY_CONFIG: Record<Priority, PriorityConfig> = {
  [Priority.HIGH]: { value: Priority.HIGH, label: '高', color: 'red', order: 1 },
  [Priority.MEDIUM]: { value: Priority.MEDIUM, label: '中', color: 'amber', order: 2 },
  [Priority.LOW]: { value: Priority.LOW, label: '低', color: 'gray', order: 3 },
};

/**
 * 任务优先级配置（P0-P3）
 */
export const TASK_PRIORITY_CONFIG: Record<TaskPriority, PriorityConfig> = {
  [TaskPriority.P0]: { value: TaskPriority.P0, label: 'P0 · 紧急', color: 'red', order: 1 },
  [TaskPriority.P1]: { value: TaskPriority.P1, label: 'P1 · 高', color: 'orange', order: 2 },
  [TaskPriority.P2]: { value: TaskPriority.P2, label: 'P2 · 中', color: 'blue', order: 3 },
  [TaskPriority.P3]: { value: TaskPriority.P3, label: 'P3 · 低', color: 'gray', order: 4 },
};

/**
 * 根据优先级获取配置
 */
export function getPriorityConfig(priority: Priority): PriorityConfig {
  return PRIORITY_CONFIG[priority];
}

/**
 * 根据任务优先级获取配置
 */
export function getTaskPriorityConfig(priority: TaskPriority): PriorityConfig {
  return TASK_PRIORITY_CONFIG[priority];
}

/**
 * 优先级颜色令牌 → 三种渲染形态（纯文字 / 徽章 / 卡片左色条）对应的 Tailwind 类
 */
export const PRIORITY_COLOR_VARIANTS: Record<
  PriorityConfig['color'],
  { text: string; badge: string; leftBorder: string }
> = {
  red: {
    text: 'text-red-600 dark:text-red-400',
    badge: 'border-red-200 bg-red-50 text-red-600 dark:border-red-900 dark:bg-red-950 dark:text-red-400',
    leftBorder: 'border-l-red-500',
  },
  orange: {
    text: 'text-orange-600 dark:text-orange-400',
    badge:
      'border-orange-200 bg-orange-50 text-orange-600 dark:border-orange-900 dark:bg-orange-950 dark:text-orange-400',
    leftBorder: 'border-l-orange-400',
  },
  amber: {
    text: 'text-amber-600 dark:text-amber-400',
    badge:
      'border-amber-200 bg-amber-50 text-amber-600 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-400',
    leftBorder: 'border-l-amber-400',
  },
  blue: {
    text: 'text-blue-600 dark:text-blue-400',
    badge: 'border-blue-200 bg-blue-50 text-blue-600 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-400',
    leftBorder: 'border-l-blue-400',
  },
  gray: {
    text: 'text-gray-500 dark:text-gray-400',
    badge: 'border-gray-200 bg-gray-50 text-gray-600 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400',
    leftBorder: 'border-l-transparent',
  },
};


/**
 * 任务状态
 */
export enum TaskStatus {
  BACKLOG = 'backlog',
  TODO = 'todo',
  IN_PROGRESS = 'in_progress',
  IN_REVIEW = 'in_review',
  TESTING = 'testing',
  DONE = 'done',
  CANCELLED = 'cancelled',
}

/**
 * 时间戳类型 (ISO 8601 格式)
 */
export type Timestamp = string;

/**
 * 位置信息
 */
export interface Position {
  x: number;
  y: number;
}

/**
 * 用户故事状态（约束空间·意图：验收判断——"需求被接受了"）
 * 与 DevTask 的 TaskStatus（工作空间：执行进度——"活干完了"）是不同语义，永不用同词。
 * done → accepted 更名见 docs/design/domain-model.md §6.3 / §8-H。
 */
export type StoryStatus = 'backlog' | 'todo' | 'in_progress' | 'accepted' | 'cancelled';

/**
 * 所有状态类型的联合
 */
export type EntityStatus = TaskStatus | StoryStatus;

/**
 * 状态变更历史记录
 */
export interface StatusChangeRecord {
  /** 唯一标识符 */
  id: string;

  /** 关联的任务或故事 ID */
  entity_id: string;

  /** 实体类型：'task' | 'story' | 'adr' */
  entity_type: 'task' | 'story' | 'adr';

  /** 变更前的状态 */
  previous_status: string;

  /** 变更后的状态 */
  new_status: string;

  /** 变更原因（可选） */
  reason?: string;

  /** 变更人（可选） */
  changed_by?: string;

  /** 变更时间 */
  changed_at: Timestamp;
}

/**
 * 状态配置类型
 */
export interface StatusConfig {
  /** 状态值 */
  value: string;

  /** 显示标签 */
  label: string;

  /** 颜色变体：gray | slate | blue | green | red | yellow | purple | orange */
  color: 'gray' | 'slate' | 'blue' | 'green' | 'red' | 'yellow' | 'purple' | 'orange';

  /** 是否为完成状态 */
  isCompleted: boolean;

  /** 是否为进行中状态 */
  isInProgress: boolean;

  /** 排序权重（数字越大越靠后） */
  order: number;
}

/**
 * 状态配置映射
 */
export const TASK_STATUS_CONFIG: Record<TaskStatus, StatusConfig> = {
  [TaskStatus.BACKLOG]: {
    value: TaskStatus.BACKLOG,
    label: '待处理',
    color: 'gray',
    isCompleted: false,
    isInProgress: false,
    order: 1,
  },
  [TaskStatus.TODO]: {
    value: TaskStatus.TODO,
    label: '待开始',
    color: 'slate',
    isCompleted: false,
    isInProgress: false,
    order: 2,
  },
  [TaskStatus.IN_PROGRESS]: {
    value: TaskStatus.IN_PROGRESS,
    label: '进行中',
    color: 'blue',
    isCompleted: false,
    isInProgress: true,
    order: 3,
  },
  [TaskStatus.IN_REVIEW]: {
    value: TaskStatus.IN_REVIEW,
    label: '待评审',
    color: 'yellow',
    isCompleted: false,
    isInProgress: true,
    order: 4,
  },
  [TaskStatus.TESTING]: {
    value: TaskStatus.TESTING,
    label: '测试中',
    color: 'purple',
    isCompleted: false,
    isInProgress: true,
    order: 5,
  },
  [TaskStatus.DONE]: {
    value: TaskStatus.DONE,
    label: '已完成',
    color: 'green',
    isCompleted: true,
    isInProgress: false,
    order: 6,
  },
  [TaskStatus.CANCELLED]: {
    value: TaskStatus.CANCELLED,
    label: '已取消',
    color: 'red',
    isCompleted: false,
    isInProgress: false,
    order: 7,
  },
};

/**
 * 用户故事状态配置
 */
export const STORY_STATUS_CONFIG: Record<StoryStatus, StatusConfig> = {
  backlog: {
    value: 'backlog',
    label: '待处理',
    color: 'gray',
    isCompleted: false,
    isInProgress: false,
    order: 1,
  },
  todo: {
    value: 'todo',
    label: '待开始',
    color: 'slate',
    isCompleted: false,
    isInProgress: false,
    order: 2,
  },
  in_progress: {
    value: 'in_progress',
    label: '进行中',
    color: 'blue',
    isCompleted: false,
    isInProgress: true,
    order: 3,
  },
  accepted: {
    value: 'accepted',
    label: '已验收',
    color: 'green',
    isCompleted: true,
    isInProgress: false,
    order: 4,
  },
  cancelled: {
    value: 'cancelled',
    label: '已取消',
    color: 'red',
    isCompleted: false,
    isInProgress: false,
    order: 5,
  },
};

/**
 * 根据状态获取配置
 */
export function getTaskStatusConfig(status: TaskStatus): StatusConfig {
  return TASK_STATUS_CONFIG[status];
}

/**
 * 根据状态获取配置（用户故事）
 */
export function getStoryStatusConfig(status: StoryStatus): StatusConfig {
  return STORY_STATUS_CONFIG[status];
}

/**
 * 颜色变体到 Tailwind 类名的映射
 */
export const STATUS_COLOR_VARIANTS = {
  gray: 'bg-gray-100 text-gray-800 border-gray-200',
  slate: 'bg-slate-100 text-slate-800 border-slate-200',
  blue: 'bg-blue-100 text-blue-800 border-blue-200',
  green: 'bg-green-100 text-green-800 border-green-200',
  red: 'bg-red-100 text-red-800 border-red-200',
  yellow: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  purple: 'bg-purple-100 text-purple-800 border-purple-200',
  orange: 'bg-orange-100 text-orange-800 border-orange-200',
} as const;

/**
 * 获取状态标签的 CSS 类名
 */
export function getStatusVariant(status: string): string {
  const config = TASK_STATUS_CONFIG[status as TaskStatus] || STORY_STATUS_CONFIG[status as StoryStatus];
  if (config) {
    return STATUS_COLOR_VARIANTS[config.color];
  }
  // 默认使用 slate
  return STATUS_COLOR_VARIANTS.slate;
}
