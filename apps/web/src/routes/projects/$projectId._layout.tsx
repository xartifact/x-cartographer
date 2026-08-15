import { createFileRoute, Outlet } from '@tanstack/react-router';
import { ProjectNav } from '@/components/layout';
import { useProject } from '@/lib/api/hooks';

export const Route = createFileRoute('/projects/$projectId/_layout')({
  component: ProjectDetailLayout,
});

/**
 * 项目详情嵌套布局（pathless layout）
 *
 * 为 /projects/$projectId 下所有子页面提供统一 ProjectNav + Outlet。
 */
function ProjectDetailLayout() {
  const { projectId } = Route.useParams();
  const { data: project } = useProject(projectId);

  return (
    <div className="flex flex-col min-h-[calc(100vh-3.5rem)]">
      <ProjectNav projectId={projectId} projectName={project?.name} />
      <div className="flex-1">
        <Outlet />
      </div>
    </div>
  );
}
