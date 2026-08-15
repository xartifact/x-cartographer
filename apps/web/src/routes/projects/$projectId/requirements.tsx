import { createFileRoute } from '@tanstack/react-router';
import { RequirementsPage } from '@/features/requirements';

export const Route = createFileRoute('/projects/$projectId/requirements')({
  component: RequirementsRoutePage,
});

/**
 * 需求分析页（/projects/:id/requirements）
 */
function RequirementsRoutePage() {
  const { projectId } = Route.useParams();

  return (
    <div className="container py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">AI 辅助需求分析</h1>
        <p className="text-muted-foreground">
          输入产品需求，AI 自动分析生成用户角色、功能点和用户旅程
        </p>
      </div>

      <RequirementsPage projectId={projectId} />
    </div>
  );
}
