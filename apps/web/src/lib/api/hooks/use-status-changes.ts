'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';

/**
 * Status change history REST hooks (react-query)
 * Replaces trpc/hooks/use-status.ts, backed by the gateway REST API.
 */

export interface CreateStatusChangeVariables {
  entityId: string;
  entityType: 'task' | 'story';
  previousStatus: string;
  newStatus: string;
  reason?: string;
  changedBy?: string;
}

// ─── Query Hooks ───────────────────────────────────────────────

export function useStatusHistory(entityId: string) {
  return useQuery({
    queryKey: ['status-changes', entityId],
    queryFn: async () => {
      const res = await api.api['status-changes'].$get({ query: { entityId } });
      return res.json();
    },
    enabled: !!entityId,
  });
}

export function useAllStatusChanges() {
  return useQuery({
    queryKey: ['status-changes'],
    queryFn: async () => {
      const res = await api.api['status-changes'].$get();
      return res.json();
    },
  });
}

// ─── Mutation Hooks ────────────────────────────────────────────

export function useCreateStatusChange() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (variables: CreateStatusChangeVariables) => {
      const res = await api.api['status-changes'].$post({ json: variables });
      return res.json();
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['status-changes', variables.entityId] });
      queryClient.invalidateQueries({ queryKey: ['status-changes'] });
    },
  });
}
