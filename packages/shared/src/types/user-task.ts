/**
 * 用户任务（UserTask）—— 活动下的用户操作步骤（地图元素，弱实体）。
 * 描述用户为完成活动执行的具体操作，不是需求容器，不是研发任务（那是 DevTask）。
 * 见 docs/design/story-map-redesign.md §3.2。
 */

import { Timestamp } from './common';

/**
 * 用户任务接口
 */
export interface UserTask {
  /** 唯一标识符 */
  id: string;

  /** 所属用户活动 ID */
  activity_id: string;

  /** 任务名（用户操作短语，如"拖拽调整故事位置"） */
  name: string;

  /** 任务描述 */
  description: string;

  /** 活动内排序 */
  order: number;

  /** 创建时间 */
  created_at: Timestamp;

  /** 更新时间 */
  updated_at: Timestamp;
}

/**
 * 用户任务创建 DTO
 */
export interface CreateUserTaskDTO {
  activity_id: string;
  name: string;
  description?: string;
  order?: number;
}

/**
 * 用户任务更新 DTO
 */
export interface UpdateUserTaskDTO {
  name?: string;
  description?: string;
  order?: number;
}
