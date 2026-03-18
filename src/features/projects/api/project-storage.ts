/**
 * 项目数据持久化服务
 * 使用 localStorage 存储项目数据
 */

import { v4 as uuidv4 } from 'uuid';
import type { Project, CreateProjectDTO, UpdateProjectDTO, ProjectSettings, UserJourney, UserStory } from '@/types';
import { LLMProvider } from '@/types';
import { saveToLocalStorage, loadFromLocalStorage, removeFromLocalStorage } from '@/lib/storage';
import { validateProject } from './project-validator';

/**
 * localStorage 键名
 */
const STORAGE_KEY = 'x-product-roadmap-projects';

/**
 * 当前激活项目 ID 键名
 */
const ACTIVE_PROJECT_KEY = 'x-product-roadmap-active-project';

/**
 * 获取默认项目设置
 */
export function getDefaultSettings(): ProjectSettings {
  return {
    llm_provider: LLMProvider.OPENAI,
    llm_model: 'gpt-4o',
    auto_save: true,
    display_preferences: {
      show_priority_colors: true,
      show_estimation: true,
      default_view: 'map',
    },
  };
}

/**
 * 获取所有项目
 */
export function getProjects(): Project[] {
  const data = loadFromLocalStorage<Record<string, Project>>(STORAGE_KEY);
  if (!data) {
    return [];
  }
  return Object.values(data).sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}

/**
 * 根据 ID 获取项目
 */
export function getProjectById(id: string): Project | null {
  const projects = getProjects();
  return projects.find((p) => p.id === id) || null;
}

/**
 * 创建新项目
 */
export function createProject(dto: CreateProjectDTO): Project {
  const now = new Date().toISOString();

  const project: Project = {
    id: uuidv4(),
    name: dto.name,
    description: dto.description,
    created_at: now,
    updated_at: now,
    user_journeys: [],
    metadata: {
      tech_stack: dto.tech_stack || [],
      version: '1.0.0',
      tags: [],
    },
    settings: getDefaultSettings(),
  };

  // 验证项目数据
  const validation = validateProject(project);
  if (!validation.valid) {
    throw new Error(`Invalid project: ${validation.errors.join(', ')}`);
  }

  // 保存到 localStorage
  const projects = getProjects();
  projects.push(project);
  saveToLocalStorage(STORAGE_KEY, Object.fromEntries(projects.map((p) => [p.id, p])));

  return project;
}

/**
 * 更新项目
 */
export function updateProject(id: string, dto: UpdateProjectDTO): Project | null {
  const project = getProjectById(id);
  if (!project) {
    return null;
  }

  // 更新字段
  if (dto.name !== undefined) {
    project.name = dto.name;
  }
  if (dto.description !== undefined) {
    project.description = dto.description;
  }
  if (dto.settings !== undefined) {
    project.settings = { ...project.settings, ...dto.settings };
  }

  project.updated_at = new Date().toISOString();

  // 验证项目数据
  const validation = validateProject(project);
  if (!validation.valid) {
    throw new Error(`Invalid project: ${validation.errors.join(', ')}`);
  }

  // 保存到 localStorage
  const projects = getProjects();
  const index = projects.findIndex((p) => p.id === id);
  if (index !== -1) {
    projects[index] = project;
    saveToLocalStorage(STORAGE_KEY, Object.fromEntries(projects.map((p) => [p.id, p])));
  }

  return project;
}

/**
 * 删除项目
 */
export function deleteProject(id: string): boolean {
  const projects = getProjects();
  const filtered = projects.filter((p) => p.id !== id);

  if (filtered.length === projects.length) {
    return false;
  }

  saveToLocalStorage(STORAGE_KEY, Object.fromEntries(filtered.map((p) => [p.id, p])));

  // 如果删除的是当前项目，清除激活状态
  const activeId = getActiveProjectId();
  if (activeId === id) {
    removeFromLocalStorage(ACTIVE_PROJECT_KEY);
  }

  return true;
}

/**
 * 获取项目数量
 */
export function getProjectCount(): number {
  return getProjects().length;
}

/**
 * 检查项目名称是否已存在
 */
export function isProjectNameExists(name: string, excludeId?: string): boolean {
  const projects = getProjects();
  return projects.some((p) => p.name.toLowerCase() === name.toLowerCase() && p.id !== excludeId);
}

/**
 * 设置当前激活项目
 */
export function setActiveProjectId(id: string | null): void {
  if (id === null) {
    removeFromLocalStorage(ACTIVE_PROJECT_KEY);
  } else {
    saveToLocalStorage(ACTIVE_PROJECT_KEY, id);
  }
}

/**
 * 获取当前激活项目 ID
 */
export function getActiveProjectId(): string | null {
  return loadFromLocalStorage<string>(ACTIVE_PROJECT_KEY);
}

/**
 * 获取当前激活项目
 */
export function getActiveProject(): Project | null {
  const id = getActiveProjectId();
  if (!id) {
    return null;
  }
  return getProjectById(id);
}

/**
 * 搜索项目
 */
export function searchProjects(query: string): Project[] {
  const projects = getProjects();
  const lowerQuery = query.toLowerCase();

  return projects.filter(
    (p) =>
      p.name.toLowerCase().includes(lowerQuery) ||
      p.description?.toLowerCase().includes(lowerQuery) ||
      p.metadata.tags.some((tag) => tag.toLowerCase().includes(lowerQuery))
  );
}

/**
 * 导出所有项目数据
 */
