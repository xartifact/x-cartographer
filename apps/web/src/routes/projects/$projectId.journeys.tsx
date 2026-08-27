import { useParams } from '@tanstack/react-router';
import { useProject } from '@/lib/api/hooks';
import { JourneysPage } from '@/features/user-journeys/components/journeys-page';

export function JourneysRoutePage() {
  const { projectId } = useParams({ strict: false });
  const { data: project, isLoading } = useProject(projectId);

  if (isLoading) {
    return (
      <div className="container py-6">
        <h1 className="text-2xl font-bold mb-6">旅程管理</h1>
        <div className="rounded-xl border bg-muted/30 p-12 text-center text-muted-foreground">
          加载中…
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="container py-6">
        <h1 className="text-2xl font-bold mb-6">旅程管理</h1>
        <div className="rounded-xl border bg-muted/30 p-12 text-center text-muted-foreground">
          项目不存在或未加载
        </div>
      </div>
    );
  }

  return (
    <div className="container py-6">
      <h1 className="text-2xl font-bold mb-6">旅程管理</h1>
      <JourneysPage project={project} />
    </div>
  );
}
