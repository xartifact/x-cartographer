import { useParams } from '@tanstack/react-router';
import { useState } from 'react';
import { useProduct } from '@/lib/api/hooks';
import { StoryMapCanvas } from '@/features/story-map/components/story-map-canvas';
import { PatronCanvas } from '@/features/story-map/components/patron-canvas';
import { Button } from '@x-cartographer/ui';

type LayoutMode = 'columns' | 'classic';

const LAYOUT_KEY = 'story-map-layout';

function readLayout(): LayoutMode {
  try {
    const v = localStorage.getItem(LAYOUT_KEY);
    if (v === 'columns' || v === 'classic') return v;
  } catch {
    // localStorage 不可用时用默认
  }
  return 'columns';
}

export function StoryMapRoutePage() {
  const { productId: productIdRaw } = useParams({ strict: false });
  const productId = productIdRaw!;
  const { data: project, isLoading } = useProduct(productId);
  const [layout, setLayout] = useState<LayoutMode>(readLayout);

  const toggle = () => {
    const next: LayoutMode = layout === 'columns' ? 'classic' : 'columns';
    setLayout(next);
    try {
      localStorage.setItem(LAYOUT_KEY, next);
    } catch {
      // 忽略持久化失败
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center rounded-xl border bg-muted/30 text-muted-foreground">
        加载中…
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex h-full items-center justify-center rounded-xl border bg-muted/30 text-muted-foreground">
        产品不存在或未加载
      </div>
    );
  }

  return (
    <div className="relative h-[calc(100vh-9.5rem)] overflow-hidden">
      {/* AB 布局切换 */}
      <div className="absolute right-3 top-2 z-30">
        <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={toggle}>
          {layout === 'columns' ? '切换经典模式 (AB)' : '切换列模式 (AB)'}
        </Button>
      </div>
      {layout === 'columns' ? (
        <StoryMapCanvas activities={project.user_activities ?? []} productId={productId} className="h-full w-full" />
      ) : (
        <PatronCanvas activities={project.user_activities ?? []} productId={productId} className="h-full w-full" />
      )}
    </div>
  );
}
