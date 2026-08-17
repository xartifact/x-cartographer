/**
 * 里程碑（版本）类型定义 —— 排期模型的核心实体
 */

import { Timestamp } from './common';

/**
 * 里程碑状态
 */
export type MilestoneStatus = 'planned' | 'active' | 'completed';

/**
 * 里程碑接口（版本）
 */
export interface Milestone {
  /** 唯一标识符 */
  id: string;

  /** 所属项目 ID */
  project_id: string;

  /** 版本名称（如 v1.0） */
  name: string;

  /** 版本目标描述 */
  goal: string;

  /** 可选目标日期（ISO 8601） */
  target_date?: Timestamp;

  /** 状态：planned / active / completed */
  status: MilestoneStatus;

  /** 创建时间 */
  created_at: Timestamp;

  /** 更新时间 */
  updated_at: Timestamp;
}

/**
 * 里程碑创建 DTO
 */
export interface CreateMilestoneDTO {
  project_id: string;
  name: string;
  goal?: string;
  target_date?: string;
  status?: MilestoneStatus;
}

/**
 * 里程碑更新 DTO
 */
export interface UpdateMilestoneDTO {
  name?: string;
  goal?: string;
  target_date?: string | null;
  status?: MilestoneStatus;
}
