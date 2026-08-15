'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import type { TaskStatus, TaskType, TaskPriority } from '@xpm/shared';

/**
 * Task REST hooks (react-query)
 * Replaces trpc/hooks/use-task.ts, backed by the gateway REST API.
 */

export interface CreateTaskVariables {
  storyId: string;
  title: string;
  description: string;
  type: TaskType;
  priority: TaskPriority;
  estimation: number;
  dependencies?: string[];
  tags?: string[];
}

export interface UpdateTaskVariables {
  id: string;
  title?: string;
  description?: string;
  type?: TaskType;
  priority?: TaskPriority;
  estimation?: number;
  status?: TaskStatus;
  dependencies?: string[];
  tags?: string[];
  assignee?: string;
}

export interface UpdateTaskStatusVariables {
  id: string;
  status: TaskStatus;
  reason?: string;
}

// ─── Query Hooks ───────────────────────────────────────────────

export function useTask(id: string) {
  return useQuery({
    queryKey: ['tasks', id],
    queryFn: async () => {
      const res = await api.api.tasks[':id'].$get({ param: { id } });
      return res.json();
    },
    enabled: !!id,
  });
}

export function useTasksByStory(storyId: string) {
  return useQuery({
    queryKey: ['tasks', 'story', storyId],
    queryFn: async () => {
      const res = await api.api.tasks.$get({ query: { storyId } });
      return res.json();
    },
    enabled: !!storyId,
  });
}

export function useNextTask(projectId: string) {
  return useQuery({
    queryKey: ['tasks', 'next', projectId],
    queryFn: async () => {
      const res = await api.api.tasks.next.$get({ query: { projectId } });
      return res.json();
    },
    enabled: !!projectId,
  });
}

// ─── Mutation Hooks ────────────────────────────────────────────

export function useCreateTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (variables: CreateTaskVariables) => {
      const res = await api.api.tasks.$post({ json: variables });
      return res.json();
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['tasks', 'story', variables.storyId] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });
}

export function useUpdateTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (variables: UpdateTaskVariables) => {
      const { id, ...dto } = variables;
      const res = await api.api.tasks[':id'].$patch({ param: { id }, json: dto });
      return res.json();
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['tasks', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });
}

export function useDeleteTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (variables: { id: string }) => {
      const res = await api.api.tasks[':id'].$delete({ param: { id: variables.id } });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });
}

export function useUpdateTaskStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (variables: UpdateTaskStatusVariables) => {
      const { id, ...body } = variables;
      const res = await api.api.tasks[':id'].status.$post({ param: { id }, json: body });
      return res.json();
    },
    onSuccess: (_data, variables) => {
      // Invalidate the specific task
      queryClient.invalidateQueries({ queryKey: ['tasks', variables.id] });
      // Invalidate the parent project (contains all nested data)
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      // Invalidate status history
      queryClient.invalidateQueries({ queryKey: ['status-changes', variables.id] });
      // Invalidate next task query
      queryClient.invalidateQueries({ queryKey: ['tasks', 'next'] });
    },
  });
}
