'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import type { Priority, StoryStatus } from '@xpm/shared';

/**
 * Story REST hooks (react-query)
 * Replaces trpc/hooks/use-story.ts, backed by the gateway REST API.
 */

export interface CreateStoryVariables {
  journeyId: string;
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

export function useStoriesByJourney(journeyId: string) {
  return useQuery({
    queryKey: ['stories', 'journey', journeyId],
    queryFn: async () => {
      const res = await api.api.stories.$get({ query: { journeyId } });
      return res.json();
    },
    enabled: !!journeyId,
  });
}

// ─── Mutation Hooks ────────────────────────────────────────────

export function useCreateStory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (variables: CreateStoryVariables) => {
      const res = await api.api.stories.$post({ json: variables });
      return res.json();
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['stories', 'journey', variables.journeyId] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });
}

export function useUpdateStory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (variables: UpdateStoryVariables) => {
      const { id, ...dto } = variables;
      const res = await api.api.stories[':id'].$patch({ param: { id }, json: dto });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });
}

export function useDeleteStory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (variables: { id: string }) => {
      const res = await api.api.stories[':id'].$delete({ param: { id: variables.id } });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });
}

export function useUpdateStoryStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (variables: UpdateStoryStatusVariables) => {
      const { id, ...body } = variables;
      const res = await api.api.stories[':id'].status.$post({ param: { id }, json: body });
      return res.json();
    },
    onSuccess: (_data, variables) => {
      // Invalidate the specific story
      queryClient.invalidateQueries({ queryKey: ['stories', variables.id] });
      // Invalidate the parent project (contains all nested data)
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      // Invalidate status history
      queryClient.invalidateQueries({ queryKey: ['status-changes', variables.id] });
    },
  });
}
