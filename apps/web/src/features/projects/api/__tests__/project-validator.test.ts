import { describe, it, expect } from 'vitest';
import type { Project } from '@/types';
import type { LLMProvider } from '@xpm/shared';
import {
  validateProject,
  validateProjectName,
  validateProjectDescription,
  validateLLMSettings,
} from '../project-validator';

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: 'proj-1',
    name: '测试项目',
    description: '描述',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    user_journeys: [],
    metadata: { tech_stack: [], version: '1.0', tags: [] },
    settings: {
      llm_provider: 'openai' as LLMProvider,
      auto_save: true,
      display_preferences: { show_priority_colors: true, show_estimation: true, default_view: 'map' },
    },
    ...overrides,
  };
}

describe('validateProject', () => {
  it('合法项目通过校验', () => {
    const result = validateProject(makeProject());
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('缺少 id 时报错', () => {
    const result = validateProject(makeProject({ id: '' }));
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Project ID is required');
  });

  it('空名称与超长名称分别报错', () => {
    const empty = validateProject(makeProject({ name: '   ' }));
    expect(empty.errors).toContain('Project name is required');

    const tooLong = validateProject(makeProject({ name: 'x'.repeat(101) }));
    expect(tooLong.errors).toContain('Project name must be 100 characters or less');
  });

  it('缺少时间戳时报错', () => {
    const result = validateProject(makeProject({ created_at: '', updated_at: '' }));
    expect(result.errors).toContain('Created timestamp is required');
    expect(result.errors).toContain('Updated timestamp is required');
  });

  it('tech_stack 非数组时报错', () => {
    const result = validateProject(
      makeProject({ metadata: { tech_stack: 'not-array' as unknown as string[], version: '1', tags: [] } })
    );
    expect(result.errors).toContain('Tech stack must be an array');
  });

  it('settings 存在但缺 llm_provider 时报错', () => {
    const result = validateProject(
      makeProject({
        settings: {
          llm_provider: '' as Project['settings']['llm_provider'],
          auto_save: true,
          display_preferences: { show_priority_colors: true, show_estimation: true, default_view: 'map' },
        },
      })
    );
    expect(result.errors).toContain('LLM provider is required');
  });

  it('用户旅程缺 id/name 时报错并标注索引', () => {
    const result = validateProject(
      makeProject({
        user_journeys: [
          {
            id: 'UJ-001',
            name: '正常旅程',
            description: 'D',
            persona: 'P',
            project_id: 'proj-1',
            stories: [],
            order: 0,
            created_at: '2026-01-01T00:00:00.000Z',
            updated_at: '2026-01-01T00:00:00.000Z',
          },
          {
            id: '',
            name: '  ',
            description: 'D',
            persona: 'P',
            project_id: 'proj-1',
            stories: [],
            order: 1,
            created_at: '2026-01-01T00:00:00.000Z',
            updated_at: '2026-01-01T00:00:00.000Z',
          },
        ],
      })
    );
    expect(result.errors).toContain('Journey at index 1: ID is required');
    expect(result.errors).toContain('Journey at index 1: Name is required');
  });
});

describe('validateProjectName', () => {
  it('合法名称通过', () => {
    expect(validateProjectName('X-Cartographer').valid).toBe(true);
    expect(validateProjectName('Story Map 2026').valid).toBe(true);
    expect(validateProjectName('a-b_c').valid).toBe(true);
  });

  it('空名称报错', () => {
    for (const name of ['', '   ', null as unknown as string, undefined as unknown as string]) {
      const result = validateProjectName(name);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Project name is required');
    }
  });

  it('少于 2 个字符报错', () => {
    const result = validateProjectName('a');
    expect(result.errors).toContain('Project name must be at least 2 characters');
  });

  it('超过 100 个字符报错', () => {
    const result = validateProjectName('x'.repeat(101));
    expect(result.errors).toContain('Project name must be 100 characters or less');
  });

  it('非法字符（中文/符号/emoji）报错', () => {
    const result = validateProjectName('项目@2026!');
    expect(result.errors).toContain(
      'Project name can only contain letters, numbers, spaces, hyphens, and underscores'
    );
  });

  it('恰好 2 个字符且合法时通过', () => {
    expect(validateProjectName('ab').valid).toBe(true);
  });

  it('恰好 100 个字符且合法时通过', () => {
    expect(validateProjectName('x'.repeat(100)).valid).toBe(true);
  });
});

describe('validateProjectDescription', () => {
  it('空描述通过', () => {
    expect(validateProjectDescription('').valid).toBe(true);
  });

  it('超过 1000 字符报错', () => {
    const result = validateProjectDescription('x'.repeat(1001));
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Description must be 1000 characters or less');
  });

  it('恰好 1000 字符通过', () => {
    expect(validateProjectDescription('x'.repeat(1000)).valid).toBe(true);
  });
});

describe('validateLLMSettings', () => {
  it('完整设置通过', () => {
    expect(validateLLMSettings({ provider: 'openai', model: 'gpt-4' }).valid).toBe(true);
  });

  it('缺少 provider 或 model 报错', () => {
    const result = validateLLMSettings({ provider: '', model: '' });
    expect(result.errors).toContain('LLM provider is required');
    expect(result.errors).toContain('LLM model is required');
  });

  it('空 apiKey 报错', () => {
    const result = validateLLMSettings({ provider: 'openai', model: 'gpt-4', apiKey: '' });
    expect(result.errors).toContain('API key cannot be empty');
  });
});
