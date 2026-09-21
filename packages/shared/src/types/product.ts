/**
 * 产品（Product）类型定义 —— 原 Project 正名。
 * 产品是持续演进的需求载体，承载用户故事地图与发布线。
 * 见 docs/design/story-map-redesign.md §3.1。
 */

import { Timestamp, type Provenance } from './common';
import { UserActivity } from './user-activity';

/**
 * 产品接口
 */
export interface Product {
  /** 唯一标识符 */
  id: string;

  /** 产品名称 */
  name: string;

  /** 产品描述 */
  description?: string;

  /** 创建时间 */
  created_at: Timestamp;

  /** 更新时间 */
  updated_at: Timestamp;

  /** 用户活动列表（故事地图 backbone） */
  user_activities: UserActivity[];

  /** 产品元数据 */
  metadata: ProductMetadata;

  /** 产品设置 */
  settings: ProductSettings;
}

/**
 * 产品元数据
 */
export interface ProductMetadata {
  /**
   * 技术栈（遗留扁平字符串数组）
   *
   * @deprecated 已由**技术宪法**取代：结构化选型请用 ADR 的 `tech_stack` changes
   * （`TechStackEntry`：id/layer/choice/version/rationale）→ `xcart adr current --product <id>`。
   * 本字段不做自动迁移——`"react": "19"` 这类扁平字符串**无法无损映射**到
   * `{ layer, choice, version }`，猜测映射会产生假数据（见 `docs/design/technical-constitution.md` §8）。
   * 新代码不要写入或读取本字段；写入侧请改用 ADR。
   */
  tech_stack: string[];

  /** 版本号 */
  version: string;

  /** 标签 */
  tags: string[];

  /** 总用户故事数 */
  total_stories?: number;

  /** 总研发任务数 */
  total_tasks?: number;

  /** 总估算工时 */
  total_estimation?: number;
}

/**
 * 产品设置
 */
export interface ProductSettings {
  /** 自动保存 */
  auto_save: boolean;

  /** 显示偏好 */
  display_preferences: DisplayPreferences;

  /** 源代码工作空间绝对路径 */
  workspace_dir?: string;
}

/**
 * 显示偏好
 */
export interface DisplayPreferences {
  /** 显示优先级颜色 */
  show_priority_colors: boolean;

  /** 显示估算 */
  show_estimation: boolean;

  /** 默认视图 */
  default_view: 'map' | 'list' | 'kanban';
}

/**
 * 产品创建 DTO
 */
export interface CreateProductDTO {
  name: string;
  description?: string;
  tech_stack?: string[];
  workspace_dir?: string;
  provenance?: Provenance;
}

/**
 * 产品更新 DTO
 */
export interface UpdateProductDTO {
  name?: string;
  description?: string;
  settings?: Partial<ProductSettings>;
  metadata?: Partial<ProductMetadata>;
  user_activities?: UserActivity[];
}
