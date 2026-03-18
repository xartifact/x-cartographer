/**
 * 项目状态管理 (Zustand)
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Project, CreateProjectDTO, UpdateProjectDTO, UserJourney } from '@/types';
import {
  getProjects,
  getProjectById,
  createProject,
  updateProject,
  deleteProject,
  setActiveProjectId,
  getActiveProjectId,
  getActiveProject,
  searchProjects,
  createProjectFromToml,
  mergeTomlToProject,
} from '../api';

/**
 * 项目状态接口
 */
export interface ProjectState {
  // 项目列表
  projects: Project[];

  // 当前激活的项目
  activeProject: Project | null;

  // 加载状态
  isLoading: boolean;

  // 错误信息
  error: string | null;

  // 搜索查询
  searchQuery: string;

  // 加载所有项目
  loadProjects: () => void;

  // 设置项目列表
  setProjects: (projects: Project[]) => void;

  // 创建项目
  addProject: (dto: CreateProjectDTO) => Project;

  // 更新项目
  modifyProject: (id: string, dto: UpdateProjectDTO) => Project | null;

  // 删除项目
  removeProject: (id: string) => boolean;

  // 设置当前激活项目
  setActiveProject: (id: string | null) => void;

  // 搜索项目
  setSearchQuery: (query: string) => void;

  // 获取过滤后的项目列表
  getFilteredProjects: () => Project[];

  // 清除错误
  clearError: () => void;

  // 初始化（从 localStorage 恢复）
  initialize: () => void;

  // 从 TOML 导入项目
  importFromToml: (data: {
    name: string;
    description: string;
    version: string;
    tech_stack: string[];
    created_at: string;
    user_journeys: UserJourney[];
  }) => Project;

  // 合并 TOML 数据到现有项目
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
  ) => Project | null;
}

/**
 * 创建项目 Store
 */
export const useProjectStore = create<ProjectState>()(
  persist(
    (set, get) => ({
      // 初始状态
      projects: [],
      activeProject: null,
      isLoading: true, // 初始为加载中，等待 initialize 完成
      error: null,
      searchQuery: '',

      // 加载所有项目
      loadProjects: () => {
        try {
          set({ isLoading: true, error: null });
          const projects = getProjects();
          const activeId = getActiveProjectId();
          const activeProject = activeId ? projects.find((p) => p.id === activeId) || null : null;

          set({
            projects,
            activeProject,
            isLoading: false,
          });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to load projects',
            isLoading: false,
          });
        }
      },

      // 设置项目列表
      setProjects: (projects: Project[]) => {
        set({ projects });
      },

      // 创建项目
      addProject: (dto: CreateProjectDTO) => {
        try {
          set({ error: null });
          const project = createProject(dto);
          const { projects, activeProject } = get();

          // 添加到列表
          const newProjects = [project, ...projects];
          set({ projects: newProjects });

          // 如果没有激活项目，自动激活
          if (!activeProject) {
            setActiveProjectId(project.id);
            set({ activeProject: project });
          }

          return project;
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Failed to create project';
          set({ error: message });
          throw error;
        }
      },

      // 更新项目
      modifyProject: (id: string, dto: UpdateProjectDTO) => {
        try {
          set({ error: null });
          const updated = updateProject(id, dto);

          if (!updated) {
            set({ error: 'Project not found' });
            return null;
          }

          const { projects, activeProject } = get();
          const newProjects = projects.map((p) => (p.id === id ? updated : p));
          const newActiveProject = activeProject?.id === id ? updated : activeProject;

          set({
            projects: newProjects,
            activeProject: newActiveProject,
          });

          return updated;
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Failed to update project';
          set({ error: message });
          throw error;
        }
      },

      // 删除项目
      removeProject: (id: string) => {
        try {
          set({ error: null });
          const success = deleteProject(id);

          if (!success) {
            set({ error: 'Project not found' });
            return false;
          }

          const { projects, activeProject } = get();
          const newProjects = projects.filter((p) => p.id !== id);
          const newActiveProject = activeProject?.id === id ? null : activeProject;

          // 如果删除了激活项目，更新状态
          if (newActiveProject === null && newProjects.length > 0) {
            setActiveProjectId(newProjects[0].id);
          }

          set({
            projects: newProjects,
            activeProject: newActiveProject,
          });

          return true;
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Failed to delete project';
          set({ error: message });
          return false;
        }
      },

      // 设置当前激活项目
      setActiveProject: (id: string | null) => {
        setActiveProjectId(id);
        const project = id ? getProjectById(id) : null;
        set({ activeProject: project });
      },

      // 设置搜索查询
      setSearchQuery: (query: string) => {
        set({ searchQuery: query });
      },

      // 获取过滤后的项目列表
      getFilteredProjects: () => {
        const { projects, searchQuery } = get();

        if (!searchQuery.trim()) {
          return projects;
        }

        return searchProjects(searchQuery);
      },

      // 清除错误
      clearError: () => {
        set({ error: null });
      },

      // 初始化
      initialize: () => {
        get().loadProjects();
      },

      // 从 TOML 导入项目
      importFromToml: (data) => {
        try {
          set({ error: null });
          const project = createProjectFromToml(data);
          const { projects, activeProject } = get();

          // 添加到列表
          const newProjects = [project, ...projects];
          set({ projects: newProjects });

          // 激活导入的项目
          setActiveProjectId(project.id);
          set({ activeProject: project });

          return project;
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Failed to import project';
          set({ error: message });
          throw error;
        }
      },

      // 合并 TOML 数据到现有项目
      mergeTomlToProject: (projectId, data, mode = 'merge') => {
        try {
          set({ error: null });
          const updatedProject = mergeTomlToProject(projectId, data, mode);

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
            error instanceof Error ? error.message : 'Failed to merge project data';
          set({ error: message });
          throw error;
        }
      },
    }),
    {
      name: 'project-store',
      partialize: (state) => ({
        // 只持久化搜索查询
        searchQuery: state.searchQuery,
      }),
    }
  )
);

/**
 * 项目选择器
 */

// 获取所有项目
export const selectProjects = (state: ProjectState) => state.projects;

// 获取激活项目
export const selectActiveProject = (state: ProjectState) => state.activeProject;

// 获取加载状态
export const selectIsLoading = (state: ProjectState) => state.isLoading;

// 获取错误
export const selectError = (state: ProjectState) => state.error;

// 获取项目数量
export const selectProjectCount = (state: ProjectState) => state.projects.length;