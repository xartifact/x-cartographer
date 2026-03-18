/**
 * TOML 导入/导出功能
 */

import { TomlStoryMap, TomlUserJourney, TomlUserStory, Project, UserJourney, UserStory, AcceptanceCriterion } from '@/features/projects/types';

/**
 * 解析 TOML 格式的用户故事
 */
function parseUserStory(tomlStory: TomlUserStory): UserStory {
  // 处理验收标准：可能是字符串数组或对象数组
  const acceptanceCriteria = tomlStory.acceptance_criteria.map((c) => {
    if (typeof c === 'string') {
      return { description: c, completed: false };
    }
    return c;
  });

  return {
    id: tomlStory.id,
    title: tomlStory.title,
    description: tomlStory.description,
    priority: tomlStory.priority,
    estimation: tomlStory.estimation,
    acceptance_criteria: acceptanceCriteria,
    tags: tomlStory.tags || [],
    status: tomlStory.status || 'backlog',
  };
}

/**
 * 解析 TOML 格式的用户旅程
 */
function parseUserJourney(tomlJourney: TomlUserJourney, index: number): UserJourney {
  return {
    id: tomlJourney.id,
    name: tomlJourney.name,
    description: tomlJourney.description,
    persona: tomlJourney.persona,
    stories: (tomlJourney.stories || []).map(parseUserStory),
    order: tomlJourney.order ?? index,
  };
}

/**
 * 从 TOML 对象解析项目数据
 */
export function parseTomlStoryMap(tomlData: TomlStoryMap): Omit<Project, 'id' | 'updated_at'> {
  const { project: metadata, user_journeys } = tomlData;

  return {
    name: metadata.name,
    description: metadata.description,
    version: metadata.version,
    tech_stack: metadata.tech_stack,
    created_at: metadata.created_at,
    user_journeys: user_journeys.map(parseUserJourney),
  };
}

/**
 * 将用户故事转换为 TOML 格式
 */
function serializeUserStory(story: UserStory): TomlUserStory {
  return {
    id: story.id,
    title: story.title,
    description: story.description,
    priority: story.priority,
    estimation: story.estimation,
    acceptance_criteria: story.acceptance_criteria.map((c) =>
      c.completed ? { description: c.description, completed: true } : c.description
    ),
    tags: story.tags,
    status: story.status,
  };
}

/**
 * 将用户旅程转换为 TOML 格式
 */
function serializeUserJourney(journey: UserJourney): TomlUserJourney {
  return {
    id: journey.id,
    name: journey.name,
    description: journey.description,
    persona: journey.persona,
    stories: journey.stories.map(serializeUserStory),
    order: journey.order,
  };
}

/**
 * 将项目数据序列化为 TOML 对象
 */
export function serializeProjectToToml(project: Project): TomlStoryMap {
  return {
    project: {
      name: project.name,
      version: project.version,
      created_at: project.created_at,
      description: project.description,
      tech_stack: project.tech_stack,
    },
    user_journeys: project.user_journeys.map(serializeUserJourney),
  };
}

/**
 * 从文本内容解析 TOML
 * 注意：需要安装 toml 解析库
 */
export async function parseTomlFile(content: string): Promise<TomlStoryMap> {
  // 动态导入 toml 解析器
  const toml = await import('toml');
  return toml.parse(content) as TomlStoryMap;
}

/**
 * 将对象序列化为 TOML 文本
 */
export async function serializeToTomlText(data: TomlStoryMap): Promise<string> {
  // 使用简单的 TOML 序列化
  // 对于复杂对象，建议使用专门的 TOML 序列化库
  const lines: string[] = [];

  // 项目元数据
  lines.push('[project]');
  lines.push(`name = "${escapeTomlString(data.project.name)}"`);
  lines.push(`version = "${escapeTomlString(data.project.version)}"`);
  lines.push(`created_at = "${escapeTomlString(data.project.created_at)}"`);
  lines.push(`description = "${escapeTomlString(data.project.description)}"`);
  lines.push(`tech_stack = [${data.project.tech_stack.map((s) => `"${s}"`).join(', ')}]`);
  lines.push('');

  // 用户旅程
  data.user_journeys.forEach((journey, journeyIndex) => {
    lines.push(`# ${'='.repeat(50)} 用户旅程 ${journeyIndex + 1}: ${journey.name} ${'='.repeat(50)}`);
    lines.push('[[user_journeys]]');
    lines.push(`id = "${escapeTomlString(journey.id)}"`);
    lines.push(`name = "${escapeTomlString(journey.name)}"`);
    lines.push(`description = "${escapeTomlString(journey.description)}"`);
    lines.push(`persona = "${escapeTomlString(journey.persona)}"`);
    lines.push('');

    // 用户故事
    journey.stories?.forEach((story) => {
      lines.push('[[user_journeys.stories]]');
      lines.push(`id = "${escapeTomlString(story.id)}"`);
      lines.push(`title = "${escapeTomlString(story.title)}"`);
      lines.push(`description = "${escapeTomlString(story.description)}"`);
      lines.push(`priority = "${story.priority}"`);
      lines.push(`estimation = ${story.estimation}`);

      if (story.acceptance_criteria && story.acceptance_criteria.length > 0) {
        lines.push('acceptance_criteria = [');
        story.acceptance_criteria.forEach((c) => {
          const criterion = typeof c === 'string' ? c : c.description;
          lines.push(`  "${escapeTomlString(criterion)}",`);
        });
        lines.push(']');
      }

      if (story.tags && story.tags.length > 0) {
        lines.push(`tags = [${story.tags.map((t) => `"${t}"`).join(', ')}]`);
      }

      if (story.status) {
        lines.push(`status = "${story.status}"`);
      }

      lines.push('');
    });
  });

  return lines.join('\n');
}

/**
 * 转义 TOML 字符串
 */
function escapeTomlString(str: string): string {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
}
