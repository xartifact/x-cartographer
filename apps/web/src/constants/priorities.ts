/**
 * 优先级配置
 */

import { Priority, TaskPriority } from '@/types';

export const PRIORITY_LABELS: Record<Priority, string> = {
  [Priority.HIGH]: '高',
  [Priority.MEDIUM]: '中',
  [Priority.LOW]: '低',
};

export const PRIORITY_COLORS: Record<Priority, string> = {
  [Priority.HIGH]: 'hsl(var(--priority-high))',
  [Priority.MEDIUM]: 'hsl(var(--priority-medium))',
  [Priority.LOW]: 'hsl(var(--priority-low))',
};

export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  [TaskPriority.P0]: 'P0 - 关键',
  [TaskPriority.P1]: 'P1 - 高',
  [TaskPriority.P2]: 'P2 - 中',
  [TaskPriority.P3]: 'P3 - 低',
};
