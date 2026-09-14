'use client';

/**
 * 顶部栏产品切换（PpTc1）：当前活动产品下拉，切换持久化并跳转概览。
 * 无活动产品时不渲染。
 */

import { useNavigate } from '@tanstack/react-router';
import { ChevronsUpDown } from 'lucide-react';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@x-cartographer/ui';
import { useProjectStore, selectActiveProjectId } from '@/features/projects/stores';
import { useProduct, useProducts } from '@/lib/api/hooks';

export function ProductSwitcher() {
  const navigate = useNavigate();
  const activeProjectId = useProjectStore(selectActiveProjectId);
  const setActiveProjectId = useProjectStore((s) => s.setActiveProjectId);
  const { data: current } = useProduct(activeProjectId ?? undefined);
  const { data: allProducts = [] } = useProducts();

  if (!activeProjectId || !current) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex h-8 items-center gap-1 rounded-md border px-2 text-xs font-medium hover:bg-muted"
          title="切换产品"
        >
          <span className="max-w-[140px] truncate">{current.name}</span>
          <ChevronsUpDown className="h-3 w-3 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[200px]">
        <DropdownMenuItem key={current.id} className="font-medium" disabled>
          {current.name}（当前）
        </DropdownMenuItem>
        {allProducts
          .filter((p) => p.id !== activeProjectId)
          .map((p) => (
            <DropdownMenuItem
              key={p.id}
              onClick={() => {
                setActiveProjectId(p.id);
                void navigate({ to: '/products/$productId', params: { productId: p.id } });
              }}
            >
              {p.name}
            </DropdownMenuItem>
          ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
