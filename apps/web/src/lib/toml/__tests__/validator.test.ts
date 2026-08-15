import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { parseTomlFile } from '../parser';
import {
  TomlStoryMapSchema,
  validateTomlStoryMap,
  formatValidationErrors,
} from '../validator';
const fixturePath = fileURLToPath(
  new URL('./fixtures/story-map-sample.toml', (() => import.meta.url)())
);


describe('TomlStoryMapSchema', () => {
  it('通过真实 TOML fixture 的 schema 校验', async () => {
    const content = readFileSync(fixturePath, 'utf-8');
    const data = await parseTomlFile(content);

    const result = TomlStoryMapSchema.safeParse(data);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.user_journeys).toHaveLength(3);
    }
  });

  it('缺少 project 时报错', () => {
    const result = TomlStoryMapSchema.safeParse({ user_journeys: [] });
    expect(result.success).toBe(false);
  });

  it('没有用户旅程时报错（至少需要一个）', () => {
    const result = TomlStoryMapSchema.safeParse({
      project: {
        name: 'P',
        version: '1',
        created_at: '2026-01-01',
        description: 'D',
        tech_stack: ['TS'],
      },
      user_journeys: [],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(formatValidationErrors(result.error)).toContain('user_journeys: 至少需要一个用户旅程');
    }
  });
});

describe('validateTomlStoryMap', () => {
  it('合法数据返回 success: true 与解析后的 data', async () => {
    const content = readFileSync(fixturePath, 'utf-8');
    const data = await parseTomlFile(content);

    const result = validateTomlStoryMap(data);
    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.errors).toBeUndefined();
  });

  it('非法数据返回 success: false 与错误详情', () => {
    const result = validateTomlStoryMap({ project: { name: '' }, user_journeys: [] });

    expect(result.success).toBe(false);
    expect(result.data).toBeUndefined();
    expect(result.errors).toBeInstanceOf(Error);

    const messages = formatValidationErrors(result.errors!);
    expect(messages).toContain('project.name: 项目名称不能为空');
    expect(messages).toContain('user_journeys: 至少需要一个用户旅程');
  });

  it('非法优先级被拒绝', () => {
    const result = validateTomlStoryMap({
      project: {
        name: 'P',
        version: '1',
        created_at: '2026-01-01',
        description: 'D',
        tech_stack: ['TS'],
      },
      user_journeys: [
        {
          id: 'UJ-001',
          name: '旅程',
          description: 'D',
          persona: 'P',
          stories: [
            {
              id: 'US-001',
              title: '故事',
              description: 'D',
              priority: 'urgent', // 非法优先级
              estimation: 1,
              acceptance_criteria: ['标准'],
            },
          ],
        },
      ],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = formatValidationErrors(result.errors!);
      expect(messages.some((m) => m.includes('user_journeys.0.stories.0.priority'))).toBe(true);
    }
  });

  it('负估算工时被拒绝', () => {
    const result = validateTomlStoryMap({
      project: {
        name: 'P',
        version: '1',
        created_at: '2026-01-01',
        description: 'D',
        tech_stack: ['TS'],
      },
      user_journeys: [
        {
          id: 'UJ-001',
          name: '旅程',
          description: 'D',
          persona: 'P',
          stories: [
            {
              id: 'US-001',
              title: '故事',
              description: 'D',
              priority: 'low',
              estimation: -1,
              acceptance_criteria: ['标准'],
            },
          ],
        },
      ],
    });

    expect(result.success).toBe(false);
  });

  it('空验收标准被拒绝', () => {
    const result = validateTomlStoryMap({
      project: {
        name: 'P',
        version: '1',
        created_at: '2026-01-01',
        description: 'D',
        tech_stack: ['TS'],
      },
      user_journeys: [
        {
          id: 'UJ-001',
          name: '旅程',
          description: 'D',
          persona: 'P',
          stories: [
            {
              id: 'US-001',
              title: '故事',
              description: 'D',
              priority: 'low',
              estimation: 1,
              acceptance_criteria: [],
            },
          ],
        },
      ],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(formatValidationErrors(result.errors!)).toContain(
        'user_journeys.0.stories.0.acceptance_criteria: 至少需要一个验收标准'
      );
    }
  });

  it('非法 created_at 日期被拒绝', () => {
    const result = validateTomlStoryMap({
      project: {
        name: 'P',
        version: '1',
        created_at: 'not-a-date',
        description: 'D',
        tech_stack: ['TS'],
      },
      user_journeys: [
        {
          id: 'UJ-001',
          name: '旅程',
          description: 'D',
          persona: 'P',
          stories: [
            {
              id: 'US-001',
              title: '故事',
              description: 'D',
              priority: 'low',
              estimation: 1,
              acceptance_criteria: ['标准'],
            },
          ],
        },
      ],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(formatValidationErrors(result.errors!)).toContain(
        'project.created_at: 创建时间必须是有效的日期格式 (YYYY-MM-DD 或 ISO 8601)'
      );
    }
  });
});

describe('formatValidationErrors', () => {
  it('将 Zod 错误格式化为 path: message 数组', () => {
    const result = TomlStoryMapSchema.safeParse({ user_journeys: [] });
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = formatValidationErrors(result.error);
      expect(messages.some((m) => m.startsWith('project:'))).toBe(true);
      expect(messages).toContain('user_journeys: 至少需要一个用户旅程');
      expect(messages.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('嵌套路径用点号连接', () => {
    const result = validateTomlStoryMap({
      project: { name: '', version: '', created_at: 'bad', description: '', tech_stack: [] },
      user_journeys: [],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = formatValidationErrors(result.errors!);
      expect(messages.some((m) => m.startsWith('project.name:'))).toBe(true);
      expect(messages.some((m) => m.startsWith('project.created_at:'))).toBe(true);
      expect(messages.some((m) => m.startsWith('project.tech_stack:'))).toBe(true);
    }
  });

  it('返回空数组当无错误（空 issues）', () => {
    expect(formatValidationErrors(new z.ZodError([]))).toEqual([]);
  });
});
