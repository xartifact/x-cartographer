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
