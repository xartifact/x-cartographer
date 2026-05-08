'use client';

import { useTRPC } from '@/trpc/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

/**
 * Story-related tRPC hooks
 */

export function useStory(id: string) {
  const trpc = useTRPC();
  return useQuery(
    trpc.story.byId.queryOptions({ id }, { enabled: !!id }),
  );
}

export function useStoriesByJourney(journeyId: string) {
  const trpc = useTRPC();
  return useQuery(
    trpc.story.listByJourney.queryOptions(
      { journeyId },
      { enabled: !!journeyId },
    ),
  );
}

export function useCreateStory() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  return useMutation(
    trpc.story.create.mutationOptions({
      onSuccess: (_data, variables) => {
        queryClient.invalidateQueries(
          trpc.story.listByJourney.queryFilter({ journeyId: variables.journeyId }),
        );
        queryClient.invalidateQueries(trpc.project.list.queryFilter());
      },
    }),
  );
}

export function useUpdateStory() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  return useMutation(
    trpc.story.update.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries(trpc.project.list.queryFilter());
      },
    }),
  );
}

export function useDeleteStory() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  return useMutation(
    trpc.story.delete.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries(trpc.project.list.queryFilter());
      },
    }),
  );
}

export function useUpdateStoryStatus() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  return useMutation(
    trpc.story.updateStatus.mutationOptions({
      onSuccess: (_data, variables) => {
        // Invalidate the specific story
        queryClient.invalidateQueries(
          trpc.story.byId.queryFilter({ id: variables.id }),
        );
        // Invalidate the parent project (contains all nested data)
        queryClient.invalidateQueries(trpc.project.list.queryFilter());
        // Invalidate status history
        queryClient.invalidateQueries(
          trpc.status.getHistory.queryFilter({ entityId: variables.id }),
        );
      },
    }),
  );
}
