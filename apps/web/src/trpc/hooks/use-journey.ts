'use client';

import { useTRPC } from '@/trpc/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

/**
 * Journey-related tRPC hooks
 */

export function useJourneysByProject(projectId: string) {
  const trpc = useTRPC();
  return useQuery(
    trpc.journey.listByProject.queryOptions(
      { projectId },
      { enabled: !!projectId },
    ),
  );
}

export function useCreateJourney() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  return useMutation(
    trpc.journey.create.mutationOptions({
      onSuccess: (_data, variables) => {
        queryClient.invalidateQueries(
          trpc.journey.listByProject.queryFilter({ projectId: variables.projectId }),
        );
        // Also invalidate parent project
        queryClient.invalidateQueries(trpc.project.list.queryFilter());
      },
    }),
  );
}

export function useUpdateJourney() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  return useMutation(
    trpc.journey.update.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries(trpc.project.list.queryFilter());
      },
    }),
  );
}

export function useDeleteJourney() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  return useMutation(
    trpc.journey.delete.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries(trpc.project.list.queryFilter());
      },
    }),
  );
}
