/**
 * 项目相关 Hooks — 基于 lib/api hooks（gateway REST）
 */

'use client';

import { useCallback } from 'react';
import { useProjectStore, selectActiveProjectId, selectSearchQuery } from '@/features/projects/stores';
import {
  useProjects,
  useProject,
  useSearchProjects,
  useCreateProject,
  useUpdateProject,
  useDeleteProject,
} from '@/lib/api/hooks';
import { toast } from 'sonner';
import type { CreateProjectDTO, UpdateProjectDTO, Project } from '@xpm/shared';

/**
 * 项目操作 Hook — 基于 lib/api hooks（gateway REST）
 */
export function useProjectActions() {
  const { setActiveProjectId } = useProjectStore();
  const createProjectMutation = useCreateProject();
  const updateProjectMutation = useUpdateProject();
  const deleteProjectMutation = useDeleteProject();

  const createProject = useCallback(
    async (dto: CreateProjectDTO) => {
      try {
        const result = await createProjectMutation.mutateAsync(dto);
        toast.success('创建成功', { description: `已创建项目 "${dto.name}"` });
        return result;
      } catch (error) {
        toast.error('创建失败', { description: error instanceof Error ? error.message : '未知错误' });        throw error;
      }
    },
    [createProjectMutation, toast],
  );

  const updateProject = useCallback(
    async (id: string, dto: UpdateProjectDTO) => {
      try {
        await updateProjectMutation.mutateAsync({ id, ...dto });
        toast.success('更新成功', { description: '已更新项目' });      } catch (error) {
        toast.error('更新失败', { description: error instanceof Error ? error.message : '未知错误' });        throw error;
      }
    },
    [updateProjectMutation, toast],
  );

  const deleteProject = useCallback(
    async (id: string) => {
      try {
        await deleteProjectMutation.mutateAsync({ id });
        toast.success('删除成功');        return true;
      } catch (error) {
        toast.error('删除失败', { description: error instanceof Error ? error.message : '未知错误' });        throw error;
      }
    },
    [deleteProjectMutation, toast],
  );

  const switchProject = useCallback(
    (id: string | null) => {
      setActiveProjectId(id);
    },
    [setActiveProjectId],
  );

  return {
    createProject,
    updateProject,
    deleteProject,
    switchProject,
  };
}

/**
 * 项目选择 Hook — 基于 lib/api hooks queries
 */
export function useProjectSelector() {
  const { data: projects = [], isLoading, error } = useProjects();
  const activeProjectId = useProjectStore(selectActiveProjectId);
  const searchQuery = useProjectStore(selectSearchQuery);
  const { setSearchQuery } = useProjectStore();
  const { data: searchResults } = useSearchProjects(searchQuery);

  const activeProject = projects.find((p) => p.id === activeProjectId) ?? null;

  const filteredProjects = searchQuery.trim()
    ? (searchResults ?? projects)
    : projects;

  return {
    projects,
    activeProject,
    activeProjectId,
    searchQuery,
    setSearchQuery,
    filteredProjects,
    projectCount: projects.length,
    isLoading,
    error: error?.message ?? null,
  };
}

/**
 * 单个项目 Hook — 获取完整项目数据
 */
export function useActiveProject() {
  const activeProjectId = useProjectStore(selectActiveProjectId);
  const { data: projects } = useProjects();
  const { data: project, isLoading } = useProject(activeProjectId ?? undefined);

  const activeProject = projects?.find((p) => p.id === activeProjectId) ?? project ?? null;

  return {
    activeProject,
    activeProjectId,
    isLoading,
  };
}
