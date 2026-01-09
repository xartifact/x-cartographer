import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { ArrowRight, FolderOpen, Map, ListTodo } from 'lucide-react';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="max-w-5xl w-full space-y-8">
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold tracking-tight">
            X-Product-Roadmap
          </h1>
          <p className="text-xl text-muted-foreground">
            AI Native 用户故事地图可视化应用
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader>
              <FolderOpen className="h-8 w-8 mb-2 text-primary" />
              <CardTitle>项目管理</CardTitle>
              <CardDescription>
                创建和管理多个产品项目
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                支持 TOML 导入导出，完整的数据持久化
              </p>
              <Button asChild className="w-full">
                <Link href="/projects">
                  管理项目
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <Map className="h-8 w-8 mb-2 text-primary" />
              <CardTitle>故事地图</CardTitle>
              <CardDescription>
                可视化展示用户旅程和故事
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                二维布局展示完整的用户故事地图，支持拖拽
              </p>
              <Button asChild variant="outline" className="w-full">
                <Link href="/projects">
                  前往地图
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <ListTodo className="h-8 w-8 mb-2 text-primary" />
              <CardTitle>任务规划</CardTitle>
              <CardDescription>
                智能拆解和任务管理
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                AI 辅助将用户故事拆解为可执行任务
              </p>
              <Button asChild variant="outline" className="w-full">
                <Link href="/projects">
                  规划任务
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="flex justify-center gap-4 pt-8">
          <Button size="lg" asChild>
            <Link href="/projects">
              开始使用
            </Link>
          </Button>
          <Button size="lg" variant="outline">
            查看文档
          </Button>
        </div>
      </div>
    </main>
  );
}