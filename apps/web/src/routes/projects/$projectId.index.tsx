import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/projects/$projectId/')({
  component: ProjectOverviewPage,
});

/**
 * 项目概览页（/projects/:id）
 *
 * TODO(数据层): 渲染原 app/projects/[id]/page.tsx 概览内容（导出 TOML / 项目信息）。
 */
function ProjectOverviewPage() {
  const { projectId } = Route.useParams();

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold">项目概览</h1>
      <p className="text-muted-foreground">项目 ID: {projectId}</p>

      {/* TODO(数据层): 概览详情 + 导出 TOML 操作 */}
      <div className="mt-6 rounded-xl border border-dashed bg-muted/30 p-12 text-center text-muted-foreground">
        项目概览（占位）— 待接入数据层
      </div>
    </div>
  );
}
