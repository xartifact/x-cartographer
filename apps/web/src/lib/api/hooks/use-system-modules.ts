'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { toApiError } from '@/lib/api/error';
import type { Provenance } from '@x-cartographer/shared';

/**
 * SystemModule REST hooks (react-query)
 *
 * 模块目录（一等实体，docs/design/domain-model.md §6.4）：约束空间·规矩——
 * 描述"代码库现在由哪些模块构成、彼此依赖什么"，用途是系统设计。
 *
 * 与 user-tasks 范式的两处差异：
 * - id 是人工指定的人类可读 slug（非服务端序列生成），故写入用 `PUT /:id` 幂等 upsert，
 *   新建与编辑共用同一端点。
 * - 该端点请求体是 snake_case（服务端 schema 直接按 `product_id`/`depends_on` 校验）。
 */

/** `PUT /api/system-modules/:id` 请求体 */
export interface UpsertSystemModuleInput {
  /** 小写 slug（`gateway` / `web-spa`），服务端有 regex 强校验 */
  id: string;
  product_id: string;
  name: string;
  /** 代码库路径（如 apps/server） */
  path?: string;
  responsibility?: string;
  /** 依赖的其他模块 id */
  depends_on?: string[];
  provenance?: Provenance;
}


// ─── Query Hooks ───────────────────────────────────────────────

/** 按产品拉模块目录（深树 GET /api/products/:id 不含 modules，必须单独拉） */
export function useSystemModules(productId: string) {
  return useQuery({
    queryKey: ['system-modules', productId],
    // 响应类型由 hc 从服务端路由推断（同一仓库、同一 tsc 校验），无需再断言；
    // Array.isArray 只兜底非数组的错误体路径。
    queryFn: async () => {
      const res = await api.api['system-modules'].$get({ query: { productId } });
      if (!res.ok) throw await toApiError(res, '加载模块目录失败');
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
    enabled: !!productId,
  });
}

// ─── Mutation Hooks ────────────────────────────────────────────

/** 按 slug 幂等 upsert（新建与编辑共用） */
export function useUpsertSystemModule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpsertSystemModuleInput) => {
      const res = await api.api['system-modules'][':id'].$put({
        param: { id: input.id },
        json: input,
      });
      if (!res.ok) throw await toApiError(res, '保存模块失败');
      return res.json();
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['system-modules', variables.product_id] });
    },
  });
}

export function useDeleteSystemModule() {
  const queryClient = useQueryClient();

  return useMutation({
    // productId 必传：模块身份是 (产品, slug)，服务端据此定位（0009）
    mutationFn: async (variables: { id: string; productId: string }) => {
      const res = await api.api['system-modules'][':id'].$delete({
        param: { id: variables.id },
        query: { productId: variables.productId },
      });
      if (!res.ok) throw await toApiError(res, '删除模块失败');
      return res.json();
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['system-modules', variables.productId] });
    },
  });
}
