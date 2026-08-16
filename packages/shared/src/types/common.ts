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
 * 任务类型
 */
export enum TaskType {
  USER_STORY = 'user_story',
  TECHNICAL_TASK = 'technical_task',
  BUG_FIX = 'bug_fix',
  SPIKE = 'spike',
}

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
 * LLM 提供商
 */
export enum LLMProvider {
  OPENAI = 'openai',
  ANTHROPIC = 'anthropic',
  X_HERALD = 'x-herald',
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
 * 任务状态（用于用户故事）
 */
export type StoryStatus = 'backlog' | 'todo' | 'in_progress' | 'done' | 'cancelled';

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

  /** 实体类型：'task' | 'story' */
  entity_type: 'task' | 'story';

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
  done: {
    value: 'done',
    label: '已完成',
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
