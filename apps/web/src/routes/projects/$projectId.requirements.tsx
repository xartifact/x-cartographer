import { useParams } from '@tanstack/react-router';
import { RequirementsPage } from '@/features/requirements';



/**
 * 需求分析页（/projects/:id/requirements）
 */
export function RequirementsRoutePage() {
  const { projectId: projectIdRaw } = useParams({ strict: false });
  const projectId = projectIdRaw!;

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
