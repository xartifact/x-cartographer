/**
 * 用户故事相关类型定义
 */

import { Priority, Timestamp, Position, StoryStatus } from './common';
import { DevTask } from './dev-task';

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

  /** 地图列归属：用户活动 ID（backbone 位置，必填） */
  activity_id: string;

  /** 可选：活动下具体操作步骤（用户任务）ID */
  user_task_id?: string;

  /** 拆解的研发任务列表 */
  dev_tasks?: DevTask[];

  /** [迁移保留] 原 journey 归属（退役字段，迁移回滚锚点，勿读写） */
  journey_id?: string;
  /** 同列内叙事深度序（骨架行在上，深化行向下） */
  order: number;

  /** 状态 */
  status?: StoryStatus;

  /** 创建时间 */
  created_at: Timestamp;

  /** 更新时间 */
  updated_at: Timestamp;

  /** 可视化位置（用于故事地图） */
  position?: Position;

  /** 所属里程碑（版本）ID，未排期时为 undefined */
  milestone_id?: string;

  /** 受影响模块（引用 SystemModule.id，§3.7） */
  affected_modules?: string[];
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
  activity_id: string;
  estimation: number;
  acceptance_criteria: string[];
  tags: string[];
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
  activityId?: string;
  userTaskId?: string | null;
  affected_modules?: string[];
  order?: number;
  position?: Position;
  milestoneId?: string | null;
}
