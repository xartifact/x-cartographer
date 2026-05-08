'use client';

import { useTRPC } from '@/trpc/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

/**
 * Status change history tRPC hooks
 */

export function useStatusHistory(entityId: string) {
  const trpc = useTRPC();
  return useQuery(
    trpc.status.getHistory.queryOptions(
      { entityId },
      { enabled: !!entityId },
    ),
  );
}

export function useAllStatusChanges() {
  const trpc = useTRPC();
  return useQuery(trpc.status.getAll.queryOptions());
}

export function useCreateStatusChange() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  return useMutation(
    trpc.status.create.mutationOptions({
      onSuccess: (_data, variables) => {
        queryClient.invalidateQueries(
          trpc.status.getHistory.queryFilter({ entityId: variables.entityId }),
        );
        queryClient.invalidateQueries(trpc.status.getAll.queryFilter());
      },
    }),
  );
}
