/**
 * 用户故事相关类型定义
 */

import { Priority, Timestamp, Position, StoryStatus } from './common';
import { Task } from './task';

/**
 * 用户故事接口
 */
export interface UserStory {
  /** 唯一标识符，格式: US-XXX */
  id: string;

  /** 故事标题（标准格式：作为[角色]，我想要[功能]，以便[价值]） */
  title: string;

  /** 详细描述 */
  description: string;

  /** 优先级 */
  priority: Priority;

  /** 估算工时（小时） */
  estimation: number;

  /** 验收标准列表 */
  acceptance_criteria: string[];

  /** 标签 */
  tags: string[];

  /** 所属用户旅程 ID */
  journey_id: string;

  /** 拆解的任务列表 */
  tasks?: Task[];

  /** 排序顺序 */
  order: number;

  /** 状态 */
  status?: StoryStatus;

  /** 创建时间 */
  created_at: Timestamp;

  /** 更新时间 */
  updated_at: Timestamp;

  /** 可视化位置（用于故事地图） */
  position?: Position;
}

/**
 * 用户故事表单
 */
export interface UserStoryForm {
  /** 用户角色 */
  role: string;

  /** 想要的功能 */
  feature: string;

  /** 目的/价值 */
  value: string;

  /** 详细描述 */
  description?: string;

  /** 优先级 */
  priority: Priority;

  /** 估算工时 */
  estimation: number;

  /** 验收标准 */
  acceptance_criteria: string[];

  /** 标签 */
  tags: string[];
}

/**
 * 用户故事创建 DTO
 */
export interface CreateUserStoryDTO {
  title: string;
  description: string;
  priority: Priority;
  estimation: number;
  acceptance_criteria: string[];
  tags: string[];
  journey_id: string;
}

/**
 * 用户故事更新 DTO
 */
export interface UpdateUserStoryDTO {
  title?: string;
  description?: string;
  priority?: Priority;
  estimation?: number;
  acceptance_criteria?: string[];
  tags?: string[];
  order?: number;
  position?: Position;
}
