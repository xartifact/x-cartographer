import { useParams } from '@tanstack/react-router';
import { useProduct } from '@/lib/api/hooks';
import { StoriesPage } from '@/features/user-stories/components/stories-page';

export function StoriesRoutePage() {
  const { productId } = useParams({ strict: false });
  const { data: project, isLoading } = useProduct(productId);

  if (isLoading) {
    return (
      <div className="container py-6">
        <h1 className="text-2xl font-bold mb-6">故事管理</h1>
        <div className="rounded-xl border bg-muted/30 p-12 text-center text-muted-foreground">
          加载中…
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="container py-6">
        <h1 className="text-2xl font-bold mb-6">故事管理</h1>
        <div className="rounded-xl border bg-muted/30 p-12 text-center text-muted-foreground">
          产品不存在或未加载
        </div>
      </div>
    );
  }

  return (
    <div className="container py-6">
      <h1 className="text-2xl font-bold mb-6">故事管理</h1>
      <StoriesPage project={project} />
    </div>
  );
}
