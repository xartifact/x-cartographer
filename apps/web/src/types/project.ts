/**
 * 项目相关类型定义
 */

import { Timestamp, LLMProvider } from './common';
import { UserJourney } from './user-journey';

/**
 * 项目接口
 */
export interface Project {
  /** 唯一标识符 */
  id: string;

  /** 项目名称 */
  name: string;

  /** 项目描述 */
  description?: string;

  /** 创建时间 */
  created_at: Timestamp;

  /** 更新时间 */
  updated_at: Timestamp;

  /** 用户旅程列表 */
  user_journeys: UserJourney[];

  /** 项目元数据 */
  metadata: ProjectMetadata;

  /** 项目设置 */
  settings: ProjectSettings;
}

/**
 * 项目元数据
 */
export interface ProjectMetadata {
  /** 技术栈 */
  tech_stack: string[];

  /** 版本号 */
  version: string;

  /** 标签 */
  tags: string[];

  /** 总用户故事数 */
  total_stories?: number;

  /** 总任务数 */
  total_tasks?: number;

  /** 总估算工时 */
  total_estimation?: number;
}

/**
 * 项目设置
 */
export interface ProjectSettings {
  /** LLM 提供商 */
  llm_provider: LLMProvider;

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
 * 项目创建 DTO
 */
export interface CreateProjectDTO {
  name: string;
  description?: string;
  tech_stack?: string[];
  workspace_dir?: string;
}

/**
 * 项目更新 DTO
 */
export interface UpdateProjectDTO {
  name?: string;
  description?: string;
  settings?: Partial<ProjectSettings>;
  metadata?: Partial<ProjectMetadata>;
  user_journeys?: UserJourney[];
}
