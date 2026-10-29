import { useParams } from "@tanstack/react-router";
import { useProduct } from "@/lib/api/hooks";
import { StoriesPage } from "@/features/user-stories/components/stories-page";

export function StoriesRoutePage() {
  const { productId } = useParams({ strict: false });
  const { data: project, isLoading, error, refetch } = useProduct(productId);

  if (error)
    return (
      <div role="alert" className="p-6 space-y-3">
        <p>加载失败：{error.message}</p>
        <button className="rounded border px-3 py-2" onClick={() => refetch()}>
          重新加载
        </button>
      </div>
    );
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
          产品不存在，请返回产品列表核对链接
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
