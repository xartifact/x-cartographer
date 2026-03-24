/**
 * 项目数据持久化服务
 * 使用 Drizzle ORM + PGlite 存储项目数据
 */

import { v4 as uuidv4 } from 'uuid';
import type { Project, CreateProjectDTO, UpdateProjectDTO, ProjectSettings, UserJourney, UserStory } from '@/types';
import { LLMProvider } from '@/types';
import { ensureDb } from '@/lib/db/client';
import { ProjectRepository } from '@/lib/db/repositories/project.repository';
import { validateProject } from './project-validator';
import { saveToLocalStorage, loadFromLocalStorage, removeFromLocalStorage } from '@/lib/storage';

/**
 * localStorage 键名（仅用于 activeProjectId 和数据迁移）
 */
const ACTIVE_PROJECT_KEY = 'x-product-roadmap-active-project';
const LEGACY_STORAGE_KEY = 'x-product-roadmap-projects';
const MIGRATION_DONE_KEY = 'x-product-roadmap-db-migrated';

const repo = new ProjectRepository();

/**
 * 初始化数据库并执行 localStorage 数据迁移
 */
export async function initializeDatabase(): Promise<void> {
  await ensureDb();

  // 检查是否需要从 localStorage 迁移数据
  if (typeof window !== 'undefined') {
    const migrated = loadFromLocalStorage<boolean>(MIGRATION_DONE_KEY);
    if (!migrated) {
      await migrateFromLocalStorage();
    }
  }
}

/**
 * 从 localStorage 迁移旧数据到数据库
 */
async function migrateFromLocalStorage(): Promise<void> {
  const data = loadFromLocalStorage<Record<string, Project>>(LEGACY_STORAGE_KEY);
  if (!data) {
    saveToLocalStorage(MIGRATION_DONE_KEY, true);
    return;
  }

  const projects = Object.values(data);
  for (const project of projects) {
    try {
      await repo.saveFullProject(project);
    } catch (error) {
      console.error(`Failed to migrate project ${project.id}:`, error);
    }
  }

  saveToLocalStorage(MIGRATION_DONE_KEY, true);
  console.log(`Migrated ${projects.length} projects from localStorage to database`);
}

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
export async function getProjects(): Promise<Project[]> {
  await ensureDb();
  return repo.findAll();
}

/**
 * 根据 ID 获取项目
 */
export async function getProjectById(id: string): Promise<Project | null> {
  await ensureDb();
  return repo.findById(id);
}

/**
 * 创建新项目
 */
