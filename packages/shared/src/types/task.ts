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
  /** 所属用户故事 ID（项目级任务池任务可为空） */
  story_id: string | null;

  /** 所属项目 ID */
  project_id: string;

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
  /** 所属用户故事（项目级任务池任务可省略） */
  story_id?: string;
  /** 所属项目 ID（未关联故事的必需） */
  project_id?: string;
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
  project_id?: string;
}

