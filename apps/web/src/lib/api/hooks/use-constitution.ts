"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { toApiError } from "@/lib/api/error";
import type {
  AdrRecord,
  AdrReview,
  CreateAdrReviewEventDTO,
  AdrStatus,
  CreateAdrRecordDTO,
  CurrentConstitution,
} from "@x-cartographer/shared";

/**
 * 技术宪法（ADR）REST hooks —— 镜像 use-milestones.ts 的写法。
 *
 * 三条读取路径对应三种问题（technical-constitution.md §3.3）：
 *   useCurrentConstitution    现在生效的约束是什么（折叠 accepted 记录）
 *   useAdrRecords / useAdrRecord  这个约束是谁、何时、为什么定下的（账本序）
 *   useConstitutionAsOfMilestone  某个版本交付时生效的是什么（按里程碑时刻折叠）
 */

// ─── Query Hooks ───────────────────────────────────────────────

export function useCurrentConstitution(productId: string) {
  return useQuery({
    queryKey: ["constitution", "current", productId],
    queryFn: async (): Promise<CurrentConstitution | null> => {
      // 必须走 `/current` 子路径（折叠结果）；`adr-records.$get` 是账本列表，形状完全不同
      const res = await api.api["adr-records"].current.$get({ query: { productId } });
      if (!res.ok) throw await toApiError(res, "加载 ADR 数据失败");
      const data = await res.json();
      // 路由返回 {error} 形状（参数缺失）时不当作宪法
      if (!data || typeof data !== "object" || "error" in data || Array.isArray(data)) return null;
      return data as unknown as CurrentConstitution;
    },
    enabled: !!productId,
  });
}

export function useAdrRecords(productId: string) {
  return useQuery({
    queryKey: ["constitution", "adr-records", productId],
    queryFn: async (): Promise<AdrRecord[]> => {
      const res = await api.api["adr-records"].$get({ query: { productId } });
      if (!res.ok) throw await toApiError(res, "加载 ADR 列表失败");
      const data = await res.json();
      return Array.isArray(data) ? (data as AdrRecord[]) : [];
    },
    enabled: !!productId,
  });
}

export function useAdrRecord(id: string) {
  return useQuery({
    queryKey: ["constitution", "adr-record", id],
    queryFn: async (): Promise<AdrRecord | null> => {
      const res = await api.api["adr-records"][":id"].$get({ param: { id } });
      if (!res.ok) throw await toApiError(res, "加载 ADR 数据失败");
      const data = await res.json();
      if (!data || typeof data !== "object" || "error" in data) return null;
      return data as unknown as AdrRecord;
    },
    enabled: !!id,
  });
}

export function useConstitutionAsOfMilestone(milestoneId: string) {
  return useQuery({
    queryKey: ["constitution", "as-of-milestone", milestoneId],
    queryFn: async (): Promise<CurrentConstitution | null> => {
      const res = await api.api["adr-records"]["as-of-milestone"].$get({
        query: { milestoneId },
      });
      // 里程碑不存在 → 404 带 error；未关联任何 ADR 时仍返回折叠结果（可能三空数组）
      if (!res.ok) throw await toApiError(res, "加载 ADR 数据失败");
      const data = await res.json();
      if (!data || typeof data !== "object" || "error" in data) return null;
      return data as unknown as CurrentConstitution;
    },
    enabled: !!milestoneId,
  });
}

// ─── Mutation Hooks ────────────────────────────────────────────

export function useCreateAdrRecord() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (dto: CreateAdrRecordDTO) => {
      const res = await api.api["adr-records"].$post({ json: dto });
      if (!res.ok) throw await toApiError(res, "创建 ADR 失败");
      return res.json();
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["constitution"] });
      queryClient.invalidateQueries({ queryKey: ["status-changes"] });
      queryClient.invalidateQueries({
        queryKey: ["constitution", "current", variables.product_id],
      });
      queryClient.invalidateQueries({
        queryKey: ["constitution", "adr-records", variables.product_id],
      });
    },
  });
}

export function useUpdateAdrStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (variables: {
      id: string;
      productId: string;
      status: AdrStatus;
      reason: string;
      reviewToken: string;
      expectedStatus: AdrStatus;
    }) => {
      const { id, status, reason, reviewToken, expectedStatus } = variables;
      const res = await api.api["adr-records"][":id"].status.$post({
        param: { id },
        json: { status, reason, reviewToken, expectedStatus },
      });
      if (!res.ok) throw await toApiError(res, "ADR 状态流转失败");
      return res.json();
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["constitution"] });
      queryClient.invalidateQueries({ queryKey: ["status-changes"] });
      queryClient.invalidateQueries({ queryKey: ["constitution", "current", variables.productId] });
      queryClient.invalidateQueries({
        queryKey: ["constitution", "adr-records", variables.productId],
      });
      queryClient.invalidateQueries({ queryKey: ["constitution", "adr-record", variables.id] });
    },
  });
}

export function useAdrReview(id: string) {
  return useQuery({
    queryKey: ["constitution", "review", id],
    enabled: !!id,
    refetchOnWindowFocus: false,
    queryFn: async (): Promise<AdrReview> => {
      const res = await api.api["adr-records"][":id"].review.$get({ param: { id } });
      if (!res.ok) throw await toApiError(res, "加载评审失败");
      return (await res.json()) as AdrReview;
    },
  });
}

export function useAddAdrReviewEvent() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: CreateAdrReviewEventDTO }) => {
      const res = await api.api["adr-records"][":id"].review.$post({ param: { id }, json: input });
      if (!res.ok) throw await toApiError(res, "保存意见失败");
      return res.json();
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ["constitution"] }),
  });
}
