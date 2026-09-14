/**
 * 项目数据验证器
 */

import type { Product } from '@/types';

/**
 * 验证结果
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * 验证项目
 */
export function validateProject(project: Product): ValidationResult {
  const errors: string[] = [];

  // 验证必填字段
  if (!project.id) {
    errors.push('Project ID is required');
  }
  if (!project.name || project.name.trim().length === 0) {
    errors.push('Project name is required');
  }
  if (project.name && project.name.length > 100) {
    errors.push('Project name must be 100 characters or less');
  }

  // 验证时间戳
  if (!project.created_at) {
    errors.push('Created timestamp is required');
  }
  if (!project.updated_at) {
    errors.push('Updated timestamp is required');
  }

  // 验证元数据
  if (project.metadata) {
    if (project.metadata.tech_stack && !Array.isArray(project.metadata.tech_stack)) {
      errors.push('Tech stack must be an array');
    }
  }

  // 验证用户活动
  if (project.user_activities) {
    project.user_activities.forEach((activity, index) => {
      if (!activity.id) {
        errors.push(`Activity at index ${index}: ID is required`);
      }
      if (!activity.name || activity.name.trim().length === 0) {
        errors.push(`Activity at index ${index}: Name is required`);
      }
    });
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * 验证项目名称
 */
export function validateProjectName(name: string): ValidationResult {
  const errors: string[] = [];

  if (!name || name.trim().length === 0) {
    errors.push('Project name is required');
  } else {
    if (name.length < 2) {
      errors.push('Project name must be at least 2 characters');
    }
    if (name.length > 100) {
      errors.push('Project name must be 100 characters or less');
    }
    if (!/^[a-zA-Z0-9\s\-_]+$/.test(name)) {
      errors.push('Project name can only contain letters, numbers, spaces, hyphens, and underscores');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * 验证项目描述
 */
export function validateProjectDescription(description: string): ValidationResult {
  const errors: string[] = [];

  if (description && description.length > 1000) {
    errors.push('Description must be 1000 characters or less');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
