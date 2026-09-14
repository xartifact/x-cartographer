import { Outlet, useParams } from '@tanstack/react-router';
import { useEffect } from 'react';
import { useProjectStore } from '@/features/projects/stores';
import { ProjectNav } from '@/components/layout';
import { useProduct } from '@/lib/api/hooks';



/**
 * 产品详情嵌套布局（pathless layout）
 *
 * 为 /projects/$productId 下所有子页面提供统一 ProjectNav + Outlet。
 */
export function ProjectDetailLayout() {
  const { productId: productIdRaw } = useParams({ strict: false });
  const productId = productIdRaw!;
  const setActiveProjectId = useProjectStore((s) => s.setActiveProjectId);

  // 进入产品时同步活动产品（URL 直达/刷新也生效）
  useEffect(() => {
    setActiveProjectId(productId);
  }, [productId, setActiveProjectId]);
  const { data: project } = useProduct(productId);

  return (
    <div className="flex flex-col min-h-[calc(100vh-3.5rem)]">
      <ProjectNav projectId={productId} projectName={project?.name} />
      <div className="flex-1">
        <Outlet />
      </div>
    </div>
  );
}
