import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { api } from "@/lib/api/client";
import { toApiError } from "@/lib/api/error";
export function useCreateSample() {
  const client = useQueryClient();
  const navigate = useNavigate();
  return useMutation({
    mutationFn: async () => {
      const res = await api.api.products.sample.$post();
      if (!res.ok) throw await toApiError(res, "示例创建失败，请重试");
      const result = await res.json();
      await client.invalidateQueries({ queryKey: ["products"] });
      await navigate({ to: "/products/$productId/story-map", params: { productId: result.id } });
    },
  });
}
