'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import type { Project, CreateProjectDTO, UpdateProjectDTO } from '@xpm/shared';

/**
 * Project REST hooks (react-query)
 * Replaces trpc/hooks/use-project.ts, backed by the gateway REST API.
 */

// ─── Query Hooks ───────────────────────────────────────────────

export function useProjects() {
  return useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const res = await api.api.projects.$get();
      return res.json();
    },
  });
}

export function useProject(id: string | undefined) {
  return useQuery({
    queryKey: ['projects', id],
    queryFn: async () => {
      const res = await api.api.projects[':id'].$get({ param: { id: id! } });
      return res.json();
    },
    enabled: !!id,
  });
}

export function useSearchProjects(query: string) {
  return useQuery({
    queryKey: ['projects', 'search', query],
    queryFn: async () => {
      const res = await api.api.projects.search.$get({ query: { q: query } });
      return res.json();
    },
    enabled: query.length > 0,
  });
}

// ─── Mutation Hooks ────────────────────────────────────────────

export function useCreateProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (dto: CreateProjectDTO) => {
      const res = await api.api.projects.$post({ json: dto });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });
}

export function useUpdateProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (variables: { id: string } & UpdateProjectDTO) => {
      const { id, ...dto } = variables;
      const res = await api.api.projects[':id'].$patch({ param: { id }, json: dto });
      return res.json();
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      if (variables.id) {
        queryClient.invalidateQueries({ queryKey: ['projects', variables.id] });
      }
    },
  });
}

export function useDeleteProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (variables: { id: string }) => {
      const res = await api.api.projects[':id'].$delete({ param: { id: variables.id } });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });
}

export function useSaveFullProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (variables: { project: Project }) => {
      const res = await api.api.projects.full.$put({ json: variables });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });
}
