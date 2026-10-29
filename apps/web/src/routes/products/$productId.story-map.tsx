import { useParams } from "@tanstack/react-router";
import { useProduct } from "@/lib/api/hooks";
import { PatronCanvas } from "@/features/story-map/components/patron-canvas";

export function StoryMapRoutePage() {
  const { productId } = useParams({ strict: false });
  const pid = productId!;
  const { data: project, isLoading, error, refetch } = useProduct(pid);

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
      <div className="flex h-full items-center justify-center rounded-xl border bg-muted/30 text-muted-foreground">
        加载中…
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex h-full items-center justify-center rounded-xl border bg-muted/30 text-muted-foreground">
        产品不存在，请返回产品列表核对链接
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-9.5rem)] overflow-hidden">
      <PatronCanvas
        activities={project.user_activities ?? []}
        productId={pid}
        className="h-full w-full"
      />
    </div>
  );
}
