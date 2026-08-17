import { useParams } from '@tanstack/react-router';
import { useCallback, useMemo, useState } from 'react';
import { Upload, Download, FileText } from 'lucide-react';
import { Button } from '@xpm/ui';
import { useProject, useSaveFullProject } from '@/lib/api/hooks';
import { ImportDialog } from '@/features/projects/components/import-dialog';
import { serializeProjectToToml, serializeToTomlText } from '@/lib/toml/parser';
import type { TomlParsedProject, TomlParsedUserJourney } from '@/features/projects/types';
import { Priority, TaskStatus, type Project, type UserJourney } from '@/types';



/**
 * 项目级别导入的数据形状：
 * ImportDialog 在 parseTomlStoryMap 结果上追加 _projectId / _mode 两个标记字段。
 */
type ProjectImportData = Omit<TomlParsedProject, 'id' | 'updated_at'> & {
  _projectId?: string;
  _mode?: 'merge' | 'replace';
};

/**
 * 将 DB Project 模型转换为 TOML 导出所需的简化 Project 格式
 */
function toTomlProject(project: Project): TomlParsedProject {
  return {
    id: project.id,
    name: project.name,
    description: project.description ?? '',
    version: project.metadata?.version || '1.0.0',
    tech_stack: project.metadata?.tech_stack?.length
      ? project.metadata.tech_stack
      : ['未指定'],
    created_at: project.created_at,
    updated_at: project.updated_at,
    // 序列化时 serializeUserStory 接受 string 与 { description, completed } 两种验收标准，
    // 因此 app 的 string[] 可直接映射为 TomlParsed 形状（completed 省略表示未完成）。
    user_journeys: (project.user_journeys ?? []).map((journey) => ({
      id: journey.id,
      name: journey.name,
      description: journey.description,
      persona: journey.persona,
      order: journey.order,
      stories: (journey.stories ?? []).map((story) => ({
        id: story.id,
        title: story.title,
        description: story.description,
        priority: story.priority,
        estimation: story.estimation,
        acceptance_criteria: (story.acceptance_criteria ?? []).map(
          (c) => ({ description: c })
        ),
        tags: story.tags ?? [],
        status: story.status ?? 'backlog',
      })),
    })),
  };
}

/**
 * 将 TOML 解析出的旅程转换为 app UserJourney 结构（补齐时间戳与关联字段）
 */
function tomlJourneyToUserJourney(
  tomlJourney: TomlParsedUserJourney,
  projectId: string,
  journeyIndex: number,
  now: string
): UserJourney {
  return {
    id: tomlJourney.id,
    name: tomlJourney.name,
    description: tomlJourney.description,
    persona: tomlJourney.persona,
    project_id: projectId,
    order: tomlJourney.order ?? journeyIndex,
    created_at: now,
    updated_at: now,
    stories: (tomlJourney.stories ?? []).map((tomlStory, storyIndex) => ({
      id: tomlStory.id,
      journey_id: tomlJourney.id,
      title: tomlStory.title,
      description: tomlStory.description,
      // TOML 优先级与 Priority 枚举值一致（high/medium/low），结构相同
      priority: tomlStory.priority as Priority,
      estimation: tomlStory.estimation ?? 0,
      acceptance_criteria: (tomlStory.acceptance_criteria ?? []).map(
        (c) => c.description
      ),
      tags: tomlStory.tags ?? [],
      tasks: [],
      order: storyIndex,
      status: tomlStory.status ?? 'backlog',
      created_at: now,
      updated_at: now,
    })),
  };
}

/**
 * 合并 / 替换旅程列表（迁移自原 project-storage.ts 的 mergeTomlToProject）
 */
function mergeJourneys(
  existing: UserJourney[],
  incoming: UserJourney[],
  mode: 'replace' | 'merge'
): UserJourney[] {
  if (mode === 'replace') {
    return incoming;
  }

  const existingMap = new Map(existing.map((j) => [j.id, j]));
  const merged = existing.map((existingJourney) => {
    const incomingJourney = incoming.find((j) => j.id === existingJourney.id);
    if (!incomingJourney) return existingJourney;

    const existingStoryMap = new Map(
      (existingJourney.stories ?? []).map((s) => [s.id, s])
    );
    const mergedStories = (incomingJourney.stories ?? []).map(
      (incomingStory) => {
        const existingStory = existingStoryMap.get(incomingStory.id);
        return existingStory
          ? { ...existingStory, ...incomingStory }
          : incomingStory;
      }
    );
    // 保留现有但 TOML 中未包含的故事
    for (const existingStory of existingJourney.stories ?? []) {
      if (!incomingJourney.stories?.some((s) => s.id === existingStory.id)) {
        mergedStories.push(existingStory);
      }
    }
    return { ...existingJourney, ...incomingJourney, stories: mergedStories };
  });

  // 追加 TOML 中的新旅程
  for (const incomingJourney of incoming) {
    if (!existingMap.has(incomingJourney.id)) {
      merged.push(incomingJourney);
    }
  }
  return merged;
}

/**
 * 项目概览页（/projects/:id）
 */
export function ProjectOverviewPage() {
  const { projectId } = useParams({ strict: false });
  const { data: project, isLoading } = useProject(projectId);
  const { mutateAsync: saveFullProject } = useSaveFullProject();
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge');

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

  const handleExportToml = useCallback(async () => {
    if (!project) return;
    try {
      const tomlData = serializeProjectToToml(toTomlProject(project));
      const tomlText = await serializeToTomlText(tomlData);
      const blob = new Blob([tomlText], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      const safeName = project.name.replace(/[/\\:*?"<>|]/g, '_');
      anchor.download = `${safeName}.toml`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('TOML 导出失败:', error);
      alert(`导出失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
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
  const handleImport = useCallback(
    async (projectData: ProjectImportData) => {
      if (!project) return;
      try {
        // 项目级别导入：合并或替换用户旅程
        const pid = projectData._projectId ?? project.id;
        const mode = projectData._mode ?? 'merge';
        const now = new Date().toISOString();
        const incomingJourneys = projectData.user_journeys.map((tj, index) =>
          tomlJourneyToUserJourney(tj, pid, index, now)
        );

        const mergedJourneys = mergeJourneys(
          project.user_journeys ?? [],
          incomingJourneys,
          mode
        );

        await saveFullProject({
          project: { ...project, user_journeys: mergedJourneys },
        });
      } catch (error) {
        console.error('TOML 导入失败:', error);
        alert(`导入失败: ${error instanceof Error ? error.message : '未知错误'}`);
      }
    },
    [project, saveFullProject]
  );

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
          <Button variant="outline" size="sm" onClick={handleExportToml}>
            <Download className="mr-2 h-4 w-4" />
            导出 TOML
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportContext}>
            <FileText className="mr-2 h-4 w-4" />
            导出 AI 上下文
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setImportMode('merge');
              setShowImportDialog(true);
            }}
          >
            <Upload className="mr-2 h-4 w-4" />
            导入 TOML
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

      {/* 导入对话框 */}
      <ImportDialog
        open={showImportDialog}
        onOpenChange={setShowImportDialog}
        onImport={handleImport}
        projectId={projectId}
        mode={importMode}
      />
    </div>
  );
}
