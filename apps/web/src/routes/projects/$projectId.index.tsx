import { useParams } from '@tanstack/react-router';
import { useCallback, useMemo } from 'react';
import { FileText } from 'lucide-react';
import { Button } from '@x-cartographer/ui';
import { useProject } from '@/lib/api/hooks';
import { TaskStatus } from '@/types';

/**
 * 项目概览页（/projects/:id）
 */
export function ProjectOverviewPage() {
  const { projectId } = useParams({ strict: false });
  const { data: project, isLoading } = useProject(projectId);

  // 从 user_journeys 计算统计信息
  const stats = useMemo(() => {
    const journeys = project?.user_journeys ?? [];
    let storyCount = 0;
    let taskCount = 0;
    let doneTaskCount = 0;

    for (const journey of journeys) {
      for (const story of journey.stories ?? []) {
        storyCount += 1;
        for (const task of story.tasks ?? []) {
          taskCount += 1;
          if (task.status === TaskStatus.DONE) {
            doneTaskCount += 1;
          }
        }
      }
    }

    return {
      journeyCount: journeys.length,
      storyCount,
      taskCount,
      doneTaskCount,
      completionRate:
        taskCount > 0 ? Math.round((doneTaskCount / taskCount) * 100) : 0,
    };
  }, [project]);

  // 导出项目全景 AI 上下文（Markdown，可直接粘贴给 LLM）
  const handleExportContext = useCallback(async () => {
    if (!project) return;
    try {
      const journeys = project.user_journeys ?? [];
      const stories = journeys.flatMap((j) => j.stories ?? []);
      const tasks = stories.flatMap((s) => s.tasks ?? []);
      const totalEst = tasks.reduce((a, t) => a + (t.estimation || 0), 0);
      const doneTasks = tasks.filter((t) => t.status === TaskStatus.DONE).length;
      const progress = tasks.length > 0 ? Math.round((doneTasks / tasks.length) * 100) : 0;

      const lines: string[] = [];
      lines.push(`# ${project.name} — 项目全景`);
      lines.push('');
      lines.push(`> 描述：${project.description ?? '（无）'}`);
      lines.push('');
      lines.push('## 概览');
      lines.push('');
      lines.push(`- 用户旅程：${journeys.length} 个`);
      lines.push(`- 用户故事：${stories.length} 个`);
      lines.push(`- 任务总数：${tasks.length} 个（已完成 ${doneTasks}，${progress}%）`);
      lines.push(`- 总估算工时：${totalEst} 小时`);
      lines.push('');
      lines.push('## 用户旅程与故事');
      lines.push('');
      for (const j of journeys) {
        lines.push(`### ${j.name}（persona: ${j.persona}）`);
        lines.push('');
        for (const s of j.stories ?? []) {
          lines.push(`- **[${s.id}] ${s.title}**（${s.priority}优先级 · ${s.estimation}h · ${s.status ?? 'backlog'}）`);
          if ((s.tasks ?? []).length > 0) {
            lines.push(`  - 任务（${s.tasks!.length}）：${s.tasks!.map((t) => `[${t.status}] ${t.title}`).join('；')}`);
          }
        }
        lines.push('');
      }
      lines.push('---');

      const blob = new Blob([lines.join('\n')], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      const safeName = project.name.replace(/[/\\:*?"<>|]/g, '_');
      anchor.download = `${safeName}-context.md`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('上下文导出失败:', error);
      alert(`导出失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }, [project]);

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="rounded-xl border bg-muted/30 p-12 text-center text-muted-foreground">
          加载中…
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="rounded-xl border bg-muted/30 p-12 text-center text-muted-foreground">
          项目不存在或未加载
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* 项目概览标题区域 */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{project.name}</h1>
          <p className="mt-1 text-muted-foreground">{project.description}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExportContext}>
            <FileText className="mr-2 h-4 w-4" />
            导出 AI 上下文
          </Button>
        </div>
      </div>

      {/* 概览内容 */}
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border p-6">
            <h3 className="mb-2 font-semibold">项目信息</h3>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">项目 ID</dt>
                <dd className="font-mono text-xs">{project.id}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">创建时间</dt>
                <dd>
                  {new Date(project.created_at).toLocaleDateString('zh-CN')}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">更新时间</dt>
                <dd>
                  {new Date(project.updated_at).toLocaleDateString('zh-CN')}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">技术栈</dt>
                <dd>
                  {project.metadata?.tech_stack?.length
                    ? project.metadata.tech_stack.join(', ')
                    : '未指定'}
                </dd>
              </div>
            </dl>
          </div>

          <div className="rounded-lg border p-6">
            <h3 className="mb-2 font-semibold">统计信息</h3>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">用户旅程</dt>
                <dd>{stats.journeyCount}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">用户故事</dt>
                <dd>{stats.storyCount}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">任务数</dt>
                <dd>{stats.taskCount}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">完成率</dt>
                <dd>
                  {stats.completionRate}%（{stats.doneTaskCount}/{stats.taskCount}）
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
}
