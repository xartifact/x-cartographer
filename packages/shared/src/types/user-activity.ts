/**
 * 用户活动（UserActivity）—— 用户故事地图 Backbone 节点。
 * 横轴 = 用户达成目标的端到端叙事流；命名纪律：动词短语。
 * 原 UserJourney 退役（语义分流见 docs/design/story-map-redesign.md §4.2）。
 */

import { Timestamp, type Provenance } from './common';
import { UserStory } from './user-story';
import { UserTask } from './user-task';

/**
 * 用户活动接口
 */
export interface UserActivity {
  /** 唯一标识符 */
  id: string;

  /** 活动名（动词短语，如"组织故事地图"） */
  name: string;

  /** 活动描述 */
  description: string;

  /** 所属产品 ID */
  product_id: string;

  /** 该活动下的用户故事（切片） */
  stories: UserStory[];

  /** 该活动下的用户任务（操作步骤，地图元素） */
  user_tasks?: UserTask[];

  /** 端到端叙事序（backbone 从左到右） */
  order: number;

  /** 创建时间 */
  created_at: Timestamp;

  /** 更新时间 */
  updated_at: Timestamp;
}

/**
 * 用户活动创建 DTO
 */
export interface CreateUserActivityDTO {
  name: string;
  description?: string;
  product_id: string;
  order?: number;
  provenance?: Provenance;
}

/**
 * 用户活动更新 DTO
 */
export interface UpdateUserActivityDTO {
  name?: string;
  description?: string;
  order?: number;
}
