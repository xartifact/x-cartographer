'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { toApiError } from '@/lib/api/error';
import type { CreateUserTaskDTO, UpdateUserTaskDTO } from '@x-cartographer/shared';

/**
 * UserTask REST hooks (react-query)
 * 活动下的用户操作步骤（地图元素），backed by the gateway REST API。
 *
 * hc 对非 2xx 不抛错（只置 ok=false），故每处响应都显式检查，
 * 否则写失败会被静默吞掉（mutateAsync 正常 resolve，UI 报告成功）。
 */

// ─── Query Hooks ───────────────────────────────────────────────

export function useUserTasksByActivity(activityId: string) {
  return useQuery({
    queryKey: ['user-tasks', activityId],
    queryFn: async () => {
      const res = await api.api['user-tasks'].$get({ query: { activityId } });
      if (!res.ok) throw await toApiError(res, '加载用户任务失败');
      return res.json();
    },
    enabled: !!activityId,
  });
}

// ─── Mutation Hooks ────────────────────────────────────────────

export function useCreateUserTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (dto: CreateUserTaskDTO) => {
      // CreateUserTaskDTO 用 snake（activity_id），server schema 收 camel（activityId）
      const { activity_id, ...rest } = dto;
      const res = await api.api['user-tasks'].$post({
        json: { activityId: activity_id, ...rest },
      });
      if (!res.ok) throw await toApiError(res, '创建用户任务失败');
      return res.json();
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['user-tasks', variables.activity_id] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
}

export function useUpdateUserTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (variables: { id: string; activityId?: string } & UpdateUserTaskDTO) => {
      const { id, activityId, ...dto } = variables;
      const res = await api.api['user-tasks'][':id'].$patch({ param: { id }, json: dto });
      if (!res.ok) throw await toApiError(res, '更新用户任务失败');
      return res.json();
    },
    onSuccess: (_data, variables) => {
      if (variables.activityId) {
        queryClient.invalidateQueries({ queryKey: ['user-tasks', variables.activityId] });
      }
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
}

export function useDeleteUserTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (variables: { id: string }) => {
      const res = await api.api['user-tasks'][':id'].$delete({ param: { id: variables.id } });
      if (!res.ok) throw await toApiError(res, '删除用户任务失败');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
}

// ─── 按产品聚合查询 ────────────────────────────────────────────

/** 按产品拉全部用户任务（跨活动，页面聚合视图用） */
export function useUserTasksByProduct(productId: string) {
  return useQuery({
    queryKey: ['user-tasks', 'product', productId],
    queryFn: async () => {
      const res = await api.api['user-tasks'].$get({
        query: { productId },
      });
      if (!res.ok) throw await toApiError(res, '加载用户任务失败');
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
    enabled: !!productId,
  });
}
