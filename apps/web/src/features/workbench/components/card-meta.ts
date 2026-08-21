/** 优先级/状态展示辅助（跨项目卡片共用） */
import type { Priority, TaskPriority, TaskStatus } from '@x-cartographer/shared';

export const STORY_PRIORITY_CLS: Record<Priority, string> = {
  high: 'text-red-600',
  medium: 'text-amber-600',
  low: 'text-gray-500',
};

export const TASK_PRIORITY_CLS: Record<TaskPriority, string> = {
  P0: 'text-red-600 font-semibold',
  P1: 'text-orange-500 font-medium',
  P2: 'text-blue-500',
  P3: 'text-gray-500',
};

export interface StoryStatusMeta {
  label: string;
  cls: string;
}
export const STORY_STATUS_LABEL: Record<string, string> = {
  backlog: '待办池',
  todo: '待执行',
  in_progress: '进行中',
  done: '已完成',
  cancelled: '已取消',
};

export const TASK_STATUS_LABEL: Record<TaskStatus | string, string> = {
  backlog: '待办池',
  todo: '待执行',
  in_progress: '进行中',
  in_review: '评审中',
  testing: '测试中',
  done: '已完成',
  cancelled: '已取消',
};
