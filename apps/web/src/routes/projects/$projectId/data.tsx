import { createFileRoute } from '@tanstack/react-router';
import { useProject } from '@/lib/api/hooks';
import { DataBrowserPage } from '@/features/data-browser';

export const Route = createFileRoute('/projects/$projectId/data')({
  component: DataRoutePage,
});

/**
 * 数据浏览器页（/projects/:id/data）
 */
function DataRoutePage() {
  const { projectId } = Route.useParams();
  const { data: project, isLoading } = useProject(projectId);

  if (isLoading) {
    return (
      <div className="container py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">数据浏览器</h1>
          <p className="text-muted-foreground">查看和管理项目的所有数据</p>
        </div>
        <div className="rounded-xl border bg-muted/30 p-12 text-center text-muted-foreground">
          加载中…
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="container py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">数据浏览器</h1>
          <p className="text-muted-foreground">查看和管理项目的所有数据</p>
        </div>
        <div className="rounded-xl border bg-muted/30 p-12 text-center text-muted-foreground">
          项目不存在或未加载
        </div>
      </div>
    );
  }

  return (
    <div className="container py-6">
      {/* 页面标题 */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold">数据浏览器</h1>
        <p className="text-muted-foreground">查看和管理项目的所有数据</p>
      </div>

      {/* 数据浏览器页面 */}
      <DataBrowserPage journeys={project.user_journeys ?? []} />
    </div>
  );
}