export function exportProjects(): string {
  const projects = getProjects();
  return JSON.stringify(
    {
      version: '1.0',
      exported_at: new Date().toISOString(),
      projects,
    },
    null,
    2
  );
}

/**
 * 导入项目数据
 */
export function importProjects(jsonString: string): { success: boolean; imported: number; errors: string[] } {
  const errors: string[] = [];
  let imported = 0;

  try {
    const data = JSON.parse(jsonString);

    if (!data.projects || !Array.isArray(data.projects)) {
      return { success: false, imported: 0, errors: ['Invalid format: projects array not found'] };
    }

    const existingProjects = getProjects();
    const merged = new Map<string, Project>();

    // 保留现有项目
    existingProjects.forEach((p) => merged.set(p.id, p));

    // 导入新项目
    data.projects.forEach((project: Project, index: number) => {
      try {
        // 验证项目
        const validation = validateProject(project);
        if (!validation.valid) {
          errors.push(`Project at index ${index}: ${validation.errors.join(', ')}`);
          return;
        }

        // 生成新 ID 以避免冲突
        const newProject = {
          ...project,
          id: uuidv4(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        merged.set(newProject.id, newProject);
        imported++;
      } catch (error) {
        errors.push(`Project at index ${index}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    });

    // 保存合并后的项目
    saveToLocalStorage(STORAGE_KEY, Object.fromEntries(merged));
  } catch (error) {
    errors.push(`Parse error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  return { success: errors.length === 0, imported, errors };
}

/**
 * 从 TOML 导入的项目数据创建项目
 */
export function createProjectFromToml(data: {
  name: string;
  description: string;
  version: string;
  tech_stack: string[];
  created_at: string;
  user_journeys: UserJourney[];
}): Project {
  const now = new Date().toISOString();

  const project: Project = {
    id: uuidv4(),
    name: data.name,
    description: data.description,
    created_at: data.created_at,
    updated_at: now,
    user_journeys: data.user_journeys,
    metadata: {
      tech_stack: data.tech_stack,
      version: data.version,
      tags: [],
    },
    settings: getDefaultSettings(),
  };

  // 保存到 localStorage
  const projects = getProjects();
  projects.push(project);
  saveToLocalStorage(STORAGE_KEY, Object.fromEntries(projects.map((p) => [p.id, p])));

  return project;
}

/**
 * 清空所有项目
 */
export function clearAllProjects(): void {
  removeFromLocalStorage(STORAGE_KEY);
  removeFromLocalStorage(ACTIVE_PROJECT_KEY);
}

/**
 * 合并 TOML 数据到现有项目
 * @param projectId 项目 ID
 * @param tomlData TOML 解析的数据
 * @param mode 合并模式: 'replace' 替换现有数据, 'merge' 合并数据
 */
export function mergeTomlToProject(
  projectId: string,
  tomlData: {
    name?: string;
    description?: string;
    version?: string;
    tech_stack?: string[];
    user_journeys: UserJourney[];
  },
  mode: 'replace' | 'merge' = 'merge'
): Project | null {
  const project = getProjectById(projectId);
  if (!project) {
    return null;
  }

  // 创建一个 ID 映射，用于检测和更新现有旅程
  const existingJourneyMap = new Map(
    project.user_journeys.map((j) => [j.id, j])
  );

  let mergedJourneys = project.user_journeys;

  if (mode === 'replace') {
    // 替换模式：完全替换用户旅程
    mergedJourneys = tomlData.user_journeys;
  } else {
    // 合并模式：合并或更新用户旅程
    tomlData.user_journeys.forEach((tomlJourney: UserJourney) => {
      const existing = existingJourneyMap.get(tomlJourney.id);

      if (existing) {
        // 更新现有旅程
        const index = mergedJourneys.findIndex((j) => j.id === tomlJourney.id);
        if (index !== -1) {
          // 创建故事映射
          const existingStoryMap = new Map(
            (existing.stories || []).map((s: UserStory) => [s.id, s])
          );

          // 合并故事
          const mergedStories = (tomlJourney.stories || []).map((tomlStory: UserStory) => {
            const existingStory = existingStoryMap.get(tomlStory.id);
            return existingStory ? { ...existingStory, ...tomlStory } : tomlStory;
          });

          // 添加新故事（不存在于 TOML 中的现有故事）
          (existing.stories || []).forEach((story: UserStory) => {
            if (!tomlJourney.stories?.find((s: UserStory) => s.id === story.id)) {
              mergedStories.push(story);
            }
          });

          mergedJourneys[index] = {
            ...existing,
            ...tomlJourney,
            stories: mergedStories,
          };
        }
      } else {
        // 添加新旅程
        mergedJourneys.push(tomlJourney);
      }
    });
  }

  // 更新项目基本信息（可选）
  const updatedProject: Project = {
    ...project,
    name: tomlData.name || project.name,
    description: tomlData.description || project.description,
    updated_at: new Date().toISOString(),
    user_journeys: mergedJourneys,
    metadata: {
      ...project.metadata,
      tech_stack: tomlData.tech_stack || project.metadata.tech_stack,
      version: tomlData.version || project.metadata.version,
    },
  };

  // 验证并保存
  const validation = validateProject(updatedProject);
  if (!validation.valid) {
    throw new Error(`Invalid project: ${validation.errors.join(', ')}`);
  }

  // 保存到 localStorage
  const projects = getProjects();
  const index = projects.findIndex((p) => p.id === projectId);
  if (index !== -1) {
    projects[index] = updatedProject;
    saveToLocalStorage(STORAGE_KEY, Object.fromEntries(projects.map((p) => [p.id, p])));
  }

  return updatedProject;
}