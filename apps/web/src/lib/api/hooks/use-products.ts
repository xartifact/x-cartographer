'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { toApiError } from '@/lib/api/error';
import type { Product, CreateProductDTO, UpdateProductDTO } from '@x-cartographer/shared';

/**
 * Product REST hooks (react-query)
 * 原 use-projects.ts 正名（产品 = 原 Project），backed by the gateway REST API。
 */

// ─── Query Hooks ───────────────────────────────────────────────

export function useProducts() {
  return useQuery({
    queryKey: ['products'],
    queryFn: async () => {
      const res = await api.api.products.$get();
      return res.json();
    },
  });
}

export function useProduct(id: string | undefined) {
  return useQuery({
    queryKey: ['products', id],
    queryFn: async () => {
      const res = await api.api.products[':id'].$get({ param: { id: id! } });
      return res.json();
    },
    enabled: !!id,
  });
}

export function useSearchProducts(query: string) {
  return useQuery({
    queryKey: ['products', 'search', query],
    queryFn: async () => {
      const res = await api.api.products.search.$get({ query: { q: query } });
      return res.json();
    },
    enabled: query.length > 0,
  });
}

// ─── Mutation Hooks ────────────────────────────────────────────

export function useCreateProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (dto: CreateProductDTO) => {
      const res = await api.api.products.$post({ json: dto });
      if (!res.ok) throw await toApiError(res, '创建产品失败');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
}

export function useUpdateProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (variables: { id: string } & UpdateProductDTO) => {
      const { id, ...dto } = variables;
      const res = await api.api.products[':id'].$patch({ param: { id }, json: dto });
      if (!res.ok) throw await toApiError(res, '更新产品失败');
      return res.json();
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      if (variables.id) {
        queryClient.invalidateQueries({ queryKey: ['products', variables.id] });
      }
    },
  });
}

export function useDeleteProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (variables: { id: string }) => {
      const res = await api.api.products[':id'].$delete({ param: { id: variables.id } });
      if (!res.ok) throw await toApiError(res, '删除产品失败');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
}

export function useSaveFullProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (variables: { product: Product }) => {
      const res = await api.api.products.full.$put({ json: variables });
      if (!res.ok) throw await toApiError(res, '保存产品失败');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
}
