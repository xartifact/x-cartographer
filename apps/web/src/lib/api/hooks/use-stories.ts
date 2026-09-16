'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { toApiError } from '@/lib/api/error';
import type { Priority, StoryStatus } from '@x-cartographer/shared';

/**
 * Story REST hooks (react-query)
 * Replaces trpc/hooks/use-story.ts, backed by the gateway REST API.
 */

export interface CreateStoryVariables {
  activityId: string;
  title: string;
  description: string;
  priority: Priority;
  estimation: number;
  acceptanceCriteria?: string[];
  tags?: string[];
}

export interface UpdateStoryVariables {
  id: string;
  title?: string;
  description?: string;
  priority?: Priority;
  estimation?: number;
  acceptanceCriteria?: string[];
  tags?: string[];
  order?: number;
  position?: { x: number; y: number };
  milestoneId?: string | null;
  activityId?: string;
  userTaskId?: string | null;
}


export interface UpdateStoryStatusVariables {
  id: string;
  status: StoryStatus;
  reason?: string;
}

// ─── Query Hooks ───────────────────────────────────────────────

export function useStory(id: string) {
  return useQuery({
    queryKey: ['stories', id],
    queryFn: async () => {
      const res = await api.api.stories[':id'].$get({ param: { id } });
      return res.json();
    },
    enabled: !!id,
  });
}

export function useStoriesByActivity(activityId: string) {
  return useQuery({
    queryKey: ['stories', 'activity', activityId],
    queryFn: async () => {
      const res = await api.api.stories.$get({ query: { activityId } });
      return res.json();
    },
    enabled: !!activityId,
  });
}

// ─── Mutation Hooks ────────────────────────────────────────────

export function useCreateStory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (variables: CreateStoryVariables) => {
      const res = await api.api.stories.$post({ json: variables });
      if (!res.ok) throw await toApiError(res, '创建故事失败');
      return res.json();
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['stories', 'activity', variables.activityId] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
}

export function useUpdateStory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (variables: UpdateStoryVariables) => {
      const { id, ...dto } = variables;
      const res = await api.api.stories[':id'].$patch({ param: { id }, json: dto });
      if (!res.ok) throw await toApiError(res, '更新故事失败');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
}

export function useDeleteStory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (variables: { id: string }) => {
      const res = await api.api.stories[':id'].$delete({ param: { id: variables.id } });
      if (!res.ok) throw await toApiError(res, '删除故事失败');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
}

export function useUpdateStoryStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (variables: UpdateStoryStatusVariables) => {
      const { id, ...body } = variables;
      const res = await api.api.stories[':id'].status.$post({ param: { id }, json: body });
      if (!res.ok) throw await toApiError(res, '更新故事状态失败');
      return res.json();
    },
    onSuccess: (_data, variables) => {
      // Invalidate the specific story
      queryClient.invalidateQueries({ queryKey: ['stories', variables.id] });
      // Invalidate the parent project (contains all nested data)
      queryClient.invalidateQueries({ queryKey: ['products'] });
      // Invalidate status history
      queryClient.invalidateQueries({ queryKey: ['status-changes', variables.id] });
    },
  });
}
