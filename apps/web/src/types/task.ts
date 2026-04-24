/**
 * 任务相关类型定义
 */

import { TaskType, TaskPriority, TaskStatus, Timestamp } from './common';

/**
 * 任务接口
 */
export interface Task {
  /** 唯一标识符，格式: TASK-XXX */
  id: string;

  /** 任务标题 */
  title: string;

  /** 任务描述 */
  description: string;

  /** 任务类型 */
  type: TaskType;

  /** 任务优先级 */
  priority: TaskPriority;

  /** 估算工时（小时） */
  estimation: number;

  /** 任务状态 */
  status: TaskStatus;

  /** 依赖的任务 ID 列表 */
  dependencies: string[];

  /** 所属用户故事 ID */
  story_id: string;

  /** 标签 */
  tags: string[];

  /** 创建时间 */
  created_at: Timestamp;

  /** 更新时间 */
  updated_at: Timestamp;

  /** 开始时间 */
  started_at?: Timestamp;

  /** 完成时间 */
  completed_at?: Timestamp;

  /** 负责人 */
  assignee?: string;
}

/**
 * 任务创建 DTO
 */
export interface CreateTaskDTO {
  title: string;
  description: string;
  type: TaskType;
  priority: TaskPriority;
  estimation: number;
  dependencies?: string[];
  story_id: string;
  tags?: string[];
}

/**
 * 任务更新 DTO
 */
export interface UpdateTaskDTO {
  title?: string;
  description?: string;
  type?: TaskType;
  priority?: TaskPriority;
  estimation?: number;
  status?: TaskStatus;
  dependencies?: string[];
  tags?: string[];
  assignee?: string;
}
