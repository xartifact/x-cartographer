'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import type { CreateUserJourneyDTO, UpdateUserJourneyDTO } from '@xpm/shared';

/**
 * Journey REST hooks (react-query)
 * Replaces trpc/hooks/use-journey.ts, backed by the gateway REST API.
 */

// ─── Query Hooks ───────────────────────────────────────────────

export function useJourneysByProject(projectId: string) {
  return useQuery({
    queryKey: ['journeys', projectId],
    queryFn: async () => {
      const res = await api.api.journeys.$get({ query: { projectId } });
      return res.json();
    },
    enabled: !!projectId,
  });
}

// ─── Mutation Hooks ────────────────────────────────────────────

export function useCreateJourney() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (variables: { projectId: string } & Omit<CreateUserJourneyDTO, 'project_id'>) => {
      const { projectId, ...dto } = variables;
      const res = await api.api.journeys.$post({ json: { projectId, ...dto } });
      return res.json();
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['journeys', variables.projectId] });
      // Also invalidate parent project
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });
}

export function useUpdateJourney() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (variables: { id: string } & UpdateUserJourneyDTO) => {
      const { id, ...dto } = variables;
      const res = await api.api.journeys[':id'].$patch({ param: { id }, json: dto });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });
}

export function useDeleteJourney() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (variables: { id: string }) => {
      const res = await api.api.journeys[':id'].$delete({ param: { id: variables.id } });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });
}
