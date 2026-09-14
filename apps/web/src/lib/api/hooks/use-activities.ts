'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import type { CreateUserActivityDTO, UpdateUserActivityDTO } from '@x-cartographer/shared';

/**
 * UserActivity REST hooks (react-query)
 * 原 use-journeys.ts 正名（backbone 用户活动），backed by the gateway REST API。
 */

// ─── Query Hooks ───────────────────────────────────────────────

export function useActivitiesByProduct(productId: string) {
  return useQuery({
    queryKey: ['user-activities', productId],
    queryFn: async () => {
      const res = await api.api['user-activities'].$get({ query: { productId } });
      return res.json();
    },
    enabled: !!productId,
  });
}

// ─── Mutation Hooks ────────────────────────────────────────────

export function useCreateActivity() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (variables: { productId: string } & Omit<CreateUserActivityDTO, 'product_id'>) => {
      const { productId, ...dto } = variables;
      const res = await api.api['user-activities'].$post({ json: { productId, ...dto } });
      return res.json();
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['user-activities', variables.productId] });
      // Also invalidate parent product (deep tree)
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
}

export function useUpdateActivity() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (variables: { id: string } & UpdateUserActivityDTO) => {
      const { id, ...dto } = variables;
      const res = await api.api['user-activities'][':id'].$patch({ param: { id }, json: dto });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
}

export function useDeleteActivity() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (variables: { id: string }) => {
      const res = await api.api['user-activities'][':id'].$delete({ param: { id: variables.id } });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
}
