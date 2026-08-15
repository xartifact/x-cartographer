import { createFileRoute } from '@tanstack/react-router';
import { useProject } from '@/lib/api/hooks';
import { TasksPage } from '@/features/tasks/components/tasks-page';

export const Route = createFileRoute('/projects/$projectId/tasks')({
  component: TasksRoutePage,
});

function TasksRoutePage() {
  const { projectId } = Route.useParams();
  const { data: project, isLoading } = useProject(projectId);

  if (isLoading) {
    return (
      <div className="container py-6">
        <h1 className="text-2xl font-bold mb-6">任务管理</h1>
        <div className="rounded-xl border bg-muted/30 p-12 text-center text-muted-foreground">
          加载中…
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="container py-6">
        <h1 className="text-2xl font-bold mb-6">任务管理</h1>
        <div className="rounded-xl border bg-muted/30 p-12 text-center text-muted-foreground">
          项目不存在或未加载
        </div>
      </div>
    );
  }

  return (
    <div className="container py-6">
      <h1 className="text-2xl font-bold mb-6">任务管理</h1>
      <TasksPage project={project} />
    </div>
  );
}
