/**
 * TOML 数据验证
 */

import { z } from 'zod';
import { TomlStoryMap, TomlUserJourney, TomlUserStory } from '@/types';

/**
 * 验收标准 Schema
 */
const AcceptanceCriterionSchema = z.union([
  z.string(),
  z.object({
    description: z.string(),
    completed: z.boolean().optional(),
  }),
]);

/**
 * 用户故事 Schema
 */
export const TomlUserStorySchema: z.ZodType<TomlUserStory> = z.object({
  id: z.string().min(1, '用户故事 ID 不能为空'),
  title: z.string().min(1, '用户故事标题不能为空'),
  description: z.string().min(1, '用户故事描述不能为空'),
  priority: z.enum(['high', 'medium', 'low'], {
    errorMap: () => ({ message: '优先级必须是 high、medium 或 low' }),
  }),
  estimation: z.number().min(0, '估算工时不能为负数'),
  acceptance_criteria: z.array(AcceptanceCriterionSchema).min(1, '至少需要一个验收标准'),
  tags: z.array(z.string()).default([]),
  status: z.enum(['backlog', 'todo', 'in_progress', 'done', 'cancelled']).optional(),
});

/**
 * 用户旅程 Schema
 */
export const TomlUserJourneySchema: z.ZodType<TomlUserJourney> = z.object({
  id: z.string().min(1, '用户旅程 ID 不能为空'),
  name: z.string().min(1, '用户旅程名称不能为空'),
  description: z.string().min(1, '用户旅程描述不能为空'),
  persona: z.string().min(1, '用户角色不能为空'),
  stories: z.array(TomlUserStorySchema).default([]),
  order: z.number().optional(),
});

/**
 * 项目元数据 Schema
 */
const TomlProjectMetadataSchema = z.object({
  name: z.string().min(1, '项目名称不能为空'),
  version: z.string().min(1, '项目版本不能为空'),
  // 支持日期格式 (YYYY-MM-DD) 或完整的 ISO 8601 日期时间格式
  created_at: z.string().refine(
    (val) => {
      // 尝试解析为日期
      const date = new Date(val);
      return !isNaN(date.getTime());
    },
    { message: '创建时间必须是有效的日期格式 (YYYY-MM-DD 或 ISO 8601)' }
  ),
  description: z.string().min(1, '项目描述不能为空'),
  tech_stack: z.array(z.string()).min(1, '技术栈不能为空'),
});

/**
 * 完整的 TOML 故事地图 Schema
 */
export const TomlStoryMapSchema: z.ZodType<TomlStoryMap> = z.object({
  project: TomlProjectMetadataSchema,
  user_journeys: z.array(TomlUserJourneySchema).min(1, '至少需要一个用户旅程'),
});

/**
 * 验证 TOML 故事地图数据
 */
export function validateTomlStoryMap(data: unknown): {
  success: boolean;
  data?: TomlStoryMap;
  errors?: z.ZodError;
} {
  const result = TomlStoryMapSchema.safeParse(data);

  if (result.success) {
    return {
      success: true,
      data: result.data,
    };
  }

  return {
    success: false,
    errors: result.error,
  };
}

/**
 * 格式化验证错误信息
 */
export function formatValidationErrors(error: z.ZodError): string[] {
  const errors: string[] = [];

  error.errors.forEach((err) => {
    const path = err.path.join('.');
    errors.push(`${path}: ${err.message}`);
  });

  return errors;
}
