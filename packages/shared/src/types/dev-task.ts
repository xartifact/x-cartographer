/**
 * 研发任务（DevTask）类型定义 —— 原 Task 正名。
 * 执行域实体：AI/人执行的研发工作。原 type 字段已废除（实体切割，见
 * docs/design/story-map-redesign.md §3.3），交付性质由 tags 承载。
 */

import { TaskPriority, TaskStatus, Timestamp } from './common';

/**
 * 研发任务接口
 */
export interface DevTask {
  /** 唯一标识符，格式: TASK-XXX */
  id: string;

  /** 任务标题 */
  title: string;

  /** 任务描述 */
  description: string;

  /** 任务优先级 */
  priority: TaskPriority;

  /** 估算工时（小时） */
  estimation: number;

  /** 任务状态 */
  status: TaskStatus;

  /** 依赖的任务 ID 列表 */
  dependencies: string[];
  /** 所属用户故事 ID（产品级任务池任务可为空） */
  story_id: string | null;

  /** 所属产品 ID */
  product_id: string;

  /** 标签（承载交付性质：implementation / refactor / bug / infra 等） */
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

  /** 受影响模块（引用 SystemModule.id）；不填 = 继承所属 Story 的并集，填了 = 收窄（§3.7/§4） */
  affected_modules?: string[];
}

/**
 * 研发任务创建 DTO
 */
export interface CreateDevTaskDTO {
  title: string;
  description: string;
  priority: TaskPriority;
  estimation: number;
  dependencies?: string[];
  /** 所属用户故事（产品级任务池任务可省略） */
  story_id?: string;
  /** 所属产品 ID（未关联故事的必需） */
  product_id?: string;
  tags?: string[];
}

/**
 * 研发任务更新 DTO
 */
export interface UpdateDevTaskDTO {
  title?: string;
  description?: string;
  priority?: TaskPriority;
  estimation?: number;
  status?: TaskStatus;
  dependencies?: string[];
  tags?: string[];
  assignee?: string;
  product_id?: string;
  affected_modules?: string[];
}
