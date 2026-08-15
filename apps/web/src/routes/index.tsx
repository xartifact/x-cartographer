import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/')({
  component: HomePage,
});

function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <h1 className="text-4xl font-bold">X-Cartographer</h1>
      <p className="mt-4 text-muted-foreground">AI Native 用户故事地图可视化应用</p>
      <div className="mt-8 grid gap-6 md:grid-cols-3">
        <a href="/projects" className="rounded-xl border bg-card p-6 shadow transition hover:shadow-md">
          <h2 className="text-lg font-semibold">项目管理</h2>
          <p className="mt-2 text-sm text-muted-foreground">创建、导入、管理你的项目</p>
        </a>
      </div>
    </main>
  );
}
