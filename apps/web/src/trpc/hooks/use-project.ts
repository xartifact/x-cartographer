'use client';

import { useTRPC } from '@/trpc/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

/**
 * Project-related tRPC hooks
 * Replaces direct Server Action / Repository calls with tRPC mutations + TanStack Query caching
 */

// ─── Query Hooks ───────────────────────────────────────────────

export function useProjects() {
  const trpc = useTRPC();
  return useQuery(trpc.project.list.queryOptions());
}

export function useProject(id: string | undefined) {
  const trpc = useTRPC();
  return useQuery(
    trpc.project.byId.queryOptions(
      { id: id ?? '' },
      { enabled: !!id },
    ),
  );
}

export function useSearchProjects(query: string) {
  const trpc = useTRPC();
  return useQuery(
    trpc.project.search.queryOptions(
      { query },
      { enabled: query.length > 0 },
    ),
  );
}

// ─── Mutation Hooks ────────────────────────────────────────────

export function useCreateProject() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  return useMutation(
    trpc.project.create.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries(trpc.project.list.queryFilter());
      },
    }),
  );
}

export function useUpdateProject() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  return useMutation(
    trpc.project.update.mutationOptions({
      onSuccess: (_data, variables) => {
        queryClient.invalidateQueries(trpc.project.list.queryFilter());
        if (variables.id) {
          queryClient.invalidateQueries(
            trpc.project.byId.queryFilter({ id: variables.id }),
          );
        }
      },
    }),
  );
}

export function useDeleteProject() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  return useMutation(
    trpc.project.delete.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries(trpc.project.list.queryFilter());
      },
    }),
  );
}

export function useSaveFullProject() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  return useMutation(
    trpc.project.saveFull.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries(trpc.project.list.queryFilter());
      },
    }),
  );
}
