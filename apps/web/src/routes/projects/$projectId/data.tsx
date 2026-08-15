import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/projects/$projectId/data')({
  component: DataRoutePage,
});

/**
 * 数据浏览器页（/projects/:id/data）
 *
 * TODO(数据层): 渲染 features/data-browser 的 DataBrowserPage 组件。
 * 该组件目前依赖旧 Next 版 store/API，待数据层切换后接入。
 */
function DataRoutePage() {
  return (
    <div className="container py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">数据浏览器</h1>
        <p className="text-muted-foreground">查看和管理项目的所有数据</p>
      </div>

      {/* TODO(数据层): <DataBrowserPage journeys={...} /> */}
      <div className="rounded-xl border border-dashed bg-muted/30 p-12 text-center text-muted-foreground">
        数据浏览器（占位）— 待接入数据层后渲染 DataBrowserPage
      </div>
    </div>
  );
}
