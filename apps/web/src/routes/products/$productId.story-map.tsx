import { useParams } from '@tanstack/react-router';
import { useProduct } from '@/lib/api/hooks';
import { PatronCanvas } from '@/features/story-map/components/patron-canvas';

export function StoryMapRoutePage() {
  const { productId } = useParams({ strict: false });
  const pid = productId!;
  const { data: project, isLoading } = useProduct(pid);

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
        项目不存在或未加载
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-9.5rem)] overflow-hidden">
      <PatronCanvas activities={project.user_activities ?? []} productId={pid} className="h-full w-full" />
    </div>
  );
}
