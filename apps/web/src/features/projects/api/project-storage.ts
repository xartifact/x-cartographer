'use server';

import { v4 as uuidv4 } from 'uuid';
import type {
  Project,
  CreateProjectDTO,
  UpdateProjectDTO,
  ProjectSettings,
  UserJourney,
  UserStory,
} from '@/types';
import { LLMProvider } from '@/types';
import { ProjectRepository } from '@xpm/core';
import { validateProject } from './project-validator';

const repo = new ProjectRepository();

function getDefaultSettings(): ProjectSettings {
  return {
    llm_provider: LLMProvider.OPENAI,
    auto_save: true,
    display_preferences: {
      show_priority_colors: true,
      show_estimation: true,
      default_view: 'map',
    },
    workspace_dir: undefined,
  };
}

export async function getProjects(): Promise<Project[]> {
  return repo.findAll();
}

export async function getProjectById(id: string): Promise<Project | null> {
  return repo.findById(id);
}

export async function createProject(dto: CreateProjectDTO): Promise<Project> {
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

  if (dto.workspace_dir) {
    project.settings.workspace_dir = dto.workspace_dir;
  }

  const validation = validateProject(project);
  if (!validation.valid) {
    throw new Error(`Invalid project: ${validation.errors.join(', ')}`);
  }

  await repo.saveFullProject(project);
  return project;
}

export async function updateProject(
  id: string,
  dto: UpdateProjectDTO
): Promise<Project | null> {
  const project = await repo.findById(id);
  if (!project) return null;

  if (dto.name !== undefined) project.name = dto.name;
  if (dto.description !== undefined) project.description = dto.description;
  if (dto.settings !== undefined)
    project.settings = { ...project.settings, ...dto.settings };
  if (dto.metadata !== undefined)
    project.metadata = { ...project.metadata, ...dto.metadata };
  if (dto.user_journeys !== undefined)
    project.user_journeys = dto.user_journeys;
  project.updated_at = new Date().toISOString();

  const validation = validateProject(project);
  if (!validation.valid) {
    throw new Error(`Invalid project: ${validation.errors.join(', ')}`);
  }

  await repo.saveFullProject(project);
  return project;
}

export async function deleteProject(id: string): Promise<boolean> {
  await repo.delete(id);
  return true;
}

export async function getProjectCount(): Promise<number> {
  const projects = await repo.findAll();
  return projects.length;
}

export async function isProjectNameExists(
  name: string,
  excludeId?: string
): Promise<boolean> {
  const projects = await repo.findAll();
  return projects.some(
    (p) => p.name.toLowerCase() === name.toLowerCase() && p.id !== excludeId
  );
}

export async function searchProjects(query: string): Promise<Project[]> {
  return repo.search(query);
}

export async function createProjectFromToml(data: {
  name: string;
  description: string;
  version: string;
  tech_stack: string[];
  created_at: string;
  user_journeys: UserJourney[];
}): Promise<Project> {
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

export async function clearAllProjects(): Promise<void> {
  const projects = await repo.findAll();
  for (const p of projects) {
    await repo.delete(p.id);
  }
}

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
  const project = await repo.findById(projectId);
  if (!project) return null;

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
          const mergedStories = (tomlJourney.stories || []).map(
            (tomlStory: UserStory) => {
              const existingStory = existingStoryMap.get(tomlStory.id);
              return existingStory
                ? { ...existingStory, ...tomlStory }
                : tomlStory;
            }
          );
          (existing.stories || []).forEach((story: UserStory) => {
            if (
              !tomlJourney.stories?.find((s: UserStory) => s.id === story.id)
            ) {
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
