'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import type { CreateMilestoneDTO, Milestone, UpdateMilestoneDTO } from '@x-cartographer/shared';

/**
 * Milestone REST hooks (react-query)
 * 排期模型：里程碑/版本 CRUD
 */

// ─── Query Hooks ───────────────────────────────────────────────

export function useMilestonesByProduct(productId: string) {
  return useQuery({
    queryKey: ['milestones', productId],
    queryFn: async (): Promise<Milestone[]> => {
      const res = await api.api.milestones.$get({ query: { productId } });
      const data = await res.json();
      if (Array.isArray(data)) return data as Milestone[];
      return [];
    },
    enabled: !!productId,
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
      queryClient.invalidateQueries({ queryKey: ['milestones', variables.product_id] });
    },
  });
}

export function useUpdateMilestone() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (variables: { id: string; productId: string } & UpdateMilestoneDTO) => {
      const { id, productId, ...dto } = variables;
      const res = await api.api.milestones[':id'].$patch({ param: { id }, json: dto });
      return res.json();
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['milestones', variables.productId] });
    },
  });
}

export function useDeleteMilestone() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (variables: { id: string; productId: string }) => {
      const { id, productId } = variables;
      const res = await api.api.milestones[':id'].$delete({ param: { id } });
      return { res: res.json(), productId };
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['milestones', variables.productId] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
}
