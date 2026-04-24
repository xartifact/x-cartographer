/**
 * ID 生成工具
 */

import { nanoid } from 'nanoid';

/**
 * 生成项目 ID
 */
export function generateProjectId(): string {
  return `proj-${nanoid(10)}`;
}

/**
 * 生成用户旅程 ID
 */
export function generateJourneyId(index: number): string {
  return `UJ-${String(index).padStart(3, '0')}`;
}

/**
 * 生成用户故事 ID
 */
export function generateStoryId(index: number): string {
  return `US-${String(index).padStart(3, '0')}`;
}

/**
 * 生成任务 ID
 */
export function generateTaskId(index: number): string {
  return `TASK-${String(index).padStart(3, '0')}`;
}
