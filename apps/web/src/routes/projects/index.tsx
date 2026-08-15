import { createFileRoute } from '@tanstack/react-router';
import { ProjectListPage } from '@/features/projects/components';

export const Route = createFileRoute('/projects/')({
  component: ProjectsPage,
});

/**
 * 项目列表页
 */
function ProjectsPage() {
  return <ProjectListPage />;
}
