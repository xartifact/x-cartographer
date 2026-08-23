/**
 * 用户旅程相关类型定义
 */

import { Timestamp } from './common';
import { UserStory } from './user-story';

/**
 * 用户旅程接口
 */
export interface UserJourney {
  /** 唯一标识符，格式: UJ-XXX */
  id: string;

  /** 旅程名称 */
  name: string;

  /** 旅程描述 */
  description: string;

  /** 目标用户角色 */
  persona: string;

  /** 所属项目 ID */
  project_id: string;

  /** 优先级（TASK-030：high/medium/low） */
  priority?: 'high' | 'medium' | 'low';

  /** 包含的用户故事 */
  stories: UserStory[];

  /** 排序顺序 */
  order: number;

  /** 创建时间 */
  created_at: Timestamp;

  /** 更新时间 */
  updated_at: Timestamp;
}

/**
 * 用户旅程创建 DTO
 */
export interface CreateUserJourneyDTO {
  name: string;
  description: string;
  persona: string;
  project_id: string;
  priority?: 'high' | 'medium' | 'low';
}

/**
 * 用户旅程更新 DTO
 */
export interface UpdateUserJourneyDTO {
  name?: string;
  description?: string;
  persona?: string;
  order?: number;
  priority?: 'high' | 'medium' | 'low';
}
