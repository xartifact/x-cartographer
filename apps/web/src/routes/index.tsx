import { createFileRoute, Link } from '@tanstack/react-router';
import { FolderKanban, Map, CheckSquare } from 'lucide-react';



export function HomePage() {

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <h1 className="text-4xl font-bold">X-Cartographer</h1>
      <p className="mt-4 text-muted-foreground">AI Native 用户故事地图可视化应用</p>
      <div className="mt-8 grid gap-6 md:grid-cols-3">
        <Link
          to="/projects"
          className="rounded-xl border bg-card p-6 shadow transition hover:shadow-md"
        >
          <div className="flex items-center gap-3">
            <FolderKanban className="h-6 w-6 text-primary" />
            <h2 className="text-lg font-semibold">项目管理</h2>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">创建、导入、管理你的项目</p>
        </Link>
        <Link
          to="/projects"
          className="rounded-xl border bg-card p-6 shadow transition hover:shadow-md"
        >
          <div className="flex items-center gap-3">
            <Map className="h-6 w-6 text-primary" />
            <h2 className="text-lg font-semibold">故事地图</h2>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">可视化用户故事，梳理产品全局</p>
        </Link>
        <Link
          to="/projects"
          className="rounded-xl border bg-card p-6 shadow transition hover:shadow-md"
        >
          <div className="flex items-center gap-3">
            <CheckSquare className="h-6 w-6 text-primary" />
            <h2 className="text-lg font-semibold">任务规划</h2>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">拆解任务，跟踪进度与交付</p>
        </Link>
      </div>
    </main>
  );
}