export async function createProject(dto: CreateProjectDTO): Promise<Project> {
  await ensureDb();
  const now = new Date().toISOString();
  const id = uuidv4();

  const project: Project = {
    id,
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

  const validation = validateProject(project);
  if (!validation.valid) {
    throw new Error(`Invalid project: ${validation.errors.join(', ')}`);
  }

  await repo.saveFullProject(project);
  return project;
}

/**
 * 更新项目
 */
export async function updateProject(id: string, dto: UpdateProjectDTO): Promise<Project | null> {
  await ensureDb();
  const project = await repo.findById(id);
  if (!project) {
    return null;
  }

  if (dto.name !== undefined) project.name = dto.name;
  if (dto.description !== undefined) project.description = dto.description;
  if (dto.settings !== undefined) {
    project.settings = { ...project.settings, ...dto.settings };
  }
  if (dto.user_journeys !== undefined) {
    project.user_journeys = dto.user_journeys;
  }
  project.updated_at = new Date().toISOString();

  const validation = validateProject(project);
  if (!validation.valid) {
    throw new Error(`Invalid project: ${validation.errors.join(', ')}`);
  }

  await repo.saveFullProject(project);
  return project;
}

/**
 * 删除项目
 */
export async function deleteProject(id: string): Promise<boolean> {
  await ensureDb();
  await repo.delete(id);

  const activeId = getActiveProjectId();
  if (activeId === id) {
    removeFromLocalStorage(ACTIVE_PROJECT_KEY);
  }
  return true;
}

/**
 * 获取项目数量
 */
export async function getProjectCount(): Promise<number> {
  const projects = await getProjects();
  return projects.length;
}

/**
 * 检查项目名称是否已存在
 */
export async function isProjectNameExists(name: string, excludeId?: string): Promise<boolean> {
  const projects = await getProjects();
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
export async function getActiveProject(): Promise<Project | null> {
  const id = getActiveProjectId();
  if (!id) {
    return null;
  }
  return getProjectById(id);
}

/**
 * 搜索项目
 */
export async function searchProjects(query: string): Promise<Project[]> {
  await ensureDb();
  return repo.search(query);
}

/**
 * 导出所有项目数据
 */
export async function exportProjects(): Promise<string> {
  const projects = await getProjects();
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
export async function importProjects(jsonString: string): Promise<{ success: boolean; imported: number; errors: string[] }> {
  const errors: string[] = [];
  let imported = 0;

  try {
    const data = JSON.parse(jsonString);

    if (!data.projects || !Array.isArray(data.projects)) {
      return { success: false, imported: 0, errors: ['Invalid format: projects array not found'] };
    }

    for (const [index, project] of (data.projects as Project[]).entries()) {
      try {
        const validation = validateProject(project);
        if (!validation.valid) {
          errors.push(`Project at index ${index}: ${validation.errors.join(', ')}`);
          continue;
        }

        const newProject: Project = {
          ...project,
          id: uuidv4(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        await repo.saveFullProject(newProject);
        imported++;
      } catch (error) {
        errors.push(`Project at index ${index}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  } catch (error) {
    errors.push(`Parse error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  return { success: errors.length === 0, imported, errors };
}

/**
 * 从 TOML 导入的项目数据创建项目
 */
export async function createProjectFromToml(data: {
  name: string;
  description: string;
  version: string;
  tech_stack: string[];
  created_at: string;
  user_journeys: UserJourney[];
}): Promise<Project> {
  await ensureDb();
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

  await repo.saveFullProject(project);
  return project;
}

/**
 * 清空所有项目
 */
export async function clearAllProjects(): Promise<void> {
  const projects = await getProjects();
  for (const p of projects) {
    await repo.delete(p.id);
  }
  removeFromLocalStorage(ACTIVE_PROJECT_KEY);
}

/**
 * 合并 TOML 数据到现有项目
 */
export async function mergeTomlToProject(
  projectId: string,
  tomlData: {
    name?: string;
    description?: string;
    version?: string;
    tech_stack?: string[];
    user_journeys: UserJourney[];
  },
  mode: 'replace' | 'merge' = 'merge'
): Promise<Project | null> {
  await ensureDb();
  const project = await repo.findById(projectId);
  if (!project) {
    return null;
  }

  const existingJourneyMap = new Map(
    project.user_journeys.map((j) => [j.id, j])
  );

  let mergedJourneys = project.user_journeys;

  if (mode === 'replace') {
    mergedJourneys = tomlData.user_journeys;
  } else {
    tomlData.user_journeys.forEach((tomlJourney: UserJourney) => {
      const existing = existingJourneyMap.get(tomlJourney.id);

      if (existing) {
        const index = mergedJourneys.findIndex((j) => j.id === tomlJourney.id);
        if (index !== -1) {
          const existingStoryMap = new Map(
            (existing.stories || []).map((s: UserStory) => [s.id, s])
          );

          const mergedStories = (tomlJourney.stories || []).map((tomlStory: UserStory) => {
            const existingStory = existingStoryMap.get(tomlStory.id);
            return existingStory ? { ...existingStory, ...tomlStory } : tomlStory;
          });

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
        mergedJourneys.push(tomlJourney);
      }
    });
  }

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

  const validation = validateProject(updatedProject);
  if (!validation.valid) {
    throw new Error(`Invalid project: ${validation.errors.join(', ')}`);
  }

  await repo.saveFullProject(updatedProject);
  return updatedProject;
}
