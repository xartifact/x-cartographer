/**
 * 项目相关 Hooks
 */

'use client';

import { useCallback } from 'react';
import { useProjectStore } from '@/features/projects/stores';
import type { CreateProjectDTO, UpdateProjectDTO } from '@/types';
import { useToast } from '@/hooks/use-toast';

/**
 * 项目操作 Hook
 */
export function useProjectActions() {
  const { addProject, modifyProject, removeProject, setActiveProject } = useProjectStore();
  const { toast } = useToast();

  const createProject = useCallback(
    async (dto: CreateProjectDTO) => {
      try {
        const project = await addProject(dto);
        toast({
          title: '创建成功',
          description: `已创建项目 "${project.name}"`,
        });
        return project;
      } catch (error) {
        toast({
          title: '创建失败',
          description: error instanceof Error ? error.message : '未知错误',
          variant: 'destructive',
        });
        throw error;
      }
    },
    [addProject, toast]
  );

  const updateProject = useCallback(
    async (id: string, dto: UpdateProjectDTO) => {
      try {
        const project = await modifyProject(id, dto);
        if (project) {
          toast({
            title: '更新成功',
            description: `已更新项目 "${project.name}"`,
          });
        }
        return project;
      } catch (error) {
        toast({
          title: '更新失败',
          description: error instanceof Error ? error.message : '未知错误',
          variant: 'destructive',
        });
        throw error;
      }
    },
    [modifyProject, toast]
  );

  const deleteProject = useCallback(
    async (id: string) => {
      try {
        const success = await removeProject(id);
        if (success) {
          toast({
            title: '删除成功',
            variant: 'default',
          });
        }
        return success;
      } catch (error) {
        toast({
          title: '删除失败',
          description: error instanceof Error ? error.message : '未知错误',
          variant: 'destructive',
        });
        throw error;
      }
    },
    [removeProject, toast]
  );

  const switchProject = useCallback(
    (id: string | null) => {
      setActiveProject(id);
    },
    [setActiveProject]
  );

  return {
    createProject,
    updateProject,
    deleteProject,
    switchProject,
  };
}

/**
 * 项目选择 Hook
 */
export function useProjectSelector() {
  const { projects, activeProject, setSearchQuery, getFilteredProjects } = useProjectStore();

  return {
    projects,
    activeProject,
    searchQuery: useProjectStore((state) => state.searchQuery),
    setSearchQuery,
    filteredProjects: getFilteredProjects(),
    projectCount: projects.length,
  };
}