'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { toApiError } from '@/lib/api/error';

/**
 * API Token hooks
 */

export function useApiTokenStatus() {
  return useQuery({
    queryKey: ['api-token'],
    queryFn: async () => {
      const res = await api.api.settings.token.$get();
      return res.json() as Promise<{ configured: boolean }>;
    },
  });
}

export function useCreateApiToken() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const res = await api.api.settings.token.$post();
      if (!res.ok) throw await toApiError(res, '生成 API Token 失败');
      return res.json() as Promise<{ success: boolean; token: string }>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api-token'] });
    },
  });
}

export function useDeleteApiToken() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const res = await api.api.settings.token.$delete();
      if (!res.ok) throw await toApiError(res, '撤销 API Token 失败');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api-token'] });
    },
  });
}
