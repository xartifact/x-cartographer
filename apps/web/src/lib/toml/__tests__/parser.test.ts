import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  parseTomlFile,
  parseTomlStoryMap,
  serializeProjectToToml,
  serializeToTomlText,
} from '../parser';

const fixturePath = fileURLToPath(
  new URL('./fixtures/story-map-sample.toml', (() => import.meta.url)())
);
const fixtureContent = readFileSync(fixturePath, 'utf-8');

describe('parseTomlFile', () => {
  it('解析合法的 TOML 故事地图文本', async () => {
    const data = await parseTomlFile(fixtureContent);

    expect(data.project.name).toBe('X-Cartographer MVP');
    expect(data.project.version).toBe('1.1');
    expect(data.project.created_at).toBe('2025-01-07');
    expect(data.project.tech_stack).toContain('TypeScript');
    expect(data.user_journeys).toHaveLength(3);
  });

  it('解析出用户旅程及其用户故事结构', async () => {
    const data = await parseTomlFile(fixtureContent);

    const firstJourney = data.user_journeys[0];
    expect(firstJourney.id).toBe('UJ-001');
    expect(firstJourney.name).toBe('AI 辅助需求分析');
    expect(firstJourney.persona).toBe('产品经理');
    expect(firstJourney.stories).toHaveLength(3);

    const story = firstJourney.stories![0];
    expect(story.id).toBe('US-001');
    expect(story.priority).toBe('high');
    expect(story.status).toBe('done');
    expect(story.estimation).toBe(8);
    expect(story.acceptance_criteria).toHaveLength(4);
    expect(story.acceptance_criteria[0]).toBe('提供文本输入框，支持多行输入');
    expect(story.tags).toEqual(['MVP', '核心功能', 'AI交互']);
  });

  it('解析含多行数组与中文的 TOML 内容', async () => {
    const data = await parseTomlFile(`
[project]
name = "测试项目"
version = "0.1"
created_at = "2026-01-01"
description = "描述文本"
tech_stack = ["TypeScript", "React"]

[[user_journeys]]
id = "UJ-001"
name = "旅程"
description = "旅程描述"
persona = "用户"

[[user_journeys.stories]]
id = "US-001"
title = "故事标题"
description = "故事描述"
priority = "medium"
estimation = 3
acceptance_criteria = [
  "标准一",
  "标准二",
]
`);

    expect(data.project.name).toBe('测试项目');
    expect(data.user_journeys[0].stories![0].acceptance_criteria).toEqual(['标准一', '标准二']);
  });

  it('非法 TOML 语法抛出解析错误', async () => {
    await expect(parseTomlFile('[project\nname = "缺失右括号"')).rejects.toThrow();
  });

  it('缺少必填 key 的 TOML 不抛错（schema 校验阶段才拦截）', async () => {
    const data = await parseTomlFile('foo = "bar"');
    expect((data as unknown as Record<string, unknown>).foo).toBe('bar');
  });
});

describe('parseTomlStoryMap', () => {
  it('将原始 TOML 对象转换为解析后的项目数据', async () => {
    const data = await parseTomlFile(fixtureContent);
    const parsed = parseTomlStoryMap(data);

    expect(parsed.name).toBe('X-Cartographer MVP');
    expect(parsed.tech_stack).toHaveLength(5);
    expect(parsed.user_journeys).toHaveLength(3);

    const journey = parsed.user_journeys[0];
    expect(journey.id).toBe('UJ-001');
    expect(journey.stories).toHaveLength(3);

    const story = journey.stories[0];
    expect(story.id).toBe('US-001');
    expect(story.status).toBe('done');
    expect(story.tags).toEqual(['MVP', '核心功能', 'AI交互']);
    // 字符串验收标准被转换为 { description, completed: false }
    expect(story.acceptance_criteria[0]).toEqual({ description: '提供文本输入框，支持多行输入', completed: false });
  });

  it('缺失 order 的旅程使用索引作为排序', async () => {
    const data = await parseTomlFile(`
[project]
name = "P"
version = "1"
created_at = "2026-01-01"
description = "D"
tech_stack = ["TS"]

[[user_journeys]]
id = "UJ-001"
name = "旅程"
description = "D"
persona = "P"
`);

    const parsed = parseTomlStoryMap(data);
    expect(parsed.user_journeys[0].order).toBe(0);
  });
});

describe('serializeProjectToToml / serializeToTomlText', () => {
  const project: Parameters<typeof serializeProjectToToml>[0] = {
    id: 'proj-1',
    name: '序列化项目',
    description: '描述',
    version: '2.0',
    tech_stack: ['TypeScript'],
    created_at: '2026-01-01',
    updated_at: '2026-01-02',
    user_journeys: [
      {
        id: 'UJ-001',
        name: '旅程',
        description: '旅程描述',
        persona: '产品经理',
        order: 1,
        stories: [
          {
            id: 'US-001',
            title: '故事',
            description: '故事描述',
            priority: 'high',
            estimation: 5,
            acceptance_criteria: [
              { description: '已完成的验收', completed: true },
              { description: '未完成的验收', completed: false },
            ],
            tags: ['tag1'],
            status: 'in_progress',
          },
        ],
      },
    ],
  };

  it('序列化为 TOML 对象，对象验收标准按 completed 折叠为字符串', () => {
    const toml = serializeProjectToToml(project);

    expect(toml.project.name).toBe('序列化项目');
    expect(toml.user_journeys).toHaveLength(1);

    const story = toml.user_journeys[0].stories![0];
    expect(story.acceptance_criteria).toEqual([
      { description: '已完成的验收', completed: true },
      '未完成的验收',
    ]);
  });

  it('文本序列化后能被 parseTomlFile 重新解析', async () => {
    const toml = serializeProjectToToml(project);
    const text = await serializeToTomlText(toml);
    const reparsed = await parseTomlFile(text);

    expect(reparsed.project.name).toBe('序列化项目');
    expect(reparsed.user_journeys[0].stories![0].title).toBe('故事');
    expect(reparsed.user_journeys[0].stories![0].status).toBe('in_progress');
  });


  it('转义特殊字符（引号/反斜杠）', async () => {
    const toml = serializeProjectToToml({
      ...project,
      name: '含"引号"与\\反斜杠',
      user_journeys: [
        {
          ...project.user_journeys[0],
          name: '旅程"带引号"',
        },
      ],
    });
    const text = await serializeToTomlText(toml);
    const reparsed = await parseTomlFile(text);

    expect(reparsed.project.name).toBe('含"引号"与\\反斜杠');
    expect(reparsed.user_journeys[0].name).toBe('旅程"带引号"');
  });
});
