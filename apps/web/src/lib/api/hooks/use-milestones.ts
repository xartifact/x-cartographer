'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import type { CreateMilestoneDTO, UpdateMilestoneDTO } from '@x-cartographer/shared';

/**
 * Milestone REST hooks (react-query)
 * 排期模型：里程碑/版本 CRUD
 */

// ─── Query Hooks ───────────────────────────────────────────────

export function useMilestonesByProject(projectId: string) {
  return useQuery({
    queryKey: ['milestones', projectId],
    queryFn: async () => {
      const res = await api.api.milestones.$get({ query: { projectId } });
      const data = await res.json();
      if (Array.isArray(data)) return data;
      return [];
    },
    enabled: !!projectId,
  });
}

// ─── Mutation Hooks ────────────────────────────────────────────

export function useCreateMilestone() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (dto: CreateMilestoneDTO) => {
      const res = await api.api.milestones.$post({ json: dto });
      return res.json();
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['milestones', variables.project_id] });
    },
  });
}

export function useUpdateMilestone() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (variables: { id: string; projectId: string } & UpdateMilestoneDTO) => {
      const { id, projectId, ...dto } = variables;
      const res = await api.api.milestones[':id'].$patch({ param: { id }, json: dto });
      return res.json();
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['milestones', variables.projectId] });
    },
  });
}

export function useDeleteMilestone() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (variables: { id: string; projectId: string }) => {
      const { id, projectId } = variables;
      const res = await api.api.milestones[':id'].$delete({ param: { id } });
      return { res: res.json(), projectId };
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['milestones', variables.projectId] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });
}
