/** 优先级/状态展示辅助（跨项目卡片共用） */
import type { Priority, TaskPriority, TaskStatus } from '@x-cartographer/shared';
import { PRIORITY_CONFIG, TASK_PRIORITY_CONFIG, PRIORITY_COLOR_VARIANTS } from '@x-cartographer/shared';

/** 派生自 PRIORITY_CONFIG 真源，不在此处重新定义颜色 */
export const STORY_PRIORITY_CLS: Record<Priority, string> = Object.fromEntries(
  Object.entries(PRIORITY_CONFIG).map(([key, config]) => [key, PRIORITY_COLOR_VARIANTS[config.color].text])
) as Record<Priority, string>;

export const TASK_PRIORITY_CLS: Record<TaskPriority, string> = Object.fromEntries(
  Object.entries(TASK_PRIORITY_CONFIG).map(([key, config]) => [key, PRIORITY_COLOR_VARIANTS[config.color].text])
) as Record<TaskPriority, string>;

export interface StoryStatusMeta {
  label: string;
  cls: string;
}
export const STORY_STATUS_LABEL: Record<string, string> = {
  backlog: '待办池',
  todo: '待执行',
  in_progress: '进行中',
  accepted: '已验收',
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
