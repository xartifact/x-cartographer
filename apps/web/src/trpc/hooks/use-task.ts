'use client';

import { useTRPC } from '@/trpc/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

/**
 * Task-related tRPC hooks
 */

export function useTask(id: string) {
  const trpc = useTRPC();
  return useQuery(
    trpc.task.byId.queryOptions({ id }, { enabled: !!id }),
  );
}

export function useTasksByStory(storyId: string) {
  const trpc = useTRPC();
  return useQuery(
    trpc.task.listByStory.queryOptions(
      { storyId },
      { enabled: !!storyId },
    ),
  );
}

export function useNextTask(projectId: string) {
  const trpc = useTRPC();
  return useQuery(
    trpc.task.next.queryOptions(
      { projectId },
      { enabled: !!projectId },
    ),
  );
}

export function useCreateTask() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  return useMutation(
    trpc.task.create.mutationOptions({
      onSuccess: (_data, variables) => {
        queryClient.invalidateQueries(
          trpc.task.listByStory.queryFilter({ storyId: variables.storyId }),
        );
        queryClient.invalidateQueries(trpc.project.list.queryFilter());
      },
    }),
  );
}

export function useUpdateTask() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  return useMutation(
    trpc.task.update.mutationOptions({
      onSuccess: (_data, variables) => {
        queryClient.invalidateQueries(
          trpc.task.byId.queryFilter({ id: variables.id }),
        );
        queryClient.invalidateQueries(trpc.project.list.queryFilter());
      },
    }),
  );
}

export function useDeleteTask() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  return useMutation(
    trpc.task.delete.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries(trpc.project.list.queryFilter());
      },
    }),
  );
}

export function useUpdateTaskStatus() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  return useMutation(
    trpc.task.updateStatus.mutationOptions({
      onSuccess: (_data, variables) => {
        // Invalidate the specific task
        queryClient.invalidateQueries(
          trpc.task.byId.queryFilter({ id: variables.id }),
        );
        // Invalidate the parent project (contains all nested data)
        queryClient.invalidateQueries(trpc.project.list.queryFilter());
        // Invalidate status history
        queryClient.invalidateQueries(
          trpc.status.getHistory.queryFilter({ entityId: variables.id }),
        );
        // Invalidate next task query
        queryClient.invalidateQueries(trpc.task.next.queryFilter());
      },
    }),
  );
}
