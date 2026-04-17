/**
 * 项目状态管理 (Zustand)
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createLogger } from '@/lib/logger';
import type {
  Project,
  CreateProjectDTO,
  UpdateProjectDTO,
  UserJourney,
} from '@/types';
import {
  getProjects,
  getProjectById,
  createProject,
  updateProject,
  deleteProject,
  createProjectFromToml,
  mergeTomlToProject,
} from '../api';

const log = createLogger('projectStore');

const ACTIVE_PROJECT_KEY = 'x-product-roadmap-active-project';

function getActiveProjectId(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(ACTIVE_PROJECT_KEY);
}

function setActiveProjectId(id: string | null): void {
  if (typeof window === 'undefined') return;
  if (id === null) {
    localStorage.removeItem(ACTIVE_PROJECT_KEY);
  } else {
    localStorage.setItem(ACTIVE_PROJECT_KEY, id);
  }
}

/**
 * 项目状态接口
 */
export interface ProjectState {
  projects: Project[];
  activeProject: Project | null;
  isLoading: boolean;
  error: string | null;
  searchQuery: string;

  loadProjects: () => Promise<void>;
  setProjects: (projects: Project[]) => void;
  addProject: (dto: CreateProjectDTO) => Promise<Project>;
  modifyProject: (id: string, dto: UpdateProjectDTO) => Promise<Project | null>;
  removeProject: (id: string) => Promise<boolean>;
  setActiveProject: (id: string | null) => Promise<void>;
  setSearchQuery: (query: string) => void;
  getFilteredProjects: () => Project[];
  clearError: () => void;
  initialize: () => Promise<void>;
  importFromToml: (data: {
    name: string;
    description: string;
    version: string;
    tech_stack: string[];
    created_at: string;
    user_journeys: UserJourney[];
  }) => Promise<Project>;
  mergeTomlToProject: (
    projectId: string,
    data: {
      name?: string;
      description?: string;
      version?: string;
      tech_stack?: string[];
      user_journeys: UserJourney[];
    },
    mode?: 'replace' | 'merge'
  ) => Promise<Project | null>;
}

/**
 * 创建项目 Store
 */
export const useProjectStore = create<ProjectState>()(
  persist(
    (set, get) => ({
      projects: [],
      activeProject: null,
      isLoading: true,
      error: null,
      searchQuery: '',

      loadProjects: async () => {
        try {
          set({ isLoading: true, error: null });
          log.debug('store.loading', { message: 'Loading projects from DB' });
          const projects = await getProjects();
          const activeId = getActiveProjectId();
          const activeProject = activeId
            ? projects.find((p) => p.id === activeId) || null
            : null;

          log.debug('store.loaded', { count: projects.length });
          set({
            projects,
            activeProject,
            isLoading: false,
          });
        } catch (error) {
          log.error('store.load.failed', {
            error: error instanceof Error ? error.message : String(error),
          });
          set({
            error:
              error instanceof Error
                ? error.message
                : 'Failed to load projects',
            isLoading: false,
          });
        }
      },

      setProjects: (projects: Project[]) => {
        set({ projects });
      },

      addProject: async (dto: CreateProjectDTO) => {
        try {
          set({ error: null });
          log.debug('store.creating', { name: dto.name });
          const project = await createProject(dto);
          log.debug('store.created', { projectId: project.id });
          const { projects, activeProject } = get();

          const newProjects = [project, ...projects];
          set({ projects: newProjects });

          if (!activeProject) {
            setActiveProjectId(project.id);
            set({ activeProject: project });
          }

          return project;
        } catch (error) {
          const message =
            error instanceof Error ? error.message : 'Failed to create project';
          set({ error: message });
          throw error;
        }
      },

      modifyProject: async (id: string, dto: UpdateProjectDTO) => {
        try {
          set({ error: null });
          const updated = await updateProject(id, dto);

          if (!updated) {
            set({ error: 'Project not found' });
            return null;
          }

          const { projects, activeProject } = get();
          const newProjects = projects.map((p) => (p.id === id ? updated : p));
          const newActiveProject =
            activeProject?.id === id ? updated : activeProject;

          set({
            projects: newProjects,
            activeProject: newActiveProject,
          });

          return updated;
        } catch (error) {
          const message =
            error instanceof Error ? error.message : 'Failed to update project';
          set({ error: message });
          throw error;
        }
      },

      removeProject: async (id: string) => {
        try {
          set({ error: null });
          await deleteProject(id);

          const { projects, activeProject } = get();
          const newProjects = projects.filter((p) => p.id !== id);
          const newActiveProject =
            activeProject?.id === id ? null : activeProject;

          if (newActiveProject === null && newProjects.length > 0) {
            setActiveProjectId(newProjects[0].id);
          }

          set({
            projects: newProjects,
            activeProject: newActiveProject,
          });

          return true;
        } catch (error) {
          const message =
            error instanceof Error ? error.message : 'Failed to delete project';
          set({ error: message });
          return false;
        }
      },

      setActiveProject: async (id: string | null) => {
        setActiveProjectId(id);
        const project = id ? await getProjectById(id) : null;
        set({ activeProject: project });
      },

      setSearchQuery: (query: string) => {
        set({ searchQuery: query });
      },

      getFilteredProjects: () => {
        const { projects, searchQuery } = get();

        if (!searchQuery.trim()) {
          return projects;
        }

        const lowerQuery = searchQuery.toLowerCase();
        return projects.filter(
          (p) =>
            p.name.toLowerCase().includes(lowerQuery) ||
            p.description?.toLowerCase().includes(lowerQuery) ||
            p.metadata.tags.some((tag) =>
              tag.toLowerCase().includes(lowerQuery)
            )
        );
      },

      clearError: () => {
        set({ error: null });
      },

      initialize: async () => {
        await get().loadProjects();
      },

      importFromToml: async (data) => {
        try {
          set({ error: null });
          const project = await createProjectFromToml(data);
          const { projects } = get();

          const newProjects = [project, ...projects];
          set({ projects: newProjects });

          setActiveProjectId(project.id);
          set({ activeProject: project });

          return project;
        } catch (error) {
          const message =
            error instanceof Error ? error.message : 'Failed to import project';
          set({ error: message });
          throw error;
        }
      },

      mergeTomlToProject: async (projectId, data, mode = 'merge') => {
        try {
          set({ error: null });
          const updatedProject = await mergeTomlToProject(
            projectId,
            data,
            mode
          );

          if (!updatedProject) {
            set({ error: 'Project not found' });
            return null;
          }

          const { projects, activeProject } = get();
          const newProjects = projects.map((p) =>
            p.id === projectId ? updatedProject : p
          );
          const newActiveProject =
            activeProject?.id === projectId ? updatedProject : activeProject;

          set({
            projects: newProjects,
            activeProject: newActiveProject,
          });

          return updatedProject;
        } catch (error) {
          const message =
            error instanceof Error
              ? error.message
              : 'Failed to merge project data';
          set({ error: message });
          throw error;
        }
      },
    }),
    {
      name: 'project-store',
      partialize: (state) => ({
        searchQuery: state.searchQuery,
      }),
    }
  )
);

/**
 * 项目选择器
 */
export const selectProjects = (state: ProjectState) => state.projects;
export const selectActiveProject = (state: ProjectState) => state.activeProject;
export const selectIsLoading = (state: ProjectState) => state.isLoading;
export const selectError = (state: ProjectState) => state.error;
export const selectProjectCount = (state: ProjectState) =>
  state.projects.length;
