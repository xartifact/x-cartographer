"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { toApiError } from "@/lib/api/error";
import type { ActiveAgentTask, DevTask, TaskStatus, TaskPriority } from "@x-cartographer/shared";

/**
 * DevTask REST hooks (react-query)
 * 原 use-tasks.ts 正名（执行域研发任务；type 字段已废除），backed by the gateway REST API。
 */

export interface CreateDevTaskVariables {
  storyId?: string;
  moduleId?: string;
  productId?: string;
  title: string;
  description: string;
  priority: TaskPriority;
  estimation: number;
  dependencies?: string[];
  tags?: string[];
}

export interface UpdateDevTaskVariables {
  id: string;
  title?: string;
  description?: string;
  priority?: TaskPriority;
  estimation?: number;
  status?: TaskStatus;
  dependencies?: string[];
  tags?: string[];
  assignee?: string;
  affectedModules?: string[];
  moduleId?: string;
  productId?: string;
  storyId?: string | null;
}

export interface UpdateDevTaskStatusVariables {
  id: string;
  status: TaskStatus;
  reason?: string;
  expected_status?: TaskStatus;
}

// ─── Query Hooks ───────────────────────────────────────────────

export function useDevTask(id: string, refetchInterval: number | false = false) {
  return useQuery({
    queryKey: ["dev-tasks", id],
    queryFn: async () => {
      const res = await api.api["dev-tasks"][":id"].$get({ param: { id } });
      if (!res.ok) throw await toApiError(res, "请求失败，请重试");
      return res.json();
    },
    enabled: !!id,
    refetchInterval,
  });
}

export function useDevTasksByStory(storyId: string) {
  return useQuery({
    queryKey: ["dev-tasks", "story", storyId],
    queryFn: async () => {
      const res = await api.api["dev-tasks"].$get({ query: { storyId } });
      if (!res.ok) throw await toApiError(res, "请求失败，请重试");
      return res.json();
    },
    enabled: !!storyId,
  });
}

export interface AllDevTask extends DevTask {
  product: { id: string; name: string };
  story: { id: string; title: string } | null;
}

export function useAllDevTasks(options?: {
  productId?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  enabled?: boolean;
  refetchInterval?: number | false;
}) {
  const { productId, status, priority, enabled = true, refetchInterval = false } = options ?? {};
  return useQuery({
    enabled,
    refetchInterval,
    queryKey: ["dev-tasks", "all", { productId, status, priority }],
    queryFn: async () => {
      const res = await api.api["dev-tasks"].all.$get({ query: { productId, status, priority } });
      if (!res.ok) throw await toApiError(res, "请求失败，请重试");
      return res.json() as Promise<AllDevTask[]>;
    },
  });
}

/** Visibility-aware polling: a task state is not an Agent heartbeat. */
export function useActiveAgentTasks() {
  return useQuery({
    queryKey: ["dev-tasks", "active"],
    queryFn: async (): Promise<ActiveAgentTask[]> => {
      const res = await api.api["dev-tasks"].active.$get();
      if (!res.ok) throw await toApiError(res, "读取执行任务失败");
      return res.json() as Promise<ActiveAgentTask[]>;
    },
    refetchInterval: 15_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: "always",
  });
}

export function useNextDevTask(productId: string) {
  return useQuery({
    queryKey: ["dev-tasks", "next", productId],
    queryFn: async () => {
      const res = await api.api["dev-tasks"].next.$get({ query: { productId } });
      if (!res.ok) throw await toApiError(res, "请求失败，请重试");
      return res.json();
    },
    enabled: !!productId,
  });
}

// ─── Mutation Hooks ────────────────────────────────────────────

/** 服务端创建响应：携带序列分配的主键 */
export interface CreateDevTaskResult {
  success: boolean;
  id: string;
}

export function useCreateDevTask() {
  const queryClient = useQueryClient();

  return useMutation<CreateDevTaskResult, Error, CreateDevTaskVariables>({
    mutationFn: async (variables) => {
      const res = await api.api["dev-tasks"].$post({ json: variables });
      if (!res.ok) throw await toApiError(res, "创建研发任务失败");
      return (await res.json()) as CreateDevTaskResult;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["dev-tasks", "story", variables.storyId] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["dev-tasks", "all"] });
    },
  });
}

export function useUpdateDevTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (variables: UpdateDevTaskVariables) => {
      const { id, ...dto } = variables;
      const res = await api.api["dev-tasks"][":id"].$patch({ param: { id }, json: dto });
      if (!res.ok) throw await toApiError(res, "更新研发任务失败");
      return res.json();
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["dev-tasks", variables.id] });
      queryClient.invalidateQueries({ queryKey: ["dev-tasks", "all"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["dev-tasks", "all"] });
    },
  });
}

export function useUpdateDevTaskStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (variables: UpdateDevTaskStatusVariables) => {
      const { id, ...body } = variables;
      const res = await api.api["dev-tasks"][":id"].status.$post({ param: { id }, json: body });
      if (!res.ok) throw await toApiError(res, "更新任务状态失败");
      return res.json();
    },
    onSuccess: (_data, variables) => {
      // Invalidate the specific dev task
      queryClient.invalidateQueries({ queryKey: ["dev-tasks", variables.id] });
      // Invalidate the parent product (contains all nested data)
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["dev-tasks", "all"] });
      // Invalidate status history
      queryClient.invalidateQueries({ queryKey: ["status-changes", variables.id] });
      // Invalidate next task query
      queryClient.invalidateQueries({ queryKey: ["dev-tasks", "next"] });
      // Invalidate cross-product task aggregation
      queryClient.invalidateQueries({ queryKey: ["dev-tasks", "all"] });
    },
  });
}

export function useDeleteDevTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (variables: { id: string }) => {
      const res = await api.api["dev-tasks"][":id"].$delete({ param: { id: variables.id } });
      if (!res.ok) throw await toApiError(res, "删除研发任务失败");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["dev-tasks", "all"] });
    },
  });
}
